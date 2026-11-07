"""Offline evaluation (proposal section 5): temporal split, four systems
compared on Precision/Recall/NDCG@K, plus RMSE/MAE for the SVD's predicted
interaction strength.

Run from backend/ with the venv active:

    python -m scripts.evaluate_recommender
    python -m scripts.evaluate_recommender --users 500 --events 250 --k 10 --seed 3
"""
import argparse

import numpy as np

from app.recsys import cf as cfmod
from app.recsys import metrics
from app.recsys.config import INTERACTION_WEIGHTS
from app.recsys.content import content_scores
from app.recsys.hybrid import blend, cf_weight, minmax
from app.recsys.synthetic import generate

POSITIVE_KINDS = {"bookmark", "rsvp", "join"}  # what counts as "relevant" in the test period


def run(n_users: int, n_events: int, k: int, seed: int, test_frac: float = 0.2) -> None:
    users, events, interactions = generate(n_users=n_users, n_events=n_events, seed=seed)

    # Temporal split: earliest (1 - test_frac) of interactions train, the rest test.
    cut = int(len(interactions) * (1 - test_frac))
    train, test = interactions[:cut], interactions[cut:]

    user_idx = {u.id: i for i, u in enumerate(users)}
    event_idx = {e.id: i for i, e in enumerate(events)}
    event_ids = [e.id for e in events]

    R = cfmod.strength_matrix(train, user_idx, event_idx)
    model = cfmod.SVDModel().fit(R)

    pop_raw = np.asarray(R.sum(axis=0)).ravel()
    popularity = minmax(pop_raw)
    train_count = np.asarray((R > 0).sum(axis=1)).ravel()

    seen: dict[str, set[str]] = {}
    for it in train:
        if it.kind in POSITIVE_KINDS or it.kind == "view":
            seen.setdefault(it.user_id, set()).add(it.event_id)
    relevant: dict[str, set[str]] = {}
    for it in test:
        if it.kind in POSITIVE_KINDS and it.event_id not in seen.get(it.user_id, set()):
            relevant.setdefault(it.user_id, set()).add(it.event_id)

    systems = ["Popularity", "Content-based", "Collaborative (SVD)", "Hybrid"]
    scores = {s: {"p": [], "r": [], "n": []} for s in systems}

    for u in users:
        rel = relevant.get(u.id)
        if not rel:
            continue
        ui = user_idx[u.id]
        content = content_scores(u, events, popularity, now=None)  # no time term offline
        cf = model.scores(ui)
        per_system = {
            "Popularity": popularity,
            "Content-based": content,
            "Collaborative (SVD)": cf,
            "Hybrid": blend(content, cf, int(train_count[ui])),
        }
        for name, sc in per_system.items():
            sc = sc.copy()
            for eid in seen.get(u.id, ()):  # never re-recommend what they've already touched
                sc[event_idx[eid]] = -np.inf
            ranked = [event_ids[j] for j in np.argsort(-sc)]
            scores[name]["p"].append(metrics.precision_at_k(ranked, rel, k))
            scores[name]["r"].append(metrics.recall_at_k(ranked, rel, k))
            scores[name]["n"].append(metrics.ndcg_at_k(ranked, rel, k))

    n_eval = len(scores["Hybrid"]["p"])
    print(f"\nUsers {n_users} | events {n_events} | interactions {len(interactions)} "
          f"(train {len(train)} / test {len(test)}) | evaluated users {n_eval} | K={k}\n")
    print(f"{'System':<22}{'P@K':>8}{'R@K':>8}{'NDCG@K':>9}")
    print("-" * 47)
    for name in systems:
        s = scores[name]
        print(f"{name:<22}{np.mean(s['p']):>8.3f}{np.mean(s['r']):>8.3f}{np.mean(s['n']):>9.3f}")

    # RMSE / MAE of the SVD's predicted strength on held-out (user, event) pairs.
    held = cfmod.strength_matrix(test, user_idx, event_idx).tocoo()
    y_true = np.array(held.data)
    y_pred = np.array([model.pred[r, c] for r, c in zip(held.row, held.col)])
    print(f"\nSVD strength prediction on {len(y_true)} held-out pairs: "
          f"RMSE {metrics.rmse(y_true, y_pred):.3f} | MAE {metrics.mae(y_true, y_pred):.3f}")
    print(f"(mean true strength {y_true.mean():.2f}; weights {INTERACTION_WEIGHTS})")

    # Cold-start view: hybrid vs content for users with few training interactions.
    cold = [u for u in users if u.id in relevant and train_count[user_idx[u.id]] < 5]
    print(f"\nCold users (<5 train interactions) with test positives: {len(cold)}; "
          f"CF weight there = {cf_weight(0):.1f} (pure content-based)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--users", type=int, default=300)
    ap.add_argument("--events", type=int, default=150)
    ap.add_argument("--k", type=int, default=10)
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()
    run(a.users, a.events, a.k, a.seed)
