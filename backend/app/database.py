# backend/app/database.py
import ssl

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

_url = settings.async_database_url
_connect_args = {}
if "supabase.co" in _url:
    _connect_args["ssl"] = ssl.create_default_context()

engine = create_async_engine(_url, echo=False, connect_args=_connect_args)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        yield session
