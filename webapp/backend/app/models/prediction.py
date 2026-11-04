from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String, Text

from app.database import Base


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, nullable=False, index=True)
    period = Column(String, nullable=False)
    interval = Column(String, nullable=False)
    latest_price = Column(Float, nullable=True)
    change_percent = Column(Float, nullable=True)
    confidence = Column(Float, nullable=True)
    status = Column(String, default="completed")
    created_at = Column(DateTime, default=datetime.utcnow)
    result_summary = Column(Text, nullable=True)
