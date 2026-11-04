from __future__ import annotations

import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import create_access_token, get_current_user, hash_password
from app.config import settings
from app.database import SessionLocal, init_db
from app.models import FavoriteTicker, Prediction, User
from app.services.backtest_service import BacktestService
from app.services.data_service import DataService, MarketDataError
from app.services.kronos_service import KronosService

MarketInterval = Literal["1h", "4h", "1d"]
MarketPeriod = Literal["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"]


class PredictRequest(BaseModel):
    ticker: str = Field(..., min_length=1)
    period: MarketPeriod = "1mo"
    interval: MarketInterval = "1h"
    pred_len: int = Field(default=24, ge=1, le=168)


class PredictResponse(BaseModel):
    ticker: str
    latest_price: float
    latest_timestamp: str
    data_source: str
    change_percent: float
    confidence: float | None
    evaluation: dict[str, str | float]
    history: list[dict[str, str | float]]
    forecast: list[dict]


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class FavoriteRequest(BaseModel):
    ticker: str = Field(..., min_length=1)
    label: str | None = None


class BacktestRequest(BaseModel):
    ticker: str = Field(..., min_length=1)
    period: MarketPeriod = "1mo"
    interval: MarketInterval = "1h"
    strategy: str = Field(default="momentum")


def parse_market_timestamp(value: str) -> pd.Timestamp:
    timestamp = pd.Timestamp(value)
    if timestamp.tzinfo is None:
        return timestamp.tz_localize("UTC")
    return timestamp.tz_convert("UTC")


def evaluate_pending_predictions(db: Session) -> dict[str, int]:
    records = (
        db.query(Prediction)
        .filter(Prediction.status == "awaiting_actual")
        .order_by(Prediction.created_at.asc())
        .limit(50)
        .all()
    )
    now = pd.Timestamp.now(tz="UTC")
    evaluated = 0
    checked = 0
    errors = []
    grouped: dict[tuple[str, str], list[tuple[Prediction, dict]]] = {}

    for record in records:
        try:
            summary = json.loads(record.result_summary or "{}")
            evaluation = summary.get("evaluation")
            target_value = evaluation.get("target_timestamp") if isinstance(evaluation, dict) else None
            if not target_value:
                record.status = "not_evaluable"
                continue
            target_timestamp = parse_market_timestamp(target_value)
            if target_timestamp > now:
                continue
            grouped.setdefault((record.ticker, record.interval), []).append((record, summary))
        except (TypeError, ValueError, json.JSONDecodeError):
            record.status = "not_evaluable"

    for (ticker, interval), pending_records in grouped.items():
        try:
            data = app.state.data_service.get_market_data(ticker, "1y", interval)
        except MarketDataError as exc:
            checked += len(pending_records)
            errors.append({"ticker": ticker, "detail": str(exc)})
            continue

        timestamps = pd.to_datetime(data["timestamps"], utc=True)
        for record, summary in pending_records:
            evaluation = summary["evaluation"]
            target_timestamp = parse_market_timestamp(evaluation["target_timestamp"])
            actual_rows = data.loc[timestamps >= target_timestamp]
            if actual_rows.empty:
                continue

            actual = actual_rows.iloc[0]
            actual_price = float(actual["close"])
            base_price = float(record.latest_price or 0)
            predicted_price = float(evaluation["predicted_price"])
            if base_price <= 0:
                record.status = "not_evaluable"
                continue

            predicted_change = ((predicted_price - base_price) / base_price) * 100
            actual_change = ((actual_price - base_price) / base_price) * 100
            evaluation.update({
                "status": "evaluated",
                "actual_timestamp": actual["timestamps"].isoformat(),
                "actual_price": actual_price,
                "actual_change_percent": actual_change,
                "absolute_error_percent": abs(predicted_change - actual_change),
                "direction_correct": (
                    (predicted_change > 0 and actual_change > 0)
                    or (predicted_change < 0 and actual_change < 0)
                    or (predicted_change == 0 and actual_change == 0)
                ),
                "evaluated_at": datetime.now(timezone.utc).isoformat(),
            })
            summary["evaluation"] = evaluation
            record.result_summary = json.dumps(summary)
            record.status = "evaluated"
            evaluated += 1
            checked += 1

    db.commit()
    return {"checked": checked, "evaluated": evaluated, "errors": errors}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_default_user(db: Session) -> None:
    username = settings.default_username
    password = settings.default_password
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        db.add(User(username=username, email=f"{username}@local", password_hash=hash_password(password), is_active=1))
        db.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    db = SessionLocal()
    try:
        ensure_default_user(db)
    finally:
        db.close()
    app.state.data_service = DataService()
    app.state.kronos_service = KronosService()
    app.state.backtest_service = BacktestService()
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


@app.get("/api/market/{ticker}")
async def get_latest_market_quote(
    ticker: str,
    period: MarketPeriod = "5d",
    interval: MarketInterval = "1h",
    username: str = Depends(get_current_user),
):
    try:
        data = app.state.data_service.get_market_data(ticker, period, interval)
    except MarketDataError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    latest = data.iloc[-1]
    return {
        "ticker": ticker.upper(),
        "latest_price": float(latest["close"]),
        "latest_timestamp": latest["timestamps"].isoformat(),
        "interval": interval,
        "data_source": str(data.attrs["source"]),
    }


