"""Ranking metrics (Precision@K, Recall@K, NDCG@K) and error metrics."""
import math

import numpy as np


def precision_at_k(ranked: list[str], relevant: set[str], k: int) -> float:
    return sum(1 for x in ranked[:k] if x in relevant) / k


def recall_at_k(ranked: list[str], relevant: set[str], k: int) -> float:
    return sum(1 for x in ranked[:k] if x in relevant) / len(relevant) if relevant else 0.0


def ndcg_at_k(ranked: list[str], relevant: set[str], k: int) -> float:
    dcg = sum(1.0 / math.log2(i + 2) for i, x in enumerate(ranked[:k]) if x in relevant)
    ideal = sum(1.0 / math.log2(i + 2) for i in range(min(len(relevant), k)))
    return dcg / ideal if ideal else 0.0


def rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.sqrt(np.mean((y_true - y_pred) ** 2))) if len(y_true) else float("nan")


def mae(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.mean(np.abs(y_true - y_pred))) if len(y_true) else float("nan")
