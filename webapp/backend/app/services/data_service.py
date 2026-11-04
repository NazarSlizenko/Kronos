from __future__ import annotations

import pandas as pd
import yfinance as yf


class MarketDataError(RuntimeError):
    pass


class DataService:
    def get_market_data(self, ticker: str, period: str = "60d", interval: str = "1h") -> pd.DataFrame:
        try:
            df = yf.download(ticker, period=period, interval=interval, progress=False, auto_adjust=False)
        except Exception as exc:
            raise MarketDataError(f"Не удалось получить котировки {ticker} через Yahoo Finance: {exc}") from exc

        if df.empty:
            raise MarketDataError(f"Yahoo Finance не вернул данные для {ticker}")

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

        required = ["open", "high", "low", "close", "volume"]
        missing = [column for column in ["timestamps"] + required if column not in df.columns]
        if missing:
            raise MarketDataError(f"В данных {ticker} отсутствуют колонки: {missing}")

        df["timestamps"] = pd.to_datetime(df["timestamps"], errors="coerce")
        for column in required:
            df[column] = pd.to_numeric(df[column], errors="coerce")
        df = df.dropna(subset=["timestamps", "open", "high", "low", "close", "volume"])
        df = df[df["close"] > 0].sort_values("timestamps")
        if df.empty:
            raise MarketDataError(f"Yahoo Finance не вернул корректные цены для {ticker}")

        df["amount"] = df["volume"] * df["close"]
        return df[["timestamps", "open", "high", "low", "close", "volume", "amount"]].copy()

    def get_tickers(self) -> list[str]:
        return ["BTC-USD", "ETH-USD", "AAPL", "MSFT", "NVDA", "GOOGL", "TSLA", "EURUSD=X", "GBPUSD=X"]
