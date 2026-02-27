FROM python:3.11-slim

WORKDIR /app

# Copy everything and install
COPY . .
RUN pip install --no-cache-dir .

EXPOSE ${PORT:-8000}
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
