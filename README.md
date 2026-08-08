# Niche Community Events — Recommender App

Mobile-first (React Native/Expo) app with a FastAPI backend. See
`FYP_Proposal_Revised.md` on the Desktop for the full project proposal
(architecture, ML approach, evaluation plan, timeline).

## Structure

```
backend/    FastAPI + SQLAlchemy + Alembic + JWT auth
mobile/     Expo (React Native, TypeScript)
docker-compose.yml   Postgres for local dev
```

## Prerequisites

- Node.js + npm
- Python 3.12+
- Docker Desktop (WSL2 backend, Windows)
- Expo Go app on your phone (for device testing)

## First-time setup

**1. Database**
```
docker compose up -d
```

**2. Backend**
```
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
copy .env.example .env       # already has working local defaults
alembic upgrade head
uvicorn app.main:app --reload
```
Backend runs at `http://localhost:8000`. Interactive docs at `/docs`.

**3. Mobile**
```
cd mobile
npm install
copy .env.example .env
```
Edit `mobile/.env` and set `EXPO_PUBLIC_API_URL` to your machine's LAN IP
(not `localhost` — a physical phone can't reach that). Find your IP with
`ipconfig` on Windows; your phone and PC must be on the same Wi-Fi network.

```
npm start
```
Scan the QR code with Expo Go.

## Auth flow implemented so far

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login` → access + refresh JWTs
- `POST /api/v1/auth/refresh`
- `GET /api/v1/users/me` (protected)

Mobile app has Login/Register/Home screens wired to these, with tokens
persisted in AsyncStorage and silent refresh-on-401 in the API client
(`mobile/src/api/client.ts`).

## Not done yet

- Token storage is plain AsyncStorage, not encrypted (fine for dev, revisit
  with `expo-secure-store` before this matters)
- No email verification / password reset
- No rate limiting on auth endpoints
- Everything past auth (events, recommendations, profiles) — not started
