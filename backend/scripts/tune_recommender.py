"""Choose the recommender's hyper-parameters on VALIDATION data only.

Grid-searches the number of SVD factors and the maximum collaborative weight on
synthetic datasets with seeds 100-104. The reported results in
`scripts.evaluate_recommender` use different seeds (0-9), so the numbers you
quote were never used to pick the settings (no tuning on the test set).

The objective is mean NDCG@K of the hybrid averaged over three scenarios -
declared tags 0%, 30% and 60% unreliable - so the chosen setting is robust
rather than fitted to one assumption about data quality.

    python -m scripts.tune_recommender
"""
import itertools

import numpy as np

from scripts.evaluate_recommender import evaluate_once

VALIDATION_SEEDS = [100, 101, 102, 103, 104]
TAG_NOISES = [0.0, 0.3, 0.6]
FACTORS = [5]  # 3-6 were tied in an earlier sweep; fixed to 5 here
FULL_AT = [10, 15, 25, 40]  # interaction count at which CF reaches its max weight
MAX_CF = [0.5, 0.7, 0.9]  # capped at 0.9 on purpose: content signals always keep a voice


def main() -> None:
    rows = []
    for f, w, fa in itertools.product(FACTORS, MAX_CF, FULL_AT):
        scores = []
        for noise in TAG_NOISES:
            for seed in VALIDATION_SEEDS:
                r = evaluate_once(seed, tag_noise=noise, max_cf_weight=w, svd_factors=f, full_blend_at=fa)
                scores.append(r["systems"]["Hybrid"]["n"])
        rows.append((float(np.mean(scores)), f, w, fa))
    rows.sort(reverse=True)
    print(f"Validation seeds {VALIDATION_SEEDS}, tag-noise scenarios {TAG_NOISES}; objective = hybrid NDCG@10\n")
    print(f"{'SVD factors':>12}{'max CF weight':>15}{'full blend at':>15}{'mean NDCG@10':>15}")
    for score, f, w, fa in rows:
        print(f"{f:>12}{w:>15.1f}{fa:>15}{score:>15.4f}")
    best = rows[0]
    print(f"\nBest: SVD_FACTORS={best[1]}, MAX_CF_WEIGHT={best[2]}, FULL_BLEND_AT={best[3]}  (NDCG@10 {best[0]:.4f})")


if __name__ == "__main__":
    main()
