# services/recommendation_engine/historical_capacity.py

import pandas as pd

def compute_estimated_capacity_matrix(production_df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Calculate estimated capacity from historical production data.
    Returns a tuple of:
        - estimated_capacity_matrix: rows = machine_id, columns = mold_id
        - filtered_df: production_df already filtered for idle shifts (used for weighted_capacity)
    """
    idle_mask = (
        production_df['total_quantity'].isna() |
        (production_df['total_quantity'] == 0)
    )
    filtered_df = production_df[~idle_mask].copy()

    historical_capacity_df = (
        filtered_df.groupby(['machine_id', 'mold_id'])
        .agg(
            avg_shot=('actual_shot', 'mean'),
            avg_cavity=('actual_cavity', 'mean')
        )
        .reset_index()
    )
    historical_capacity_df['estimated_capacity'] = (
        historical_capacity_df['avg_shot'] * historical_capacity_df['avg_cavity']
    )

    estimated_capacity_matrix = historical_capacity_df.pivot(
        index='machine_id',
        columns='mold_id',
        values='estimated_capacity'
    )

    return estimated_capacity_matrix, filtered_df