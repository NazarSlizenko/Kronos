import json
import unittest
from unittest.mock import Mock, patch

import pandas as pd

import app.services.data_service as data_module
import app.services.kronos_service as kronos_module
from app.services.data_service import DataService, MarketDataError
from app.services.kronos_service import KronosService


class MarketDataTests(unittest.TestCase):
    def test_incomplete_candles_are_not_used_as_current_prices(self):
        current_hour = pd.Timestamp.now().floor("h")
        raw_data = pd.DataFrame({
            "timestamps": [current_hour - pd.Timedelta(hours=1), current_hour],
            "open": [100.0, 110.0],
            "high": [102.0, 112.0],
            "low": [99.0, 109.0],
            "close": [101.0, 111.0],
            "volume": [20.0, 30.0],
        })
        data = DataService()._normalize_market_data(raw_data, "BTC-USD", "test")

        completed = DataService()._drop_incomplete_candle(data, "1h")

        self.assertEqual(len(completed), 1)
        self.assertEqual(completed.iloc[0]["close"], 101.0)

    def test_unsupported_period_is_rejected_before_provider_calls(self):
        with patch.object(data_module.yf, "download") as download:
            with self.assertRaises(MarketDataError):
                DataService().get_market_data("AAPL", "60d", "1h")

        download.assert_not_called()

    def test_yahoo_multindex_is_normalized_and_aggregated_to_four_hours(self):
        timestamps = pd.date_range("2026-11-02 09:30", periods=8, freq="h", name="Datetime")
        columns = pd.MultiIndex.from_product([["Open", "High", "Low", "Close", "Volume"], ["AAPL"]])
        values = [[100 + i, 102 + i, 99 + i, 101 + i, 10 + i] for i in range(8)]
        yahoo_data = pd.DataFrame(values, index=timestamps, columns=columns)

        with patch.object(data_module.yf, "download", return_value=yahoo_data) as download:
            candles = DataService().get_market_data("AAPL", "5d", "4h")

        self.assertEqual(download.call_args.kwargs["interval"], "1h")
        self.assertEqual(len(candles), 2)
        self.assertEqual(candles.attrs["source"], "Yahoo Finance")
        self.assertEqual(candles.iloc[0]["open"], 100)
        self.assertEqual(candles.iloc[0]["high"], 105)
        self.assertEqual(candles.iloc[0]["low"], 99)
        self.assertEqual(candles.iloc[0]["close"], 104)
        self.assertEqual(candles.iloc[0]["volume"], 46)
        self.assertEqual(candles.iloc[1]["open"], 104)
        self.assertEqual(candles.iloc[1]["close"], 108)
        self.assertEqual(candles.iloc[1]["volume"], 62)

    def test_four_hour_aggregation_drops_partial_hour_groups(self):
        timestamps = pd.date_range("2026-11-02 09:30", periods=6, freq="h", name="Datetime")
        candles = pd.DataFrame({
            "open": range(100, 106),
            "high": range(102, 108),
            "low": range(99, 105),
            "close": range(101, 107),
            "volume": range(10, 16),
        }, index=timestamps)

        result = DataService()._aggregate_four_hour_bars(
            DataService()._normalize_market_data(candles, "AAPL", "Yahoo Finance"),
            "AAPL",
            "Yahoo Finance",
        )

        self.assertEqual(len(result), 1)
        self.assertEqual(result.iloc[0]["volume"], 46)

    def test_empty_yahoo_response_uses_coinbase_and_discards_open_candle(self):
        end = pd.Timestamp.now(tz="UTC").floor("3600s")
        start = end - pd.Timedelta(hours=24)
        rows = []
        for offset in range(25):
            timestamp = int((start + pd.Timedelta(hours=offset)).timestamp())
            price = 100 + offset
            rows.append([timestamp, price - 1, price + 1, price, price + 0.5, 2])

        with (
            patch.object(data_module.yf, "download", return_value=pd.DataFrame()),
            patch.object(DataService, "_read_public_market_api", return_value=json.dumps(rows).encode("utf-8")),
        ):
            candles = DataService().get_market_data("BTC-USD", "1d", "1h")

        self.assertEqual(len(candles), 24)
        self.assertEqual(candles.attrs["source"], "Coinbase Exchange")
        self.assertEqual(candles.iloc[-1]["timestamps"], end - pd.Timedelta(hours=1))
        self.assertEqual(candles.iloc[-1]["amount"], candles.iloc[-1]["close"] * 2)

    def test_direct_yahoo_chart_fallback_handles_chart_json(self):
        payload = {
            "chart": {
                "result": [{
                    "timestamp": [1793628000, 1793631600],
                    "indicators": {
                        "quote": [{
                            "open": [100, 101],
                            "high": [102, 103],
                            "low": [99, 100],
                            "close": [101, 102],
                            "volume": [20, 30],
                        }],
                    },
                }],
            },
        }

        with (
            patch.object(data_module.yf, "download", return_value=pd.DataFrame()),
            patch.object(DataService, "_read_public_market_api", return_value=json.dumps(payload).encode("utf-8")),
        ):
            candles = DataService().get_market_data("AAPL", "5d", "1h")

        self.assertEqual(len(candles), 2)
        self.assertEqual(candles.attrs["source"], "Yahoo Finance (direct API)")
        self.assertEqual(candles.iloc[-1]["amount"], 3060)

    def test_missing_providers_raise_instead_of_fabricating_prices(self):
        with (
            patch.object(data_module.yf, "download", return_value=pd.DataFrame()),
            patch.object(DataService, "_get_yahoo_chart_market_data", side_effect=ValueError("offline")),
        ):
            with self.assertRaises(MarketDataError):
                DataService().get_market_data("AAPL", "5d", "1h")


