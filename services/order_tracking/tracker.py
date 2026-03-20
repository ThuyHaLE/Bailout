# services/order_tracking/tracker.py

import pandas as pd


def track_orders(orders_df: pd.DataFrame, production_df: pd.DataFrame) -> pd.DataFrame:
    """
    Track production status for each order.

    Status:
        - pending    : no production record found
        - molded     : production started, quantity fully completed
        - processing : production started, still remaining,
                       and last shift of latest date has production record
        - paused     : production started, still remaining,
                       but last shift of latest date has no record
    """

    # Latest date + latest shift across all production records
    latest_date = production_df['date'].max()
    latest_shift = production_df[production_df['date'] == latest_date]['shift'].max()

    # Aggregate production by order_id (po_note) and item_id
    produced = (
        production_df.groupby(['po_note', 'item_id'])
        .agg(
            produced_quantity=('total_quantity', 'sum'),
            last_run_date=('date', 'max'),
        )
        .reset_index()
        .rename(columns={'po_note': 'order_id'})
    )

    # Check if order ran on latest_date AND latest_shift
    last_shift_records = production_df[
        (production_df['date'] == latest_date) &
        (production_df['shift'] == latest_shift)
    ][['po_note', 'item_id']].drop_duplicates()
    last_shift_records = last_shift_records.rename(columns={'po_note': 'order_id'})
    last_shift_records['ran_last_shift'] = True

    produced = produced.merge(last_shift_records, on=['order_id', 'item_id'], how='left')
    produced['ran_last_shift'] = produced['ran_last_shift'].notna()

    # Merge orders with production summary
    tracked = orders_df.merge(produced, on=['order_id', 'item_id'], how='left')
    tracked['produced_quantity'] = tracked['produced_quantity'].fillna(0)
    tracked['remaining'] = (tracked['quantity'] - tracked['produced_quantity']).clip(lower=0)

    # Status logic
    def resolve_status(row):
        if row['produced_quantity'] == 0:
            return 'pending'
        if row['remaining'] == 0:
            return 'molded'
        if not row['ran_last_shift']:
            return 'paused'
        return 'processing'

    tracked['status'] = tracked.apply(resolve_status, axis=1)

    return tracked[[
        'order_id', 'item_id', 'item_name', 'received_date', 'etd',
        'quantity', 'produced_quantity', 'remaining', 'status', 'last_run_date'
    ]].sort_values(['status', 'etd']).reset_index(drop=True)