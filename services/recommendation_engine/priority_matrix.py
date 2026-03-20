# services/recommendation_engine/priority_matrix.py

import pandas as pd

def build_priority_matrix(weighted_capacity_matrix: pd.DataFrame) -> pd.DataFrame:
    """
    Rank machines for each mold based on capacity.
    Rank 1 = highest capacity, NaN = not compatible.
    """
    priority_matrix = weighted_capacity_matrix.rank(
        axis=0, ascending=False, na_option='bottom', method='min'
    )
    priority_matrix = priority_matrix.where(weighted_capacity_matrix.notna())
    priority_matrix = priority_matrix.apply(lambda col: col.astype('Int64'))
    return priority_matrix