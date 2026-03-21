import json
import pandas as pd


def build_prompt(
    results: dict,
    order_tracking: pd.DataFrame,
    machine_spec_df: pd.DataFrame,
    production_df: pd.DataFrame,
) -> str:

    today     = production_df['date'].max()
    today_str = today.strftime("%Y-%m-%d")

    machines_context = machine_spec_df[
        machine_spec_df['machine_id'].isin(results.keys())
    ][['machine_id', 'machine_name', 'tonnage']].to_dict(orient='records')

    paused_orders = order_tracking[
        order_tracking['status'] == 'paused'
    ][['order_id', 'item_id', 'item_name', 'etd', 'remaining']].to_dict(orient='records')

    # Lookup order_id + item_name từ order_tracking
    order_lookup = order_tracking.set_index('item_id')[['order_id', 'item_name']].to_dict(orient='index')

    recommendations = {}
    for machine_id, rec_df in results.items():
        if rec_df.empty:
            recommendations[machine_id] = []
            continue

        rows = []
        for row in rec_df.head(5).to_dict(orient='records'):
            item_id = row['item_id']
            meta    = order_lookup.get(item_id, {})
            rows.append({
                **row,
                "order_id":  meta.get('order_id', ''),
                "item_name": meta.get('item_name', ''),
                "etd":       str(row['etd']),
            })
        recommendations[machine_id] = rows

    return f"""
You are a production scheduling assistant for an injection molding plastic factory.
The following are the results computed by the system. Your task is to
EXPLAIN these results in simple language — DO NOT recalculate,
DO NOT change the order or machine assignments.

TODAY'S DATE: {today_str}
Use this date as the reference point for all urgency calculations (ETD within 3 days, 7 days, etc.)

MACHINES:
{json.dumps(machines_context, ensure_ascii=False, indent=2)}

RECOMMENDATIONS (already ranked and assigned by the system):
{json.dumps(recommendations, ensure_ascii=False, indent=2, default=str)}

PAUSED ORDERS (need attention):
{json.dumps(paused_orders, ensure_ascii=False, indent=2, default=str)}

Return the following JSON, with no text outside of the JSON:
{{
  "machines": [
    {{
      "machine_id": "...",
      "machine_name": "...",
      "top_pick": {{
        "item_id": "...",
        "item_name": "...",
        "order_id": "...",
        "reason": "explanation of why this is the best choice based on ETD, capacity, or machine history",
        "urgency": "high|medium|low",
        "urgency_reason": "reason for the urgency level"
      }},
      "next_picks": ["item_id_2", "item_id_3"]
    }}
  ],
  "warnings": ["warning if there are paused orders approaching ETD"],
  "summary": "summary of 2-3 sentences for the entire shift"
}}

Rules:
- urgency=high: ETD within 3 days from {today_str}, OR order is paused, OR ETD already passed
- urgency=medium: ETD within 7 days from {today_str}
- urgency=low: ETD beyond 7 days from {today_str}
- If ETD has already passed, urgency_reason must mention it is overdue
- reason must mention ETD, capacity, or machine history
- warnings only for paused orders with approaching ETD or already overdue
- DO NOT change machine_id, item_id, item_name, or order_id compared to the input
""".strip()