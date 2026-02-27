# backend/app/celery_app.py
from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery_app = Celery("govgrants", broker=settings.redis_url, backend=settings.redis_url)

celery_app.conf.timezone = "Asia/Seoul"
celery_app.conf.beat_schedule = {
    "collect-10am": {
        "task": "app.tasks.run_all_collectors",
        "schedule": crontab(hour=10, minute=0),
        "args": ("10:00",),
    },
    "collect-2pm": {
        "task": "app.tasks.run_all_collectors",
        "schedule": crontab(hour=14, minute=0),
        "args": ("14:00",),
    },
    "collect-5pm": {
        "task": "app.tasks.run_all_collectors",
        "schedule": crontab(hour=17, minute=0),
        "args": ("17:00",),
    },
    "curation-8am": {
        "task": "app.tasks.send_daily_curation",
        "schedule": crontab(hour=8, minute=0),
    },
}
