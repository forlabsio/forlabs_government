from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import admin, auth, bookmarks, grants, search

app = FastAPI(title="GovGrants API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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
