"""Offline evaluation (proposal section 5): temporal split, four systems
compared on Precision/Recall/NDCG@K, plus RMSE/MAE for the SVD's predicted
interaction strength. Repeated over several random datasets so results are
reported as mean +/- standard deviation, not one lucky run.

Run from backend/ with the venv active:

    python -m scripts.evaluate_recommender                  # 10 seeds, default scenario
    python -m scripts.evaluate_recommender --seeds 20 --k 10
    python -m scripts.evaluate_recommender --tag-noise 0.5  # users' declared tags unreliable
"""
import argparse

import numpy as np

from app.recsys import cf as cfmod
from app.recsys import metrics
from app.recsys.config import CONTENT_WEIGHTS, FULL_BLEND_AT, MAX_CF_WEIGHT, SVD_FACTORS
from app.recsys.content import content_scores
from app.recsys.hybrid import blend, minmax
from app.recsys.synthetic import generate

POSITIVE_KINDS = {"bookmark", "rsvp", "join"}  # what counts as "relevant" in the test period
SYSTEMS = ["Popularity", "Content-based", "Collaborative (SVD)", "Hybrid"]
# Users grouped by how much history they have in the training period - the
# cold-start question is "who does best for each group?".
BUCKETS = ["cold (<5)", "some (5-14)", "active (15+)"]


def bucket_of(n_train: int) -> str:
    return BUCKETS[0] if n_train < 5 else BUCKETS[1] if n_train < 15 else BUCKETS[2]


def evaluate_once(
    seed: int,
    n_users: int = 300,
    n_events: int = 150,
    k: int = 10,
    tag_noise: float = 0.0,
    test_frac: float = 0.2,
    max_cf_weight: float = MAX_CF_WEIGHT,
    content_weights: dict[str, float] | None = None,
    svd_factors: int = SVD_FACTORS,
    full_blend_at: int = FULL_BLEND_AT,
) -> dict:
    """One synthetic dataset -> {system: {"p","r","n"}} plus SVD error metrics."""
    users, events, interactions = generate(n_users=n_users, n_events=n_events, seed=seed, tag_noise=tag_noise)

    # Temporal split: earliest (1 - test_frac) of interactions train, the rest test.
    cut = int(len(interactions) * (1 - test_frac))
    train, test = interactions[:cut], interactions[cut:]

    user_idx = {u.id: i for i, u in enumerate(users)}
    event_idx = {e.id: i for i, e in enumerate(events)}
    event_ids = [e.id for e in events]

    R = cfmod.strength_matrix(train, user_idx, event_idx)
    model = cfmod.SVDModel(svd_factors).fit(R)
    popularity = minmax(np.asarray(R.sum(axis=0)).ravel())
    train_count = np.asarray((R > 0).sum(axis=1)).ravel()

    seen: dict[str, set[str]] = {}
    for it in train:
        seen.setdefault(it.user_id, set()).add(it.event_id)
    relevant: dict[str, set[str]] = {}
    for it in test:
        if it.kind in POSITIVE_KINDS and it.event_id not in seen.get(it.user_id, set()):
            relevant.setdefault(it.user_id, set()).add(it.event_id)

    acc = {s: {"p": [], "r": [], "n": []} for s in SYSTEMS}
    by_bucket = {b: {s: [] for s in SYSTEMS} for b in BUCKETS}
    for u in users:
        rel = relevant.get(u.id)
        if not rel:
            continue
        ui = user_idx[u.id]
        content = content_scores(u, events, popularity, now=None, weights=content_weights)  # no time term offline
        cf = model.scores(ui)
        per_system = {
            "Popularity": popularity,
            "Content-based": content,
            "Collaborative (SVD)": cf,
            "Hybrid": blend(content, cf, int(train_count[ui]), max_cf_weight, full_blend_at),
        }
        for name, sc in per_system.items():
            sc = sc.copy()
            for eid in seen.get(u.id, ()):  # never re-recommend what they've already touched
                sc[event_idx[eid]] = -np.inf
            ranked = [event_ids[j] for j in np.argsort(-sc)]
            acc[name]["p"].append(metrics.precision_at_k(ranked, rel, k))
            acc[name]["r"].append(metrics.recall_at_k(ranked, rel, k))
            acc[name]["n"].append(metrics.ndcg_at_k(ranked, rel, k))
            by_bucket[bucket_of(int(train_count[ui]))][name].append(acc[name]["n"][-1])

    held = cfmod.strength_matrix(test, user_idx, event_idx).tocoo()
    y_true = np.array(held.data)
    y_pred = np.array([model.pred[r, c] for r, c in zip(held.row, held.col)])
    return {
        "systems": {s: {m: float(np.mean(v)) for m, v in d.items()} for s, d in acc.items()},
        "rmse": metrics.rmse(y_true, y_pred),
        "mae": metrics.mae(y_true, y_pred),
        "buckets": {b: {s: (float(np.mean(v)) if v else float("nan")) for s, v in d.items()} for b, d in by_bucket.items()},
        "bucket_sizes": {b: len(d["Hybrid"]) for b, d in by_bucket.items()},
        "n_eval": len(acc["Hybrid"]["p"]),
        "n_interactions": len(interactions),
    }


