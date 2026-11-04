from __future__ import annotations

import sys
from pathlib import Path

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

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if hasattr(self, "initialized"):
            return
        self.initialized = True
        self.tokenizer = KronosTokenizer.from_pretrained("NeoQuasar/Kronos-Tokenizer-base")
        self.model = Kronos.from_pretrained("NeoQuasar/Kronos-small")
        self.predictor = KronosPredictor(self.model, self.tokenizer, max_context=512)

    def predict(self, df: pd.DataFrame, pred_len: int = 24):
        if not {"open", "high", "low", "close", "volume", "amount"}.issubset(df.columns):
            raise ValueError("DataFrame должен содержать колонки: open, high, low, close, volume, amount")

        lookback = min(len(df), 200)
        x_df = df.iloc[-lookback:][["open", "high", "low", "close", "volume", "amount"]].copy()
        x_timestamp = pd.Series(pd.to_datetime(df.iloc[-lookback:]["timestamps"]))
        last_time = pd.to_datetime(x_timestamp.iloc[-1])
        future_times = pd.Series(pd.date_range(start=last_time + pd.Timedelta(hours=1), periods=pred_len, freq="h"))

        pred_df = self.predictor.predict(
            df=x_df,
            x_timestamp=x_timestamp,
            y_timestamp=future_times,
            pred_len=pred_len,
            T=1.0,
            top_k=0,
            top_p=0.9,
            sample_count=1,
            verbose=False,
        )
        return pred_df
