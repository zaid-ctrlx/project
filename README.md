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

## API implemented so far

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login` → access + refresh JWTs
- `POST /api/v1/auth/refresh`
- `GET /api/v1/users/me` (protected)
- `GET /api/v1/tags` — starter interest tags (seed via `python -m scripts.seed_tags`)
- `PUT /api/v1/users/me/profile` (protected) — sets location + interest tags, flips `onboarding_completed`

Mobile app: Login/Register screens, then a one-time Onboarding screen
(interest tag chips + GPS or text-search location) before landing on Home.
Routing between them is driven by `user.onboarding_completed`. Tokens
persist in AsyncStorage with silent refresh-on-401 in the API client
(`mobile/src/api/client.ts`).

## Not done yet

- Token storage is plain AsyncStorage, not encrypted (fine for dev, revisit
  with `expo-secure-store` before this matters)
- No email verification / password reset
- No rate limiting on auth endpoints
- Location is stored at full precision; no endpoint shows a user's location
  to *other* users yet, so no rounding-for-privacy logic exists yet either
  (needed before any "nearby users/events" feature ships — see proposal
  Section 6)
- `expo-location`'s geocode/reverse-geocode only work on a real device —
  they degrade gracefully (not crash) in the web preview
- Events, interactions, recommendations — not started
