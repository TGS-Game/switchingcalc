# Precious Metals Tracking Web App

A full-stack web application for tracking gold and silver holdings by grams, ratios, lineage, switches, sales, and storage fees without storing monetary values.

## Stack
- Frontend: React + Vite
- Backend: Flask + SQLAlchemy + Marshmallow
- Database: PostgreSQL
- Background jobs: APScheduler (alerts polling)
- Auth: JWT + optional TOTP 2FA
- Deployment: Docker Compose / reverse proxy ready

## Key capabilities
- CSV and PDF upload ingestion
- Statement parsing into raw rows and normalized transactions
- Reconciliation workflow for ambiguous switches and sales
- Persistent purchase journey / lineage graph
- Audit trail, autosave, versioning, restore points
- Dashboard, calculator, alerts, admin support impersonation view banner
- GDPR-oriented deletion/export hooks

## Project layout
- `backend/` Flask API and reconciliation engine
- `frontend/` React app
- `infra/` Docker and deployment assets

## Quick start
```bash
cd infra
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8000

## Important domain rule
The system stores only:
- dates
- metal types
- quantities in grams
- ratios
- transaction types
- lineage / reconciliation metadata
- audit / security metadata

It intentionally does **not** store monetary values.
