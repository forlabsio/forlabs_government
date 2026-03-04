import asyncio
import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import admin, auth, bookmarks, grants, search

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.tasks import run_all_collectors

    scheduler = AsyncIOScheduler(timezone="Asia/Seoul")

    scheduler.add_job(run_all_collectors, CronTrigger(hour=10, minute=0), args=["10:00"], id="collect-10am")
    scheduler.add_job(run_all_collectors, CronTrigger(hour=14, minute=0), args=["14:00"], id="collect-2pm")
    scheduler.add_job(run_all_collectors, CronTrigger(hour=17, minute=0), args=["17:00"], id="collect-5pm")

    scheduler.start()
    logger.info("APScheduler started with 3 jobs")

    yield

    scheduler.shutdown()
    logger.info("APScheduler shut down")


app = FastAPI(title="GovGrants API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://frontend-production-3aea.up.railway.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(grants.router)
app.include_router(search.router)
app.include_router(bookmarks.router)
app.include_router(admin.router)
app.include_router(auth.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
