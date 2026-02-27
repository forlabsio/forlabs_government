# forlabs_government

A government services portal built with Next.js and FastAPI, enabling citizens to access government services, submit documents, and manage their applications online.

## Features

- **Citizen Portal**: Register and manage your government services account
- **Service Directory**: Browse available government services by category
- **Document Management**: Submit and track document applications
- **Admin Panel**: Government staff tools for managing services, documents, and users
- **Role-Based Access**: Citizen, Staff, and Admin roles

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS v4, Zustand
- **Backend**: FastAPI (Python), SQLAlchemy (async), Alembic, JWT authentication
- **Database**: PostgreSQL (production) / SQLite (development)

## Getting Started

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # Configure your environment variables
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`. API documentation is at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:3000`.

## Environment Variables

### Backend (`.env`)

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | Database connection string | `sqlite+aiosqlite:///./government.db` |
| `SECRET_KEY` | JWT signing secret | `change-me-in-production` |
| `ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token expiry | `1440` |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `http://localhost:3000` |

### Frontend (`.env.local`)

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:8000` |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/register` | Register a new citizen |
| `POST` | `/auth/token` | Obtain JWT token |
| `GET` | `/auth/me` | Get current user profile |
| `GET` | `/services/` | List active services |
| `POST` | `/services/` | Create a service (staff/admin) |
| `PATCH` | `/services/{id}` | Update a service (staff/admin) |
| `GET` | `/documents/` | List documents (own or all for staff) |
| `POST` | `/documents/` | Submit a document |
| `PATCH` | `/documents/{id}` | Update document status |
| `GET` | `/admin/stats` | Platform statistics (admin) |
| `GET` | `/admin/users` | List all users (admin) |
| `GET` | `/health` | Health check |

## Running Tests

```bash
cd backend
pip install -r requirements.txt
pytest
```

<!-- original content below -->