@app.post("/api/auth/login")
async def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if user is None or user.password_hash != hash_password(payload.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный логин или пароль")
    token = create_access_token(user.username)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"username": user.username, "email": user.email},
    }


@app.get("/api/auth/me")
async def me(username: str = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    return {"username": user.username, "email": user.email}


@app.get("/api/predictions")
async def list_predictions(username: str = Depends(get_current_user), db: Session = Depends(get_db)):
    records = db.query(Prediction).order_by(Prediction.created_at.desc()).all()
    predictions = []
    for item in records:
        summary = json.loads(item.result_summary) if item.result_summary else {}
        predictions.append({
            "id": item.id,
            "ticker": item.ticker,
            "period": item.period,
            "interval": item.interval,
            "latest_price": item.latest_price,
            "latest_timestamp": summary.get("latest_timestamp"),
            "data_source": summary.get("data_source"),
            "change_percent": item.change_percent,
            "confidence": item.confidence,
            "status": item.status,
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "evaluation": summary.get("evaluation"),
            "result_summary": summary or None,
        })
    return predictions


@app.post("/api/predictions/evaluate")
async def evaluate_predictions(
    username: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return evaluate_pending_predictions(db)


@app.get("/api/favorites")
async def list_favorites(username: str = Depends(get_current_user), db: Session = Depends(get_db)):
    records = db.query(FavoriteTicker).filter(FavoriteTicker.user_id == 1).order_by(FavoriteTicker.id.desc()).all()
    return [{"id": item.id, "ticker": item.ticker, "label": item.label} for item in records]


@app.post("/api/favorites")
async def add_favorite(payload: FavoriteRequest, username: str = Depends(get_current_user), db: Session = Depends(get_db)):
    existing = db.query(FavoriteTicker).filter(FavoriteTicker.ticker == payload.ticker.upper(), FavoriteTicker.user_id == 1).first()
    if existing:
        return {"id": existing.id, "ticker": existing.ticker, "label": existing.label}
    item = FavoriteTicker(ticker=payload.ticker.upper(), label=payload.label or payload.ticker.upper(), user_id=1)
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "ticker": item.ticker, "label": item.label}


@app.delete("/api/favorites/{ticker}")
async def remove_favorite(ticker: str, username: str = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(FavoriteTicker).filter(FavoriteTicker.ticker == ticker.upper(), FavoriteTicker.user_id == 1).first()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Избранный тикер не найден")
    db.delete(item)
    db.commit()
    return {"deleted": True, "ticker": ticker.upper()}


@app.delete("/api/predictions/{prediction_id}")
async def delete_prediction(
    prediction_id: int,
    username: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prediction = db.query(Prediction).filter(Prediction.id == prediction_id).first()
    if prediction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Прогноз не найден")
    db.delete(prediction)
    db.commit()
    return {"deleted": True, "id": prediction_id}


@app.post("/api/predict", response_model=PredictResponse)
async def predict(request: PredictRequest, username: str = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        data = app.state.data_service.get_market_data(request.ticker, request.period, request.interval)
    except MarketDataError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    try:
        forecast = app.state.kronos_service.predict(
            data,
            pred_len=request.pred_len,
            interval=request.interval,
            ticker=request.ticker,
        )
        last_close = float(data["close"].iloc[-1])
        latest_timestamp = data["timestamps"].iloc[-1].isoformat()
        final_forecast_close = float(forecast["close"].iloc[-1])
        change_percent = ((final_forecast_close - last_close) / last_close) * 100 if last_close else 0.0
        latest_price = last_close
        data_source = str(data.attrs["source"])
        confidence = None
        response = {
            "ticker": request.ticker,
            "latest_price": latest_price,
            "latest_timestamp": latest_timestamp,
            "data_source": data_source,
            "change_percent": change_percent,
            "confidence": confidence,
            "history": [
                {
                    "timestamp": row["timestamps"].isoformat(),
                    "close": float(row["close"]),
                }
                for _, row in data.tail(120).iterrows()
            ],
            "evaluation": {
                "status": "awaiting_actual",
                "target_timestamp": str(forecast.index[-1]),
                "predicted_price": final_forecast_close,
                "predicted_change_percent": change_percent,
            },
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
        record = Prediction(
            ticker=request.ticker.upper(),
            period=request.period,
            interval=request.interval,
            latest_price=latest_price,
            change_percent=change_percent,
            confidence=confidence,
            status="awaiting_actual",
            result_summary=json.dumps(response),
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return response
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/backtest")
async def backtest(request: BacktestRequest, username: str = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        data = app.state.data_service.get_market_data(request.ticker, request.period, request.interval)
    except MarketDataError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    try:
        result = app.state.backtest_service.run_backtest(data, strategy=request.strategy)
        return result
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/")
async def root():
    return {"message": "Kronos API is running"}
