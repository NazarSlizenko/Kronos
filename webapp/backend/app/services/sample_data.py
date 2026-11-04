from __future__ import annotations

import pandas as pd


def create_sample_market_data(ticker: str, period: str = "60d", interval: str = "1h") -> pd.DataFrame:
    hours = 200 if period and "d" in period else 120
    times = pd.date_range(end=pd.Timestamp.utcnow(), periods=hours, freq="1h")
    base = 50000.0 if ticker.upper() == "BTC-USD" else 2000.0
    prices = [base]
    for _ in range(1, len(times)):
        last = prices[-1]
        drift = (0.0009 if ticker.upper() == "BTC-USD" else 0.0015) * last
        noise = (((_ % 5) - 2) * 0.0007) * last
        prices.append(max(last + drift + noise, 1.0))
    data = pd.DataFrame({
        "timestamps": times,
        "open": prices,
        "high": [p * (1 + 0.0008) for p in prices],
        "low": [max(p * (1 - 0.0008), 1.0) for p in prices],
        "close": prices,
        "volume": [1000 + i * 3 for i in range(len(times))],
    })
    data["amount"] = data["volume"] * data["close"]
    return data
