from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}

def test_openapi_docs_loads():
    resp = client.get("/openapi.json")
    assert resp.status_code == 200
    paths = resp.json()["paths"]
    assert "/api/grants" in paths
    assert "/api/search" in paths
    assert "/api/bookmarks" in paths
    assert "/api/admin/dashboard" in paths
    assert "/api/admin/banners" in paths
