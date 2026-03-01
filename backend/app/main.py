from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import admin, auth, bookmarks, grants, search

app = FastAPI(title="GovGrants API", version="0.1.0")

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


@app.get("/debug/ntis-test")
async def debug_ntis_test():
    """Temporary endpoint to diagnose NTIS API response from Railway."""
    import httpx
    from xml.etree import ElementTree

    url = "https://www.ntis.go.kr/rndopen/openApi/public_project"
    params = {
        "apprvKey": "u9i4va7a851ozqx077bb",
        "collection": "project",
        "SRWR": "지원사업",
        "searchFd": "BI",
        "searchRnkn": "DATE/DESC",
        "startPosition": 1,
        "displayCnt": 2,
        "addQuery": "PY=2026/SAME",
        "cmbnApiYn": "Y",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, params=params)
        xml_text = resp.text
        try:
            root = ElementTree.fromstring(xml_text)
            total_hits = root.findtext("TOTALHITS") or "0"
            rs = root.find("RESULTSET")
            parsed = len(rs.findall("HIT")) if rs is not None else 0
        except Exception as e:
            total_hits = f"parse_error: {e}"
            parsed = 0
        return {
            "status_code": resp.status_code,
            "resp_length": len(xml_text),
            "total_hits": total_hits,
            "parsed_items": parsed,
            "first_500_chars": xml_text[:500],
        }
