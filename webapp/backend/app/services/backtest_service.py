from __future__ import annotations

import pandas as pd


class BacktestService:
    def run_backtest(self, df: pd.DataFrame, strategy: str = "momentum") -> dict:
        if df.empty:
            raise ValueError("Нет данных для бэктеста")

        data = df.copy().sort_values("timestamps").reset_index(drop=True)
        if len(data) < 5:
            raise ValueError("Для бэктеста нужно не менее 5 точек")

        data["sma_5"] = data["close"].rolling(window=5, min_periods=1).mean()
        data["signal"] = 0
        data.loc[data["close"] > data["sma_5"], "signal"] = 1
        data.loc[data["close"] < data["sma_5"], "signal"] = -1

        returns = []
        position = 0
        for idx in range(1, len(data)):
            signal = int(data.iloc[idx - 1]["signal"])
            price_change = (data.iloc[idx]["close"] - data.iloc[idx - 1]["close"]) / data.iloc[idx - 1]["close"]
            if signal == 1 and position <= 0:
                position = 1
            elif signal == -1 and position >= 0:
                position = -1
            returns.append(position * price_change)

        total_return = float(sum(returns)) if returns else 0.0
        positive = sum(1 for r in returns if r > 0)
        negative = sum(1 for r in returns if r < 0)
        win_rate = (positive / (positive + negative)) * 100 if (positive + negative) else 0.0

        return {
            "strategy": strategy,
            "start_value": float(data["close"].iloc[0]),
            "end_value": float(data["close"].iloc[-1]),
            "total_return": total_return,
            "win_rate": win_rate,
            "trades": len(returns),
            "signal_summary": {
                "long": int((data["signal"] == 1).sum()),
                "short": int((data["signal"] == -1).sum()),
                "neutral": int((data["signal"] == 0).sum()),
            },
        }
