# services/order_tracking/pending.py

import pandas as pd


def extract_pending_orders(order_tracking: pd.DataFrame) -> pd.DataFrame:
    """
    Extract orders waiting for production (pending + paused).
    For paused orders, quantity is replaced with remaining to avoid overproduction.
    Returns a DataFrame with the same columns as orders_df.
    """

    pending = order_tracking[order_tracking['status'] == 'pending'].copy()
    paused  = order_tracking[order_tracking['status'] == 'paused'].copy()

    paused['quantity'] = paused['remaining']

    result = pd.concat([pending, paused], ignore_index=True)

    return result[
        ['received_date', 'order_id', 'etd', 'item_id', 'item_name', 'quantity']
    ].sort_values('etd').reset_index(drop=True)