FROM python:3.11-slim

# Install tzdata for Asia/Seoul timezone support
RUN apt-get update && apt-get install -y --no-install-recommends tzdata && rm -rf /var/lib/apt/lists/*
ENV TZ=Asia/Seoul

WORKDIR /app

# Install dependencies only (not the package itself)
COPY pyproject.toml .
RUN pip install --no-cache-dir $(python3 -c "import tomllib; print(' '.join(tomllib.load(open('pyproject.toml','rb'))['project']['dependencies']))")

# Copy source code
COPY . .

CMD ["sh", "-c", "alembic upgrade head || echo 'DB already up to date'; uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
