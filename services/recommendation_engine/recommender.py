# services/recommendation_engine/recommender.py

import math
import pandas as pd
from services.recommendation_engine.priority_matrix import build_priority_matrix

ASCENDING_MAP = {
    "mold_rank": True,
    "etd":       True,
    "capacity":  False,
    "quantity":  False,
}


def recommend_for_machine(
    machine_id: str,
    orders_df: pd.DataFrame,
    mold_spec_df: pd.DataFrame,
    item_spec_df: pd.DataFrame,
    weighted_capacity_matrix: pd.DataFrame,
    priority_matrix: pd.DataFrame,
    criteria: list = ["mold_rank", "etd", "capacity", "quantity"],
) -> pd.DataFrame:
    """Return a prioritized list of orders for a machine."""

    compatible_molds = priority_matrix.loc[machine_id].dropna()
    if compatible_molds.empty:
        return pd.DataFrame()

    mold_item_map = mold_spec_df[
        mold_spec_df['mold_id'].isin(compatible_molds.index)
    ][['mold_id', 'item_type']]

    def best_mold_rank(item_type):
        molds = mold_item_map[mold_item_map['item_type'] == item_type]['mold_id']
        ranks = compatible_molds[compatible_molds.index.isin(molds)]
        if ranks.empty:
            return None, None
        best_mold = ranks.idxmin()
        best_capacity = weighted_capacity_matrix.loc[machine_id, best_mold]
        return ranks.min(), best_capacity

    orders = orders_df.merge(item_spec_df[['item_id', 'item_type']], on='item_id', how='left')
    orders[['mold_rank', 'capacity']] = orders['item_type'].apply(
        lambda t: pd.Series(best_mold_rank(t))
    )
    orders = orders[orders['mold_rank'].notna()].copy()

    ascending = [ASCENDING_MAP[c] for c in criteria]
    orders = orders.sort_values(by=criteria, ascending=ascending).reset_index(drop=True)
    orders.index += 1
    orders.index.name = 'priority'

    return orders[['item_id', 'item_type', 'quantity', 'etd', 'mold_rank', 'capacity']]

def recommend_for_machines(
    machine_ids: list,
    orders_df: pd.DataFrame,
    production_df: pd.DataFrame,
    mold_spec_df: pd.DataFrame,
    item_spec_df: pd.DataFrame,
    weighted_capacity_matrix: pd.DataFrame,
    criteria: list = ["mold_rank", "etd", "capacity", "quantity"],
    shifts_per_day: int = 3,
) -> dict:
    """Assign orders to multiple machines, avoiding duplicates."""

    # Find all molds active in lastest date-shift → remove from matrix
    latest_date  = production_df['date'].max()
    latest_shift = production_df[production_df['date'] == latest_date]['shift'].max()

    active_molds = production_df[
        (production_df['date']  == latest_date) &
        (production_df['shift'] == latest_shift)
    ]['mold_id'].dropna().unique()

    available_matrix = weighted_capacity_matrix.drop(
        columns=[m for m in active_molds if m in weighted_capacity_matrix.columns]
    )

    # Build priority from available matrix (not include active molds)
    priority_matrix = build_priority_matrix(available_matrix)

    assigned_items = set()
    results = {}

    machine_order = sorted(
        machine_ids,
        key=lambda m: priority_matrix.loc[m].notna().sum(),
        reverse=True
    )

    for machine_id in machine_order:
        remaining_orders = orders_df[~orders_df['item_id'].isin(assigned_items)].copy()

        if remaining_orders.empty:
            results[machine_id] = pd.DataFrame()
            continue

        rec = recommend_for_machine(
            machine_id=machine_id,
            orders_df=remaining_orders,
            mold_spec_df=mold_spec_df,
            item_spec_df=item_spec_df,
            weighted_capacity_matrix=available_matrix,
            priority_matrix=priority_matrix,
            criteria=criteria,
        )

        if rec.empty:
            results[machine_id] = rec
            continue

        rec['shifts_needed'] = rec.apply(
            lambda row: _estimate_shifts(row['quantity'], row['capacity']), axis=1
        )
        rec['days_needed'] = rec['shifts_needed'].apply(
            lambda s: math.ceil(s / shifts_per_day) if pd.notna(s) else None
        )

        results[machine_id] = rec

        if not rec.empty:
            assigned_items.add(rec.iloc[0]['item_id'])

    return results


def _estimate_shifts(quantity, capacity):
    if pd.isna(capacity) or capacity <= 0:
        return None
    return math.ceil(quantity / capacity)