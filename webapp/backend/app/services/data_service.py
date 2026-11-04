from __future__ import annotations

import json
import re
from http.client import HTTPException
from datetime import timedelta
from urllib.parse import quote, urlencode
from urllib.request import ProxyHandler, Request, build_opener, urlopen

import numpy as np
import pandas as pd
import yfinance as yf
from loguru import logger


class MarketDataError(RuntimeError):
    pass


class DataService:
    _coinbase_products = {"BTC-USD", "ETH-USD"}
    _interval_seconds = {"1h": 3_600, "4h": 14_400, "1d": 86_400}
    _max_context = 512
    _coinbase_batch_size = 300

    def get_market_data(self, ticker: str, period: str = "1mo", interval: str = "1h") -> pd.DataFrame:
        normalized_ticker = ticker.strip().upper()
        if not normalized_ticker:
            raise MarketDataError("Не задан тикер")
        if interval not in self._interval_seconds:
            raise MarketDataError(f"Неподдерживаемый таймфрейм: {interval}")
        if period not in {"1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"}:
            raise MarketDataError(f"Неподдерживаемый период Yahoo Finance: {period}")

        errors: list[str] = []
        download_interval = "1h" if interval == "4h" else interval

        try:
            data = yf.download(
                normalized_ticker,
                period=period,
                interval=download_interval,
                progress=False,
                auto_adjust=False,
                timeout=10,
            )
            if data.empty:
                raise ValueError("Yahoo Finance вернул пустой набор данных")
            data = self._normalize_market_data(data, normalized_ticker, "Yahoo Finance")
            data = self._drop_incomplete_candle(data, "1h" if interval == "4h" else interval)
            if interval == "4h":
                data = self._aggregate_four_hour_bars(data, normalized_ticker, "Yahoo Finance")
            return data
        except Exception as exc:
            errors.append(f"Yahoo Finance: {exc}")
            logger.warning("Не удалось получить данные {} через Yahoo Finance: {}", normalized_ticker, exc)

        if normalized_ticker in self._coinbase_products:
            try:
                return self._get_coinbase_market_data(normalized_ticker, period, interval)
            except Exception as exc:
                errors.append(f"Coinbase Exchange: {exc}")
                logger.warning("Не удалось получить данные {} через Coinbase Exchange: {}", normalized_ticker, exc)

        try:
            data = self._get_yahoo_chart_market_data(normalized_ticker, period, interval)
            data = self._drop_incomplete_candle(data, "1h" if interval == "4h" else interval)
            if interval == "4h":
                data = self._aggregate_four_hour_bars(data, normalized_ticker, "Yahoo Finance (direct API)")
            return data
        except Exception as exc:
            errors.append(f"Yahoo Finance direct API: {exc}")
            logger.warning("Не удалось получить данные {} через прямой Yahoo Finance API: {}", normalized_ticker, exc)

        raise MarketDataError(
            f"Не удалось получить реальные котировки {normalized_ticker}. " + "; ".join(errors)
        )

    def _get_yahoo_chart_market_data(self, ticker: str, period: str, interval: str) -> pd.DataFrame:
        source_interval = "1h" if interval == "4h" else interval
        if source_interval not in {"1h", "1d"}:
            raise ValueError(f"Yahoo Finance API не поддерживает таймфрейм {source_interval}")
        params = urlencode({"range": period, "interval": source_interval})
        request = Request(
            f"https://query1.finance.yahoo.com/v8/finance/chart/{quote(ticker, safe='')}?{params}",
            headers={
                "Accept": "application/json",
                "Accept-Encoding": "identity",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36",
            },
        )
        chart = json.loads(self._read_public_market_api(request).decode("utf-8")).get("chart", {})
        results = chart.get("result") or []
        if not results:
            error = chart.get("error")
            description = error.get("description") if isinstance(error, dict) else None
            raise ValueError(description or "Yahoo Finance chart не вернул данные")

        result = results[0]
        quotes = result.get("indicators", {}).get("quote") or []
        timestamps = result.get("timestamp") or []
        if not quotes or not timestamps:
            raise ValueError("Yahoo Finance chart вернул пустые свечи")
        quote_timestamps = pd.to_datetime(timestamps, unit="s", utc=True)
        exchange_timezone = result.get("meta", {}).get("exchangeTimezoneName")
        if exchange_timezone:
            quote_timestamps = quote_timestamps.tz_convert(exchange_timezone)
        quote_data = quotes[0]
        candles = pd.DataFrame({
            "timestamps": quote_timestamps,
            "open": quote_data.get("open"),
            "high": quote_data.get("high"),
            "low": quote_data.get("low"),
            "close": quote_data.get("close"),
            "volume": quote_data.get("volume"),
        })
        return self._normalize_market_data(candles, ticker, "Yahoo Finance (direct API)")

    def _aggregate_four_hour_bars(self, data: pd.DataFrame, ticker: str, source: str) -> pd.DataFrame:
        rows: list[dict[str, object]] = []
        session_dates = data["timestamps"].map(lambda timestamp: timestamp.date())
        for _, session in data.groupby(session_dates, sort=False):
            session = session.sort_values("timestamps")
            for offset in range(0, len(session), 4):
                group = session.iloc[offset:offset + 4]
                if len(group) != 4 or not group["timestamps"].diff().iloc[1:].eq(pd.Timedelta(hours=1)).all():
                    continue
                rows.append({
                    "timestamps": group["timestamps"].iloc[0],
                    "open": group["open"].iloc[0],
                    "high": group["high"].max(),
                    "low": group["low"].min(),
                    "close": group["close"].iloc[-1],
                    "volume": group["volume"].sum(),
                })
        if not rows:
            raise ValueError(f"Недостаточно данных для построения 4-часовых свечей {ticker}")
        return self._normalize_market_data(pd.DataFrame(rows), ticker, source)

    def _normalize_market_data(self, data: pd.DataFrame, ticker: str, source: str) -> pd.DataFrame:
        data = data.copy()
        if isinstance(data.columns, pd.MultiIndex):
            fields = {"Open", "High", "Low", "Close", "Volume"}
            field_levels = [
                level for level in range(data.columns.nlevels)
                if fields.issubset(set(data.columns.get_level_values(level)))
            ]
            if len(field_levels) != 1:
                raise ValueError("Не удалось определить уровень OHLCV-колонок")
            data.columns = data.columns.get_level_values(field_levels[0])

        timestamp_columns = {"Date", "Datetime", "timestamps"}
        if not timestamp_columns.intersection(data.columns):
            if data.index.name not in {"Date", "Datetime", "timestamps"}:
                data.index.name = "timestamps"
            data = data.reset_index()
        data = data.rename(columns={
            "Date": "timestamps",
            "Datetime": "timestamps",
            "Open": "open",
            "High": "high",
            "Low": "low",
            "Close": "close",
            "Volume": "volume",
        })

        required = ["timestamps", "open", "high", "low", "close", "volume"]
        missing = [column for column in required if column not in data.columns]
        if missing:
            raise ValueError(f"В данных {ticker} отсутствуют колонки: {missing}")

        data = data[required].copy()
        data["timestamps"] = pd.to_datetime(data["timestamps"], errors="coerce")
        for column in required[1:]:
            data[column] = pd.to_numeric(data[column], errors="coerce")

        numeric_columns = required[1:]
        valid = data[numeric_columns].apply(np.isfinite).all(axis=1)
        valid &= data["close"] > 0
        valid &= data["volume"] >= 0
        valid &= data["high"] >= data[["open", "close", "low"]].max(axis=1)
        valid &= data["low"] <= data[["open", "close", "high"]].min(axis=1)
        data = data.loc[valid & data["timestamps"].notna()]
        data = data.sort_values("timestamps").drop_duplicates("timestamps", keep="last")
        if data.empty:
            raise ValueError(f"Не найдено корректных свечей для {ticker}")

        data["amount"] = data["volume"] * data["close"]
        data.attrs["source"] = source
        return data.reset_index(drop=True)

    def _get_coinbase_market_data(self, ticker: str, period: str, interval: str) -> pd.DataFrame:
        if interval not in self._interval_seconds:
            raise ValueError(f"Coinbase не поддерживает таймфрейм {interval}")

        target_seconds = self._interval_seconds[interval]
        source_seconds = 3_600 if interval == "4h" else target_seconds
        now = pd.Timestamp.now(tz="UTC")
        end = now.floor(f"{source_seconds}s")
        duration = min(
            self._period_duration(period),
            timedelta(seconds=self._max_context * target_seconds),
        )
        start = (end - duration).floor(f"{source_seconds}s")
        candle_rows: list[list[object]] = []
        cursor = start

        while cursor < end:
            batch_end = min(
                cursor + timedelta(seconds=source_seconds * self._coinbase_batch_size),
                end,
            )
            params = urlencode({
                "granularity": source_seconds,
                "start": cursor.isoformat().replace("+00:00", "Z"),
                "end": batch_end.isoformat().replace("+00:00", "Z"),
            })
            request = Request(
                f"https://api.exchange.coinbase.com/products/{ticker}/candles?{params}",
                headers={
                    "Accept": "application/json",
                    "Accept-Encoding": "identity",
                    "User-Agent": "KronosWebApp/1.0",
                },
            )
            batch = json.loads(self._read_public_market_api(request).decode("utf-8"))
            if not isinstance(batch, list):
                raise ValueError("Coinbase вернул ответ неожиданного формата")
            candle_rows.extend(row for row in batch if isinstance(row, list) and len(row) == 6)
            cursor = batch_end

        if not candle_rows:
            raise ValueError("Coinbase не вернул свечи для выбранного периода")

        candles = pd.DataFrame(
            candle_rows,
            columns=["timestamp", "low", "high", "open", "close", "volume"],
        )
        candles["timestamps"] = pd.to_datetime(candles.pop("timestamp"), unit="s", utc=True)
        candles = candles[candles["timestamps"] < end]

        if interval == "4h":
            candles = candles.set_index("timestamps").sort_index()
            grouped = candles.resample("4h", origin="epoch", label="left", closed="left")
            aggregated = grouped.agg({
                "open": "first",
                "high": "max",
                "low": "min",
                "close": "last",
                "volume": "sum",
            })
            complete = grouped["close"].count() == 4
            candles = aggregated.loc[complete].reset_index()

        return self._normalize_market_data(candles, ticker, "Coinbase Exchange")

    def _drop_incomplete_candle(
        self,
        data: pd.DataFrame,
        interval: str,
    ) -> pd.DataFrame:
        interval_seconds = self._interval_seconds.get(interval)
        if interval_seconds is None or data.empty:
            return data

        timestamps = data["timestamps"]
        if timestamps.dt.tz is None:
            now = pd.Timestamp.now()
        else:
            now = pd.Timestamp.now(tz="UTC").tz_convert(timestamps.dt.tz)
        completed = data.loc[timestamps + pd.Timedelta(seconds=interval_seconds) <= now].copy()
        if completed.empty:
            raise ValueError(f"Нет завершённых свечей для таймфрейма {interval}")
        completed.attrs["source"] = data.attrs.get("source", "")
        return completed.reset_index(drop=True)

    @staticmethod
    def _read_public_market_api(request: Request) -> bytes:
        try:
            with urlopen(request, timeout=15) as response:
                return response.read()
        except (HTTPException, OSError) as proxy_error:
            direct_request = Request(
                request.full_url,
                data=request.data,
                headers=dict(request.header_items()),
                method=request.get_method(),
            )
            try:
                with build_opener(ProxyHandler({})).open(direct_request, timeout=15) as response:
                    return response.read()
            except (HTTPException, OSError) as direct_error:
                raise OSError(
                    f"Запрос через системный прокси завершился ошибкой: {proxy_error}; "
                    f"прямой запрос также не выполнен: {direct_error}"
                ) from direct_error

    @staticmethod
    def _period_duration(period: str) -> timedelta:
        normalized_period = period.strip().lower()
        if normalized_period == "max":
            return timedelta(days=365 * 50)
        if normalized_period == "ytd":
            now = pd.Timestamp.now(tz="UTC")
            return now - now.normalize().replace(month=1, day=1)

        match = re.fullmatch(r"(\d+)\s*(d|wk|mo|y)", normalized_period)
        if match is None:
            raise ValueError(f"Coinbase не поддерживает период {period}")

        amount = int(match.group(1))
        unit = match.group(2)
        days_per_unit = {"d": 1, "wk": 7, "mo": 30, "y": 365}
        if amount < 1:
            raise ValueError("Период должен быть не меньше одного временного шага")
        return timedelta(days=amount * days_per_unit[unit])

    def get_tickers(self) -> list[str]:
        return ["BTC-USD", "ETH-USD", "AAPL", "MSFT", "NVDA", "GOOGL", "TSLA", "EURUSD=X", "GBPUSD=X"]
