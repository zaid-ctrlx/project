"""Sends OS push notifications through Expo's push service
(https://docs.expo.dev/push-notifications/sending-notifications/). Best-
effort only, same philosophy as ws_manager's send_to_user: a device that's
offline, uninstalled the app, or has a stale token just doesn't get a push —
nothing here raises, so a push failure never breaks the request that
triggered it (see app/core/notify.py, the only caller).
"""

import httpx

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
# Expo's own cap per request; batch rather than one HTTP call per token.
EXPO_BATCH_SIZE = 100


def _chunks(items: list[str], size: int) -> list[list[str]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


async def send_expo_push(tokens: list[str], *, title: str, body: str, data: dict) -> None:
    if not tokens:
        return

    messages = [
        {"to": token, "title": title, "body": body, "data": data, "sound": "default"} for token in tokens
    ]

    async with httpx.AsyncClient(timeout=5.0) as client:
        for batch in _chunks(messages, EXPO_BATCH_SIZE):
            try:
                await client.post(EXPO_PUSH_URL, json=batch, headers={"Accept": "application/json"})
            except httpx.HTTPError:
                # Network hiccup / Expo outage — the in-app notification
                # (already committed by the time this is called, see
                # notify.py) is still there next time the user opens the app.
                pass
