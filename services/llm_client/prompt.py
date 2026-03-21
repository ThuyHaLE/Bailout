#services/llm_client/prompt.py

import json
import pandas as pd

def build_prompt(results: dict, 
                  order_tracking: pd.DataFrame, 
                  machine_spec_df: pd.DataFrame) -> str:

    # Prepare context data for LLM
    machines_context = machine_spec_df[
        machine_spec_df['machine_id'].isin(results.keys())
    ][['machine_id', 'machine_name', 'tonnage']].to_dict(orient='records')

    paused_orders = order_tracking[
        order_tracking['status'] == 'paused'
    ][['order_id', 'item_id', 'etd', 'remaining']].to_dict(orient='records')

    recommendations = {}
    for machine_id, rec_df in results.items():
        if rec_df.empty:
            recommendations[machine_id] = []
            continue
        recommendations[machine_id] = (
            rec_df.head(5)
            .assign(etd=rec_df['etd'].astype(str))
            .to_dict(orient='records')
        )

    return f"""

You are a production scheduling assistant for an injection molding plastic factory.
The following are the results computed by the system. Your task is to
EXPLAIN these results in simple language — DO NOT recalculate,
DO NOT change the order or machine assignments.

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
- urgency=high: ETD within 3 days or order is paused
- urgency=medium: ETD within 7 days
- urgency=low: ETD beyond 7 days
- reason must mention ETD, capacity, or machine history
- warnings only for paused orders with approaching ETD
- DO NOT change machine_id or item_id compared to the input
""".strip()