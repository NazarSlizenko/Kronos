from sqlalchemy import Column, Integer, String

from app.database import Base


class FavoriteTicker(Base):
    __tablename__ = "favorite_tickers"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, unique=True, index=True, nullable=False)
    label = Column(String, nullable=True)
    user_id = Column(Integer, default=1)
