# Railway 배포 현황 및 미해결 이슈

> **날짜:** 2026-02-28
> **상태:** 백엔드/Beat 헬스체크 실패 — 미해결

---

## 프로젝트 정보

- **GitHub:** https://github.com/forlabsio/forlabs_government.git
- **Railway 프로젝트 ID:** `da1c6a76-cdc6-4716-9da3-a6c7ac6db453`
- **Environment ID:** `b0e9eaec-5222-471e-9711-7d4fe6236b44`
- **Railway 계정:** peter@forlabs.io

---

## Railway 서비스 구성 (6개)

| 서비스 | ID | 역할 | 상태 |
|--------|-----|------|------|
| **faithful-stillness** (백엔드) | `b5e68a2b-bbeb-4a0e-8a4b-612ddf6c4760` | FastAPI API 서버 | ❌ 헬스체크 실패 |
| **worker** | `8319bbdf-e964-4a42-8576-8803407032dc` | Celery Worker | ❓ 미확인 |
| **beat** | `1c713119-8525-4a10-95f4-a445676f484e` | Celery Beat | ❌ 헬스체크 실패 |
| **frontend** | `50ba91d1-f26d-40ad-9384-ed64f68306af` | Next.js 프론트엔드 | ✅ 빌드 성공 |
| **Postgres** | `5f15c04a-6f4c-46dd-a4d6-203c27b7d60f` | PostgreSQL DB | ✅ Online |
| **Redis** | `8472ccd0-ebd5-4a15-a808-c6df024b6e8e` | Redis 캐시/큐 | ✅ Online |

### 도메인

- 백엔드: `https://faithful-stillness-production.up.railway.app`
- 프론트엔드: `https://frontend-production-3aea.up.railway.app`

---

## 환경변수 (설정 완료)

### 백엔드/Worker/Beat 공통
```
DATABASE_URL       = ${{Postgres.DATABASE_URL}}  (Railway 내부 참조)
REDIS_URL          = ${{Redis.REDIS_URL}}        (Railway 내부 참조)
BIZINFO_API_KEY    = (설정됨)
NTIS_API_KEY       = (설정됨)
KSTARTUP_API_KEY   = (설정됨)
SUBSIDY24_API_KEY  = (설정됨)
SMES_API_KEY       = (설정됨)
PORT               = 8000
```

### 프론트엔드
```
NEXT_PUBLIC_API_URL = https://faithful-stillness-production.up.railway.app
```

### 아직 미설정
```
OPENAI_API_KEY      = (미설정)
RESEND_API_KEY      = (미설정 — 이메일 인증 기능에 필요)
SUPABASE_URL        = (미설정)
SUPABASE_KEY        = (미설정)
KOCCA_API_KEY       = (미설정)
ADMIN_EMAIL         = (미설정)
```

---

## 서비스별 startCommand / rootDirectory

### 백엔드 (faithful-stillness)
- **rootDirectory:** `backend`
- **startCommand:** `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- **healthcheckPath:** `/health` (timeout 120s)

### Worker
- **rootDirectory:** `backend`
- **startCommand:** `celery -A app.worker worker --loglevel=info`
- **healthcheckPath:** `null` (비활성화 — HTTP 서비스 아님)

### Beat
- **rootDirectory:** `backend`
- **startCommand:** `celery -A app.worker beat --loglevel=info`
- **healthcheckPath:** `null` (비활성화 — HTTP 서비스 아님)

### Frontend
- **rootDirectory:** `frontend`
- **startCommand:** (없음, Dockerfile CMD 사용)
- **healthcheckPath:** (기본)

---

## 시도한 수정 내역 (시간순)

### 1차: DB URL 호환성 (commit b97b2c9)
- **문제:** Railway는 `postgresql://` 형식 제공, asyncpg는 `postgresql+asyncpg://` 필요
- **수정:** `config.py`에 `async_database_url` 프로퍼티 추가, `database.py`/`alembic/env.py` 수정
- **결과:** 헬스체크 여전히 실패

### 2차: Dockerfile pip install (commit eb73440)
- **문제:** `pip install -e .` (editable mode)가 Docker에서 동작 안 함
- **수정:** `pip install .`로 변경
- **결과:** setuptools flat-layout 에러 발생 ("Multiple top-level packages: app, alembic")

### 3차: Dockerfile deps only + frontend public (commit e15de62)
- **문제:** setuptools가 app/과 alembic/ 두 패키지를 발견하여 빌드 실패
- **수정:** pyproject.toml에서 dependencies를 직접 파싱하여 설치
  ```dockerfile
  RUN pip install --no-cache-dir $(python3 -c "import tomllib; print(' '.join(tomllib.load(open('pyproject.toml','rb'))['project']['dependencies']))")
  ```
