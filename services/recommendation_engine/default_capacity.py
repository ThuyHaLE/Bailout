# services/recommendation_engine/default_capacity.py

import pandas as pd

SHIFT_HOURS = 8

def compute_default_capacity_matrix(
    machine_spec_df: pd.DataFrame,
    mold_spec_df: pd.DataFrame,
) -> pd.DataFrame:
    """
    Calculate default capacity matrix based on tonnage compatibility.
    rows = machine_id, columns = mold_id, values = default_capacity (pcs/shift)
    NaN = machine cannot run this mold.
    """
    mold_spec_df = mold_spec_df.copy()
    mold_spec_df['default_capacity'] = (
        (SHIFT_HOURS * 3600) / mold_spec_df['default_cycle_time'] * mold_spec_df['default_cavity']
    )

    matrix = pd.DataFrame(
        index=machine_spec_df['machine_id'],
        columns=mold_spec_df['mold_id'],
        dtype=float
    )

    for _, machine in machine_spec_df.iterrows():
        for _, mold in mold_spec_df.iterrows():
            if _is_compatible(machine['tonnage'], mold['required_tonnage']):
                matrix.loc[machine['machine_id'], mold['mold_id']] = mold['default_capacity']

    matrix.index.name = 'machine_id'
    matrix.columns.name = 'mold_id'
    return matrix


def _is_compatible(machine_tonnage, required_tonnage_str) -> bool:
    if pd.isna(required_tonnage_str):
        return False
    allowed = [int(x.strip()) for x in str(required_tonnage_str).split('/')]
    return machine_tonnage in allowed