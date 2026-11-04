from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.config import settings
from app.database import init_db
from app.services.data_service import DataService
from app.services.kronos_service import KronosService


class PredictRequest(BaseModel):
    ticker: str = Field(..., min_length=1)
    period: str = Field(default="60d")
    interval: str = Field(default="1h")
    pred_len: int = Field(default=24, ge=1, le=168)


class PredictResponse(BaseModel):
    ticker: str
    latest_price: float
    change_percent: float
    confidence: float
    forecast: list[dict]


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    app.state.data_service = DataService()
    app.state.kronos_service = KronosService()
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.allowed_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok", "app": settings.app_name}


@app.get("/api/tickers")
async def get_tickers():
    return {"tickers": ["BTC-USD", "ETH-USD", "AAPL", "MSFT", "NVDA", "GOOGL", "TSLA", "EURUSD=X", "GBPUSD=X"]}


@app.post("/api/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    try:
        data = app.state.data_service.get_market_data(request.ticker, request.period, request.interval)
        forecast = app.state.kronos_service.predict(data, pred_len=request.pred_len)
        last_close = float(data["close"].iloc[-1])
        first_forecast_close = float(forecast["close"].iloc[0])
        change_percent = ((first_forecast_close - last_close) / last_close) * 100 if last_close else 0.0
        latest_price = last_close
        confidence = 0.82
        response = {
            "ticker": request.ticker,
            "latest_price": latest_price,
            "change_percent": change_percent,
            "confidence": confidence,
            "forecast": [
                {
                    "timestamp": str(idx),
                    "open": float(row["open"]),
                    "high": float(row["high"]),
                    "low": float(row["low"]),
                    "close": float(row["close"]),
                    "volume": float(row["volume"]),
                    "amount": float(row["amount"]),
                }
                for idx, row in forecast.iterrows()
            ],
        }
        return response
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/")
async def root():
    return {"message": "Kronos API is running"}