def run(seeds: list[int], n_users: int, n_events: int, k: int, tag_noise: float) -> dict:
    runs = [evaluate_once(s, n_users, n_events, k, tag_noise) for s in seeds]
    print(
        f"\n{len(seeds)} random datasets | {n_users} users, {n_events} events "
        f"| declared-tag noise {tag_noise:.0%} | K={k} | mean +/- std over datasets\n"
    )
    print(f"{'System':<22}{'Precision@K':>16}{'Recall@K':>16}{'NDCG@K':>16}")
    print("-" * 70)
    summary = {}
    for name in SYSTEMS:
        cells = []
        summary[name] = {}
        for m in ("p", "r", "n"):
            vals = np.array([r["systems"][name][m] for r in runs])
            summary[name][m] = (vals.mean(), vals.std(ddof=1) if len(vals) > 1 else 0.0)
            cells.append(f"{vals.mean():>9.3f} +/-{summary[name][m][1]:.3f}")
        print(f"{name:<22}" + "".join(f"{c:>16}" for c in cells))

    # Paired comparison: in how many datasets does the hybrid beat each baseline on NDCG?
    print("\nHybrid vs each baseline on NDCG@K, paired by dataset:")
    for name in SYSTEMS[:-1]:
        diffs = np.array([r["systems"]["Hybrid"]["n"] - r["systems"][name]["n"] for r in runs])
        print(f"  vs {name:<20} mean diff {diffs.mean():+.3f} | hybrid better in {int((diffs > 0).sum())}/{len(diffs)} datasets")

    print("\nNDCG@K by how much history the user has (mean over datasets):")
    print(f"{'History':<16}{'users/ds':>9}" + "".join(f"{s[:14]:>16}" for s in SYSTEMS))
    for b in BUCKETS:
        size = np.mean([r["bucket_sizes"][b] for r in runs])
        vals = [np.nanmean([r["buckets"][b][s] for r in runs]) for s in SYSTEMS]
        print(f"{b:<16}{size:>9.0f}" + "".join(f"{v:>16.3f}" for v in vals))

    rm = np.array([r["rmse"] for r in runs])
    ma = np.array([r["mae"] for r in runs])
    print(f"\nSVD strength prediction on held-out pairs: RMSE {rm.mean():.2f} +/- {rm.std(ddof=1) if len(rm) > 1 else 0:.2f}"
          f" | MAE {ma.mean():.2f} +/- {ma.std(ddof=1) if len(ma) > 1 else 0:.2f}")
    print("(held-out pairs are mostly unseen, so SVD predicts near zero for them; RMSE/MAE are reported for")
    print(" completeness - ranking metrics above are the meaningful comparison.)")
    print(f"Settings: content weights {CONTENT_WEIGHTS}, max CF weight {MAX_CF_WEIGHT}, SVD factors {SVD_FACTORS}")
    return summary


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--users", type=int, default=300)
    ap.add_argument("--events", type=int, default=150)
    ap.add_argument("--k", type=int, default=10)
    ap.add_argument("--seeds", type=int, default=10, help="number of random datasets (seeds 0..N-1)")
    ap.add_argument("--tag-noise", type=float, default=0.0, help="fraction of users whose declared tags are random")
    a = ap.parse_args()
    run(list(range(a.seeds)), a.users, a.events, a.k, a.tag_noise)
