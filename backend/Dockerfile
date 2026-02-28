FROM python:3.11-slim

WORKDIR /app

# Install dependencies only (not the package itself)
COPY pyproject.toml .
RUN pip install --no-cache-dir $(python3 -c "import tomllib; print(' '.join(tomllib.load(open('pyproject.toml','rb'))['project']['dependencies']))")

# Copy source code
COPY . .

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
