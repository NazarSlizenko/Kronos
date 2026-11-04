from __future__ import annotations

import pandas as pd
import yfinance as yf

from app.services.sample_data import create_sample_market_data


class DataService:
    def get_market_data(self, ticker: str, period: str = "60d", interval: str = "1h") -> pd.DataFrame:
        try:
            df = yf.download(ticker, period=period, interval=interval, progress=False, auto_adjust=False)
            if df.empty:
                raise ValueError("Пустой набор данных")

            if isinstance(df.columns, pd.MultiIndex):
                first_val = df.columns.get_level_values(0)[0]
                if first_val in ["Open", "High", "Low", "Close", "Volume"]:
                    df.columns = df.columns.get_level_values(0)
                else:
                    df.columns = df.columns.get_level_values(1)

            df = df.reset_index()
            rename_map = {
                "Date": "timestamps",
                "Datetime": "timestamps",
                "Open": "open",
                "High": "high",
                "Low": "low",
                "Close": "close",
                "Volume": "volume",
            }
            df = df.rename(columns=rename_map)

            if "volume" in df.columns and "close" in df.columns:
                df["amount"] = df["volume"] * df["close"]
            else:
                raise ValueError(f"Невозможно подготовить данные для {ticker}: отсутствуют volume/close")

            required = ["open", "high", "low", "close", "volume", "amount"]
            missing = [c for c in required if c not in df.columns]
            if missing:
                raise ValueError(f"Отсутствуют колонки: {missing}")

            df = df[["timestamps"] + required].copy()
            df["timestamps"] = pd.to_datetime(df["timestamps"])
            return df
        except Exception:
            fallback = create_sample_market_data(ticker, period=period, interval=interval)
            return fallback

    def get_tickers(self) -> list[str]:
        return ["BTC-USD", "ETH-USD", "AAPL", "MSFT", "NVDA", "GOOGL", "TSLA", "EURUSD=X", "GBPUSD=X"]
