# Niche Community Events — Recommender App

A mobile app for finding small, local, interest-based events and communities
(cycling groups, study circles, photography walks, gaming meetups) that
general event platforms don't surface well. People sign up, pick their
interests and location, then discover, join and chat with the events and
communities near them.

The final-year-project goal is a **recommendation engine** that ranks what
each person sees from their interests, location and past activity. The app
around it (accounts, events, communities, chat, map) is built and working, and
a first hybrid recommender is in place — see [Recommender](#recommender) and
[Status](#status). The full proposal
(architecture, ML approach, evaluation plan, timeline) is in
`FYP_Proposal_Revised.md`.

## Tech stack

| Layer | Technology |
|---|---|
| Mobile app | React Native + Expo (TypeScript), React Navigation |
| Backend API | FastAPI (Python), Pydantic, SQLAlchemy 2, Alembic migrations |
| Database | PostgreSQL 16 (Docker) |
| Auth | JWT access + refresh tokens, bcrypt password hashing, email OTP |
| Realtime | One WebSocket per user (`/api/v1/messages/ws`) |
| Notifications | In-app rows + Expo push |
| Maps | `react-native-maps` on native, Leaflet/OpenStreetMap on web |
| Email | SMTP (Gmail App Password in practice); printed to the console in dev |

## How it works

```
Expo app (phone / web)
   │  REST  /api/v1/...        JSON over HTTP, Bearer access token
   │  WS    /api/v1/messages/ws?token=...   live chat + updates
   ▼
FastAPI backend ── routes → SQLAlchemy models ──► PostgreSQL
   │                                  (schema owned by Alembic migrations)
   ├─ static  /media/...   uploaded avatars and cover images (local disk)
   └─ outbound: SMTP (OTP emails), Expo push service
```

**Request flow.** Every screen talks to the backend through
`mobile/src/api/` (one small module per area, all built on `client.ts`). A
route in `backend/app/api/routes/` validates input with a Pydantic schema,
reads or writes through SQLAlchemy models, and returns a schema-shaped
response. Anything that changes schema goes through an Alembic migration.

**Signing up and staying signed in.**
1. Register → the server emails a 6-digit code (10 min expiry, 5 attempts,
   60 s resend cooldown). The account cannot log in or use the API until the
   code is verified. "Forgot password" reuses the same mechanism.
2. Login (email or @username) returns a short-lived **access token** (30 min)
   and a long-lived **refresh token** (30 days). Failed logins are rate
   limited per account and per IP.
3. When an access token expires the app silently calls `/auth/refresh` once
   and retries the request. Tokens carry a fingerprint of the password hash,
   so changing a password signs out every old session.
4. First login goes through **onboarding**: choose interest tags and a
   location. The app only shows the main screens once that is done.

**Events and communities.** Both live in one `events` table, told apart by
`kind` (`event` = something at a time and place; `community` = an ongoing
group). Events can be bookmarked and RSVP'd to; a community gets a linked chat
group that members join automatically. Join policy is either open or needs
admin approval. The activity type and location on each post, with the
user's interest tags and location, are what the recommender ranks on.

**Chat and notifications.** Direct messages and group/community chats are
saved through normal REST calls, then pushed live to anyone connected on their
WebSocket. The same WebSocket carries edits, deletes, reactions and
notifications. If a user is offline they get an Expo push and see the message
on next open. Blocking stops direct messages and connection requests in both
directions; muting only silences notifications.

**Location and the map.** Locations are stored as coordinates. Creating a
post with a physical location is only allowed inside the enabled regions in
`backend/app/core/geo.py` (Karnataka for now — add a region by adding an
entry). `GET /events/map` returns the in-person posts in those regions for
Discover's map view. Address search and reverse lookup go through
`/geocode/*`.

**Finding the backend from the phone.** In development the app doesn't need
your PC's IP configured: it reuses the address Expo loaded the app from and
assumes the backend is on port 8000 there. `EXPO_PUBLIC_API_URL` is only a
fallback (production builds, `expo start --tunnel`).

## Project structure

```
backend/
  app/
    main.py          app setup: CORS, /media mount, router registration
    api/routes/      one file per area: auth, users, events, messages,
                     groups, connections, notifications, geocode, tags
    api/deps.py      get_current_user (token → verified, active user)
    models/          SQLAlchemy tables
    schemas/         Pydantic request/response shapes
    core/            config, security (JWT/bcrypt), email + otp, geo regions,
                     notify + push, websocket manager, rate limiting,
                     image validation, chat helpers
    db/              session + model registry for Alembic
    recsys/          hybrid recommender (content, SVD, hybrid, synthetic data, metrics)
  alembic/versions/  migration history
  scripts/           seed_tags.py, seed_demo.py, evaluate_recommender.py
mobile/
  App.tsx            providers (auth, theme, messaging) + root navigator
  src/
    navigation/      auth flow → onboarding → bottom tabs + stack screens
    screens/         one file per screen
    components/      shared UI (forms, sheets, chat bubble, map views)
    api/             typed client for every backend area (+ token refresh)
    context/         Auth, Theme, Messaging (WebSocket + unread counts)
    stickers/        built-in sticker pack (inline SVG)
docker-compose.yml   local PostgreSQL
```

Main tabs: **Home** (feed + filters), **Discover** (search + map),
**Messages**, **Profile**.

## Setup

**Prerequisites:** Node.js + npm, Python 3.12+, Docker Desktop, and the Expo
Go app on a phone on the same Wi-Fi as your PC.

**1. Database**
```
docker compose up -d
```
Data lives in a Docker volume named after the project folder
(`<folder>_db_data`). Renaming or moving the folder makes Docker start a new,
empty database; the old data is still in the old volume (`docker volume ls`).

**2. Backend**
```
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env         # edit SECRET_KEY (must be 32+ random chars)
alembic upgrade head
python -m scripts.seed_tags    # interest tags used by onboarding
uvicorn app.main:app --reload --host 0.0.0.0
```
The server refuses to start with the placeholder `SECRET_KEY`. Generate one
with `python -c "import secrets; print(secrets.token_urlsafe(64))"`. The API
runs at `http://localhost:8000`, with interactive docs at `/docs`.

**3. Mobile**
```
cd mobile
npm install
copy .env.example .env
npm start
```
Scan the QR code with Expo Go.

**Email codes.** With `SMTP_HOST` blank in `backend/.env`, verification and
reset codes are printed in the backend (uvicorn) terminal. For real email, set
`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` (Gmail: `smtp.gmail.com:587` plus an
App Password). If a user is set without a password, nothing is sent and the
code is printed under an `ERROR` line.

**Demo data (optional).** `python -m scripts.seed_demo` (from `backend/`) adds
four posts owned by a demo host account — an event and a community each in
Mangaluru and Bengaluru — for trying the Home filters and the map. Dates are
relative to the day it is run; run it with `--remove` first to refresh.

**Android map.** Standalone Android builds need a Google Maps key in
`mobile/app.json`; Expo Go and web work without one.

## Recommender

A hybrid ranker for events and communities, in `backend/app/recsys/`:

- **Content-based** (`content.py`): cosine similarity between the user's
  interest tags and the event's activity type (shared vocabulary in
  `taxonomy.py`), blended with distance, how soon the event is, and popularity.
- **Collaborative** (`cf.py`): truncated SVD over the user–event matrix built
  from implicit feedback — views, bookmarks, RSVPs and joins, weighted by
  strength (`config.py`).
- **Hybrid** (`hybrid.py`): users with fewer than 5 interactions get
  content-based results only; the collaborative weight then ramps up to 0.7 by
  25 interactions (the cold-start rule).
- **Data**: the `interactions` table. Bookmark, RSVP and join are logged by the
  server; the app reports views (`POST /interactions`). Existing bookmarks and
  RSVPs are backfilled when the model is fitted.
- **API/UI**: `GET /api/v1/recommendations` returns ranked events with a
  `recommendation_reason`; Home shows them as "Recommended for you".

Offline evaluation (`python -m scripts.evaluate_recommender`, from `backend/`)
generates synthetic users and events, splits interactions by time, and compares
popularity, content-only, SVD-only and hybrid on Precision/Recall/NDCG@K, plus
RMSE/MAE for the SVD's predicted strength.

## Status

**Built:** accounts and email verification, onboarding, profiles and
connections, events and communities (create, join, approve, RSVP, bookmark),
Home filters, Discover map, direct and group chat (including replies,
forwarding, editing within 5 minutes, deleting, reactions and stickers),
notifications, block/mute.

**Not built yet:**
- Recommender: only validated on synthetic data so far; needs tuning and
  re-evaluation once real interaction data exists. Discover still shows an
  unranked list. Retraining is a 10-minute in-process cache, not a scheduled job.
- Map: web marker clustering, kind/category/date/distance filters.
- Tokens are kept in plain AsyncStorage (should move to `expo-secure-store`).
- Locations are stored at full precision (round before showing other users').
- Rate limiting is in-memory, per process.
- Automated tests.
