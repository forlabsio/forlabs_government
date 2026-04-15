# backend/app/database.py
import ssl

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

_url = settings.async_database_url
_connect_args = {}
if "supabase" in _url:
    _ssl_ctx = ssl.create_default_context()
    _ssl_ctx.check_hostname = False
    _ssl_ctx.verify_mode = ssl.CERT_NONE
    _connect_args["ssl"] = _ssl_ctx

engine = create_async_engine(
    _url,
    echo=False,
    pool_size=5,
    max_overflow=5,
    pool_recycle=1800,   # 30분마다 연결 재생성 (Railway 유휴 연결 차단 방지)
    pool_pre_ping=True,  # 끊긴 연결 자동 감지
    connect_args=_connect_args,
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        yield session