- **추가:** `frontend/public/.gitkeep` 생성 (Docker COPY 실패 방지)
- **결과:** Docker 빌드는 성공, 런타임 에러

### 4차: PORT 환경변수 (commit 8225899)
- **문제:** Railway startCommand에서 `$PORT` 변수 확장 안 됨 (shell 없이 실행)
- **수정:** 포트 8000 하드코딩
- **결과:** 여전히 실패

### 5차: 근본 원인 3가지 수정 (commit c32c6bb)
- **문제 1:** Railway startCommand는 shell 없이 실행 → `&&` 연산자 동작 안 함
  - `alembic upgrade head && uvicorn ...` → 실패
  - **수정:** startCommand에서 alembic 제거, uvicorn만 실행
- **문제 2:** Dockerfile에 `EXPOSE 8000`이 있으면 Railway가 자동으로 HTTP 헬스체크 활성화
  - Beat/Worker는 HTTP 서비스가 아니므로 헬스체크 실패
  - **수정:** GraphQL API로 `healthcheckPath: null` 설정
- **문제 3:** 헬스체크 타임아웃 짧음
  - **수정:** 백엔드 healthcheck timeout 120초로 설정
- **결과:** ❌ 여전히 실패 (푸시 후 자동 배포 확인 필요)

---

## 현재 Dockerfile

### backend/Dockerfile
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml .
RUN pip install --no-cache-dir $(python3 -c "import tomllib; print(' '.join(tomllib.load(open('pyproject.toml','rb'))['project']['dependencies']))")
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### frontend/Dockerfile
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE ${PORT:-3000}
CMD ["sh", "-c", "node server.js -p ${PORT:-3000}"]
```

---

## 남은 작업 (TODO)

### 배포 관련
1. **백엔드 헬스체크 실패 근본 원인 해결** — Railway 대시보드에서 직접 배포 로그 확인 필요
   - Docker 빌드는 성공하는 것으로 보임 → 런타임 에러 가능성
   - `app.main:app` 임포트 시 에러 발생 가능 (DB 연결, 누락된 환경변수 등)
   - Railway 대시보드 > Deploy Logs에서 실제 에러 메시지 확인 필수
2. **Beat/Worker 헬스체크** — GraphQL로 null 설정했으나 실제 반영 확인 필요
3. **Alembic migration 실행** — startCommand에서 제거됨, 백엔드 배포 성공 후 별도 실행 필요
   ```bash
   railway run -s faithful-stillness -- alembic upgrade head
   ```
4. **미설정 환경변수** — OPENAI_API_KEY, RESEND_API_KEY 등 (기능별 필요)

### 디버깅 제안
1. Railway 대시보드에서 **Deploy Logs** 확인 (빌드 vs 런타임 로그 구분)
2. 로컬에서 Docker 빌드+실행 테스트:
   ```bash
   cd backend
   docker build -t govgrants-backend .
   docker run -p 8000:8000 -e DATABASE_URL="postgresql://..." -e REDIS_URL="redis://..." govgrants-backend
   # http://localhost:8000/health 확인
   ```
3. 앱 시작 시 import 에러 가능성:
   - `app.routers.auth` → bcrypt, redis 의존
   - `app.worker` → celery 의존
   - 모든 dependency가 정상 설치되었는지 확인

### Railway GraphQL API 참고
```bash
# 토큰 위치
~/.railway/config.json → user.token

# 서비스 설정 변경
curl -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { serviceInstanceUpdate(serviceId: \"SERVICE_ID\", environmentId: \"ENV_ID\", input: { startCommand: \"...\", healthcheckPath: null }) { id } }"}' \
  https://backboard.railway.app/graphql/v2
```

---

## 프로젝트 구조 요약

```
govgrants/
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── alembic/          (DB migrations)
│   ├── alembic.ini
│   └── app/
│       ├── main.py       (FastAPI app, CORS, /health)
│       ├── config.py     (Settings, async_database_url 프로퍼티)
│       ├── database.py   (async SQLAlchemy engine)
│       ├── models.py     (User, Grant 등)
│       ├── schemas.py
│       ├── email_service.py
│       ├── worker.py     (Celery tasks)
│       └── routers/
│           ├── auth.py   (회원가입/로그인, 이메일 인증)
│           ├── grants.py
│           ├── search.py
│           ├── bookmarks.py
│           └── admin.py
├── frontend/
│   ├── Dockerfile
│   ├── next.config.ts    (output: "standalone")
│   ├── public/.gitkeep
│   └── src/app/
│       ├── login/page.tsx
│       ├── signup/page.tsx
│       ├── grants/page.tsx
│       └── mypage/page.tsx
└── docs/plans/
    ├── 2026-02-27-govgrants-platform-design.md
    ├── 2026-02-27-implementation-plan.md
    └── 2026-02-28-railway-deployment-status.md  (이 파일)
```
