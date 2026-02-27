# backend/tests/test_models.py
from app.models import (
    Banner,
    EmailLog,
    FetchLog,
    GrantProject,
    GrantSource,
    SearchLog,
    User,
    UserBookmark,
)


def test_all_models_importable():
    models = [User, GrantProject, GrantSource, UserBookmark, SearchLog, FetchLog, Banner, EmailLog]
    assert len(models) == 8
    for model in models:
        assert hasattr(model, "__tablename__")


def test_grant_project_has_dedup_hash():
    cols = [c.name for c in GrantProject.__table__.columns]
    assert "dedup_hash" in cols
    assert "content_embedding" in cols


def test_user_has_profile_embedding():
    cols = [c.name for c in User.__table__.columns]
    assert "profile_embedding" in cols
    assert "is_admin" in cols
