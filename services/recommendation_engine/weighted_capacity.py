# services/recommendation_engine/weighted_capacity.py

import math
import pandas as pd
from collections import defaultdict

BINS = [
    {"label": "0-30d",   "days": 30},
    {"label": "31-60d",  "days": 60},
    {"label": "61-90d",  "days": 90},
    {"label": "91-180d", "days": 180},
    {"label": ">180d",   "days": None},
]

BIN_COUNT_WEIGHT = {
    "0-30d":   1.00,
    "31-60d":  0.70,
    "61-90d":  0.40,
    "91-180d": 0.15,
    ">180d":   0.05,
}


def compute_weighted_capacity_matrix(
    default_capacity_matrix: pd.DataFrame,
    estimated_capacity_matrix: pd.DataFrame,
    filtered_df: pd.DataFrame,
    midpoint: float = 8,
    steepness: float = 0.4,
    w1_floor: float = 0.3,
) -> pd.DataFrame:
    """
    Combine default và estimated capacity weighted based on time decay.
    - No historical data → 100% default (w1 = 1, w2 = 0)
    - Not compatible (tonnage) → NaN
    """
    logs = filtered_df[['date', 'machine_id', 'mold_id']].to_dict(orient='records')
    anchor = max(l['date'] for l in logs)

    weighted_capacity_matrix = default_capacity_matrix.copy()

    for machine_id in default_capacity_matrix.index:
        for mold_id in default_capacity_matrix.columns:
            default_cap = default_capacity_matrix.loc[machine_id, mold_id]

            if pd.isna(default_cap):
                continue

            estimated_cap = (
                estimated_capacity_matrix.loc[machine_id, mold_id]
                if machine_id in estimated_capacity_matrix.index
                and mold_id in estimated_capacity_matrix.columns
                else None
            )

            if pd.isna(estimated_cap):
                weighted_capacity_matrix.loc[machine_id, mold_id] = default_cap
                continue

            bin_dist = _extract_bin_distribution(logs, anchor, machine_id, mold_id)
            w1, w2 = _compute_weights(bin_dist, midpoint, steepness, w1_floor)

            weighted_capacity_matrix.loc[machine_id, mold_id] = round(
                w1 * default_cap + w2 * estimated_cap, 2
            )

    return weighted_capacity_matrix


def _extract_bin_distribution(logs, anchor, machine_id, mold_id) -> dict:
    filtered = [
        l for l in logs
        if l['machine_id'] == machine_id and l['mold_id'] == mold_id
    ]
    if not filtered:
        return None

    distribution = defaultdict(int)
    for log in filtered:
        days_ago = (anchor - log['date']).days
        label = next(
            (b['label'] for b in BINS if b['days'] is None or days_ago <= b['days']),
            '>180d'
        )
        distribution[label] += 1

    return {b['label']: distribution[b['label']] for b in BINS}


def _compute_weights(
    bin_distribution: dict,
    midpoint: float,
    steepness: float,
    w1_floor: float,
) -> tuple[float, float]:
    effective_run_count = sum(
        count * BIN_COUNT_WEIGHT[label]
        for label, count in bin_distribution.items()
    )
    w2_raw = 1 / (1 + math.exp(-steepness * (effective_run_count - midpoint)))
    w2 = w2_raw * (1 - w1_floor)
    w1 = 1 - w2
    return round(w1, 4), round(w2, 4)