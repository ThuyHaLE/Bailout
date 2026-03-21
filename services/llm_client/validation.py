# services/llm_client/validation.py
import pandas as pd

def validate(
    llm_output: dict,
    results: dict,
    order_tracking: pd.DataFrame,
    today: pd.Timestamp,
) -> dict:
    checks = []
    passed = True

    # Build lookup table from results, adding is_overdue
    item_map = {}
    for machine_id, rec_df in results.items():
        if rec_df.empty:
            continue
        for row in rec_df.head(5).to_dict(orient='records'):
            etd = pd.to_datetime(row.get('etd'))
            is_overdue = bool(pd.notna(etd) and etd < today)
            item_map[row['item_id']] = {
                **row,
                'machine_id': machine_id,
                'is_overdue': is_overdue,
            }

    valid_machine_ids = set(results.keys())

    paused_item_ids = set(
        order_tracking[order_tracking['status'] == 'paused']['item_id'].tolist()
    )

    for m in llm_output.get("machines", []):
        machine_id = m.get("machine_id")
        top_pick   = m.get("top_pick", {})
        item_id    = top_pick.get("item_id")
        urgency    = top_pick.get("urgency")

        # 1. machine_id must be valid (appear in results)
        ok = machine_id in valid_machine_ids
        checks.append({
            "rule":     "valid_machine_id",
            "item":     machine_id,
            "expected": f"one of {list(valid_machine_ids)}",
            "actual":   machine_id,
            "ok":       ok,
        })
        if not ok: passed = False

        # 2. item_id must be valid (appear in results)
        ok = item_id in item_map
        checks.append({
            "rule":     "valid_item_id",
            "item":     item_id,
            "expected": f"one of {list(item_map.keys())}",
            "actual":   item_id,
            "ok":       ok,
        })
        if not ok:
            passed = False
            continue

        # 3. machine assignment must match results
        expected_machine = item_map[item_id]['machine_id']
        ok = machine_id == expected_machine
        checks.append({
            "rule":     "machine_assignment_match",
            "item":     item_id,
            "expected": expected_machine,
            "actual":   machine_id,
            "ok":       ok,
        })
        if not ok: passed = False

        # 4. urgency=high if order is paused
        if item_id in paused_item_ids:
            ok = urgency == "high"
            checks.append({
                "rule":     "urgency_high_for_paused",
                "item":     item_id,
                "expected": "high (paused order)",
                "actual":   urgency,
                "ok":       ok,
            })
            if not ok: passed = False

        # 5. urgency=high if ETD already passed
        if item_map[item_id]['is_overdue']:
            ok = urgency == "high"
            checks.append({
                "rule":     "urgency_high_for_overdue",
                "item":     item_id,
                "expected": f"high (ETD already passed, today={today.date()})",
                "actual":   urgency,
                "ok":       ok,
            })
            if not ok: passed = False

        # 6. urgency enum must be valid
        ok = urgency in {"high", "medium", "low"}
        checks.append({
            "rule":     "valid_urgency_enum",
            "item":     item_id,
            "expected": "high|medium|low",
            "actual":   urgency,
            "ok":       ok,
        })
        if not ok: passed = False

    # 7. top_pick must be priority=1 in results
    for m in llm_output.get("machines", []):
        machine_id = m.get("machine_id")
        item_id    = m.get("top_pick", {}).get("item_id")
        if machine_id not in results or results[machine_id].empty:
            continue
        expected_top = results[machine_id].iloc[0]['item_id']
        ok = item_id == expected_top
        checks.append({
            "rule":     "top_pick_matches_priority_1",
            "item":     item_id,
            "expected": expected_top,
            "actual":   item_id,
            "ok":       ok,
        })
        if not ok: passed = False

    # 8. warnings must not empty if there are paused orders
    if paused_item_ids:
        has_warnings = bool(llm_output.get("warnings"))
        checks.append({
            "rule":     "warnings_required_for_paused",
            "item":     "ALL",
            "expected": "warnings not empty when paused orders exist",
            "actual":   "present" if has_warnings else "missing",
            "ok":       has_warnings,
        })
        if not has_warnings: passed = False

    return {"passed": passed, "checks": checks}


def fallback(results: dict, machine_spec_df: pd.DataFrame) -> dict:
    machines = []
    for machine_id, rec_df in results.items():
        machine_name = machine_spec_df[
            machine_spec_df['machine_id'] == machine_id
        ]['machine_name'].values
        machine_name = machine_name[0] if len(machine_name) else machine_id

        top_item = rec_df.iloc[0]['item_id'] if not rec_df.empty else None
        machines.append({
            "machine_id":    machine_id,
            "machine_name":  machine_name,
            "top_pick": {
                "item_id":        top_item,
                "reason":         "LLM parse error — fallback to system recommendation",
                "urgency":        "low",
                "urgency_reason": "N/A",
            },
            "next_picks": rec_df.iloc[1:3]['item_id'].tolist() if len(rec_df) > 1 else [],
        })

    return {
        "machines": machines,
        "warnings": ["LLM response could not be parsed — showing system recommendation only."],
        "summary":  "System could not generate explanation. Results below are computed directly by the system.",
    }