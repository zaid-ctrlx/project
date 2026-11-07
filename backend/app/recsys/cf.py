"""Collaborative filtering: truncated SVD over the user x event implicit
feedback matrix. Pure numpy/scipy - the `surprise` library is explicit-rating
oriented and needs a C toolchain on Windows; this is the same factorisation."""
import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.linalg import svds

from app.recsys.config import INTERACTION_WEIGHTS, MAX_STRENGTH, SVD_FACTORS
from app.recsys.types import Interact


def strength_matrix(
    interactions: list[Interact], user_idx: dict[str, int], event_idx: dict[str, int]
) -> csr_matrix:
    """Sum interaction weights per (user, event), capped at MAX_STRENGTH."""
    acc: dict[tuple[int, int], float] = {}
    for it in interactions:
        u, e = user_idx.get(it.user_id), event_idx.get(it.event_id)
        if u is None or e is None:
            continue
        acc[(u, e)] = acc.get((u, e), 0.0) + INTERACTION_WEIGHTS.get(it.kind, 0.0)
    rows = [k[0] for k in acc]
    cols = [k[1] for k in acc]
    vals = [min(v, MAX_STRENGTH) for v in acc.values()]
    return csr_matrix((vals, (rows, cols)), shape=(len(user_idx), len(event_idx)))


class SVDModel:
    def __init__(self, factors: int = SVD_FACTORS):
        self.factors = factors
        self.pred: np.ndarray | None = None  # dense (users x events) reconstruction

    def fit(self, R: csr_matrix) -> "SVDModel":
        k = min(self.factors, min(R.shape) - 1)
        if k < 1 or R.nnz == 0:
            self.pred = np.zeros(R.shape)
            return self
        u, s, vt = svds(R.astype(float), k=k)
        self.pred = (u * s) @ vt
        return self

    def scores(self, user_i: int) -> np.ndarray:
        assert self.pred is not None, "fit() first"
        return self.pred[user_i]
