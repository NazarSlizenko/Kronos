from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

try:
    from model import Kronos, KronosPredictor, KronosTokenizer
except ModuleNotFoundError:  # pragma: no cover
    import os

    alt_root = Path(__file__).resolve().parents[4]
    if str(alt_root) not in sys.path:
        sys.path.insert(0, str(alt_root))
    from model import Kronos, KronosPredictor, KronosTokenizer


class KronosService:
    _instance: "KronosService | None" = None
    _model_revision = "901c26c1332695a2a8f243eb2f37243a37bea320"
    _tokenizer_revision = "0e0117387f39004a9016484a186a908917e22426"

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if hasattr(self, "initialized"):
            return
        self.tokenizer = KronosTokenizer.from_pretrained(
            "NeoQuasar/Kronos-Tokenizer-base",
            revision=self._tokenizer_revision,
        )
        self.model = Kronos.from_pretrained(
            "NeoQuasar/Kronos-small",
            revision=self._model_revision,
        )
        self.tokenizer.eval()
        self.model.eval()
        self.predictor = KronosPredictor(self.model, self.tokenizer, max_context=512)
        self.initialized = True

    def predict(
        self,
        df: pd.DataFrame,
        pred_len: int = 24,
        interval: str = "1h",
        ticker: str | None = None,
    ):
        if not {"open", "high", "low", "close", "volume", "amount"}.issubset(df.columns):
            raise ValueError("DataFrame должен содержать колонки: open, high, low, close, volume, amount")
        interval_deltas = {
            "1h": pd.Timedelta(hours=1),
            "4h": pd.Timedelta(hours=4),
            "1d": pd.Timedelta(days=1),
        }
        if interval not in interval_deltas:
            raise ValueError(f"Неподдерживаемый таймфрейм: {interval}")

        lookback = min(len(df), self.predictor.max_context)
        x_df = df.iloc[-lookback:][["open", "high", "low", "close", "volume", "amount"]].copy()
        x_timestamp = pd.Series(pd.to_datetime(df.iloc[-lookback:]["timestamps"]).reset_index(drop=True))
        future_times = self._future_timestamps(x_timestamp, pred_len, interval, ticker)

        pred_df = self.predictor.predict(
            df=x_df,
            x_timestamp=x_timestamp,
            y_timestamp=future_times,
            pred_len=pred_len,
            T=1.0,
            top_k=0,
            top_p=0.9,
            sample_count=5,
            verbose=False,
        )
        return self._sanitize_forecast(pred_df)

    @staticmethod
    def _sanitize_forecast(forecast: pd.DataFrame) -> pd.DataFrame:
        price_columns = ["open", "high", "low", "close"]
        required_columns = price_columns + ["volume"]
        if not set(required_columns).issubset(forecast.columns):
            raise ValueError(f"В прогнозе Kronos отсутствуют колонки: {required_columns}")

        result = forecast.copy()
        values = result[required_columns].to_numpy(dtype=np.float64)
        if not np.isfinite(values).all():
            raise ValueError("Kronos вернул нечисловые или бесконечные значения")

        result[required_columns] = result[required_columns].astype(np.float64)
        result[["open", "close"]] = result[["open", "close"]].clip(lower=1e-8)
        result["volume"] = result["volume"].clip(lower=0)
        result["high"] = result[["high", "open", "close"]].max(axis=1)
        result["low"] = result[["low", "open", "close"]].min(axis=1).clip(lower=1e-8)
        result["amount"] = result["volume"] * result["close"]
        return result

    @staticmethod
    def _future_timestamps(
        timestamps: pd.Series,
        pred_len: int,
        interval: str,
        ticker: str | None,
    ) -> pd.Series:
        interval_deltas = {
            "1h": pd.Timedelta(hours=1),
            "4h": pd.Timedelta(hours=4),
            "1d": pd.Timedelta(days=1),
        }
        delta = interval_deltas[interval]
        last_time = pd.Timestamp(timestamps.iloc[-1])
        is_continuous_market = (
            ticker.strip().upper() in {"BTC-USD", "ETH-USD"}
            if ticker
            else timestamps.dt.dayofweek.isin([5, 6]).any()
        )

        if is_continuous_market:
            return pd.Series(pd.date_range(
                start=last_time + delta,
                periods=pred_len,
                freq=delta,
            ))

        if interval == "1d":
            first_day = last_time.normalize() + pd.Timedelta(days=1)
            return pd.Series(pd.bdate_range(start=first_day, periods=pred_len, freq="B"))

        history = pd.DataFrame({"timestamp": timestamps})
        history["session_date"] = history["timestamp"].map(lambda value: value.date())
        recent_dates = sorted(history["session_date"].unique())[-20:]
        recent = history[history["session_date"].isin(recent_dates)]
        templates: dict[int, list[tuple[int, int, int, int]]] = {}
        fallback_template: list[tuple[int, int, int, int]] = []

        for session_date in recent_dates:
            session = recent[recent["session_date"] == session_date].sort_values("timestamp")
            template = [
                (value.hour, value.minute, value.second, value.microsecond)
                for value in session["timestamp"]
            ]
            templates[session_date.weekday()] = template
            fallback_template = template

        future_values: list[pd.Timestamp] = []
        current_date = last_time.date()
        while len(future_values) < pred_len:
            if current_date.weekday() >= 5:
                current_date = (pd.Timestamp(current_date) + pd.Timedelta(days=1)).date()
                continue
            template = templates.get(current_date.weekday(), fallback_template)
            for hour, minute, second, microsecond in template:
                local_time = pd.Timestamp(
                    year=current_date.year,
                    month=current_date.month,
                    day=current_date.day,
                    hour=hour,
                    minute=minute,
                    second=second,
                    microsecond=microsecond,
                )
                if last_time.tz is not None:
                    local_time = local_time.tz_localize(
                        last_time.tz,
                        ambiguous="NaT",
                        nonexistent="shift_forward",
                    )
                if pd.notna(local_time) and local_time > last_time:
                    future_values.append(local_time)
                    if len(future_values) == pred_len:
                        break
            current_date = (pd.Timestamp(current_date) + pd.Timedelta(days=1)).date()

        return pd.Series(pd.DatetimeIndex(future_values))
