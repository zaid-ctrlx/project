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
uvicorn app.main:app --reload --host 0.0.0.0
```
Backend runs at `http://localhost:8000`. Interactive docs at `/docs`.
Binding to `0.0.0.0` also lets a phone on the same Wi-Fi reach the backend.

**3. Mobile**
```
cd mobile
npm install
copy .env.example .env
```
For web preview on the same PC, set `EXPO_PUBLIC_API_URL` to
`http://localhost:8000/api/v1`. For Expo Go on a physical phone, use your
PC's LAN IP instead, for example `http://192.168.1.28:8000/api/v1`
(`localhost` on the phone would refer to the phone itself). Find your IP with
`ipconfig` on Windows; your phone and PC must be on the same Wi-Fi network.

```
npm start
```
Scan the QR code with Expo Go.

## What's implemented

- **Auth/users:** register, login (email or @username), refresh, profile
  (bio, gender, avatar, interests, location), user search, block/mute,
  delete account.
- **Events & communities** (one `events` table, `kind` = event | community):
  CRUD, cover image, join policy, join/leave, bookmarks, RSVPs + attendees.
- **Messaging:** DMs + group/community chats over WebSocket, read state,
  clear chat, notifications + push tokens.
- **Geocoding:** `GET /geocode/search` (India-wide; `restrict=true` limits to
  enabled map regions and drops low-confidence matches) and `/geocode/reverse`.
- **Discover map (optional, behind the map button next to search):**
  `GET /events/map` returns only in-person events/communities inside
  `ENABLED_REGIONS` (`backend/app/core/geo.py`, Karnataka for now).
  Native uses `react-native-maps` with clustering; web uses Leaflet/OSM.
  Event/community creation rejects locations outside the enabled regions.

## Demo data

`python -m scripts.seed_demo` (from `backend/`, venv active) adds four demo
posts owned by a `@huddle_demo` host account — an event and a community in
Mangaluru and in Bengaluru — handy for showing the Home filters (type,
location, distance, sort, date range). Event dates are relative to the day it
is run; re-run `--remove` then the seed to refresh them.

## Map notes

- The map is empty until events/communities with a physical Karnataka
  location exist. Online events never appear.
- Android standalone/dev builds need a Google Maps key in `app.json`
  (`react-native-maps` plugin `googleMapsApiKey`); Expo Go and web work
  without one.

## Not done yet

- Recommendation engine + interaction logging (Home/Discover feeds are
  placeholders)
- Map: web marker clustering, filters (kind/category/date/distance), end
  dates, distance from user
- Token storage is plain AsyncStorage (move to `expo-secure-store`)
- No email verification / password reset / auth rate limiting
- Locations stored at full precision (round before showing other users')
- Tests (none yet)