class KronosServiceTests(unittest.TestCase):
    def test_forecast_sanitization_enforces_valid_ohlcv_relationships(self):
        raw_forecast = pd.DataFrame({
            "open": [100.0],
            "high": [95.0],
            "low": [105.0],
            "close": [102.0],
            "volume": [-4.0],
            "amount": [900.0],
        })

        forecast = KronosService._sanitize_forecast(raw_forecast)

        self.assertEqual(forecast.iloc[0]["high"], 102.0)
        self.assertEqual(forecast.iloc[0]["low"], 100.0)
        self.assertEqual(forecast.iloc[0]["volume"], 0.0)
        self.assertEqual(forecast.iloc[0]["amount"], 0.0)

    def test_forecast_sanitization_rejects_non_finite_model_output(self):
        raw_forecast = pd.DataFrame({
            "open": [100.0],
            "high": [101.0],
            "low": [99.0],
            "close": [float("nan")],
            "volume": [10.0],
        })

        with self.assertRaisesRegex(ValueError, "нечисловые"):
            KronosService._sanitize_forecast(raw_forecast)

    def test_forecast_amount_is_recomputed_without_float32_rounding(self):
        raw_forecast = pd.DataFrame({
            name: pd.Series([value], dtype="float32")
            for name, value in {
                "open": 79_924.484375,
                "high": 80_229.8984375,
                "low": 79_722.5390625,
                "close": 79_888.4765625,
                "volume": 322.4536437988281,
                "amount": 1.0,
            }.items()
        })

        forecast = KronosService._sanitize_forecast(raw_forecast)

        self.assertEqual(
            float(forecast.iloc[0]["amount"]),
            float(forecast.iloc[0]["volume"]) * float(forecast.iloc[0]["close"]),
        )

    def test_equity_future_timestamps_follow_sessions_and_skip_weekends(self):
        sessions = pd.bdate_range("2026-11-02", periods=5)
        timestamps = pd.Series([
            timestamp + pd.Timedelta(hours=hour, minutes=minute)
            for session in sessions
            for timestamp, hour, minute in [(session, 9, 30), (session, 10, 30)]
        ])

        future = KronosService._future_timestamps(timestamps, 3, "1h", "AAPL")

        self.assertEqual(future.iloc[0], pd.Timestamp("2026-11-09 09:30"))
        self.assertEqual(future.iloc[1], pd.Timestamp("2026-11-09 10:30"))
        self.assertEqual(future.iloc[2], pd.Timestamp("2026-11-10 09:30"))

    def test_equity_daily_forecast_skips_weekends(self):
        timestamps = pd.Series(pd.bdate_range("2026-11-02", periods=5))

        future = KronosService._future_timestamps(timestamps, 3, "1d", "AAPL")

        self.assertEqual(
            future.tolist(),
            [
                pd.Timestamp("2026-11-09"),
                pd.Timestamp("2026-11-10"),
                pd.Timestamp("2026-11-11"),
            ],
        )

    def test_predict_uses_eval_mode_full_context_and_requested_cadence(self):
        previous_instance = KronosService._instance
        self.addCleanup(setattr, KronosService, "_instance", previous_instance)
        KronosService._instance = None

        model = Mock()
        tokenizer = Mock()
        predictor = Mock()
        predictor.max_context = 512
        captured = {}

        def fake_predict(**kwargs):
            captured.update(kwargs)
            index = kwargs["y_timestamp"]
            return pd.DataFrame(
                {name: [1.0] * len(index) for name in ["open", "high", "low", "close", "volume", "amount"]},
                index=index,
            )

        predictor.predict.side_effect = fake_predict
        with (
            patch.object(kronos_module.Kronos, "from_pretrained", return_value=model) as load_model,
            patch.object(kronos_module.KronosTokenizer, "from_pretrained", return_value=tokenizer) as load_tokenizer,
            patch.object(kronos_module, "KronosPredictor", return_value=predictor),
        ):
            service = KronosService()
            timestamps = pd.date_range("2026-01-01", periods=520, freq="4h")
            data = pd.DataFrame({
                "timestamps": timestamps,
                "open": 100.0,
                "high": 101.0,
                "low": 99.0,
                "close": 100.0,
                "volume": 10.0,
                "amount": 1000.0,
            })

            forecast = service.predict(data, pred_len=3, interval="4h")

        model.eval.assert_called_once()
        tokenizer.eval.assert_called_once()
        load_model.assert_called_once_with(
            "NeoQuasar/Kronos-small",
            revision=KronosService._model_revision,
        )
        load_tokenizer.assert_called_once_with(
            "NeoQuasar/Kronos-Tokenizer-base",
            revision=KronosService._tokenizer_revision,
        )
        self.assertEqual(len(captured["df"]), 512)
        self.assertIsInstance(captured["x_timestamp"], pd.Series)
        self.assertEqual(captured["sample_count"], 5)
        self.assertEqual(forecast.index[1] - forecast.index[0], pd.Timedelta(hours=4))
