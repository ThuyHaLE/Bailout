# Orchestrator & LLM Client

## Overview

The **Orchestrator** is the main entry point for Bailout. It coordinates all services — capacity computation, order tracking, recommendation engine, and LLM explanation — into a single request/response cycle triggered by the API layer.

The **LLM Client** sits alongside the orchestrator, responsible for translating structured recommendation data into human-readable output. It does not make scheduling decisions — all ranking and assignment logic lives in the recommendation engine.

---

## Folder Structure

```
orchestrator/
└── orchestrator.py          # BailoutOrchestrator class + _run_recommend helper

services/
└── llm_client/
    ├── __init__.py
    ├── prompt.py             # build_prompt()
    ├── validation.py         # validate(), fallback()
    └── recommendation.py     # generate_recommendation_openai/anthropic()
```

---

## Orchestrator

### Full Pipeline

```
POST /recommend  (machine_ids, file?, use_db)
        ↓
_load_data()                          load all spec + dynamic data
        ↓
compute_weighted_capacity_matrix()    build capacity matrix once
        ↓
track_orders() → extract_pending()    resolve pending + paused orders from DB
        ↓
_run_recommend(uploaded_orders)       try uploaded file first
        ↓ (if no match for some machines)
_run_recommend(db_orders)             fallback to DB for unmatched machines
        ↓
build system_notices[]                log which machines fell back or had no match
        ↓
generate_recommendation_openai()      LLM explains results
        ↓
return output                         JSON response to frontend
```

### Order Source & Fallback Logic

The orchestrator supports two order sources — uploaded file and database — with automatic fallback:

| Scenario | Behavior |
|---|---|
| File upload → all machines match | Use uploaded orders only |
| File upload → some machines no match | Fallback to DB for unmatched machines, log in `system_notices` |
| File upload → no machines match | Use DB for all machines |
| DB only → machines match | Use DB orders |
| DB + file → no machines match at all | Return early with no-recommendation response |

### System Notices

`system_notices` is a list built by the orchestrator before the LLM call. It captures infrastructure-level events that the user should know about, separate from order-level warnings:

```python
system_notices = []

# Fallback notice
if fallback_machines:
    system_notices.append(
        f"No matching orders from uploaded file for: {', '.join(fallback_machines)}. "
        "Showing recommendations from database instead."
    )

# No match notice
if still_no_match:
    system_notices.append(
        f"No compatible orders found for: {', '.join(still_no_match)}. "
        "Please check tonnage compatibility or expand the order list."
    )
```

These notices are passed into `build_prompt()` and the LLM copies them as-is into the `system_notices` field of the output — no rephrasing.

### File Upload Validation

Uploaded files must contain these columns: `item_id`, `quantity`, `etd`.
Missing columns raise HTTP 422 before any processing occurs.

Supported formats: `.xlsx`, `.xls`, `.csv`

---

## LLM Client

### Design Philosophy

The LLM's role is strictly to **explain**, not to **decide**. All ranking,
machine assignment, and capacity logic is handled upstream by the recommendation
engine. The LLM receives a fully computed result and translates it into plain
language.

This separation means:
- Hallucinations cannot affect scheduling logic
- Every LLM output is validated against the system's ground truth
- The fallback path (`fallback()`) always returns a valid response even if the LLM fails

### Modules

#### `prompt.py` — `build_prompt()`

Serializes the recommendation context into a structured prompt. Key sections:

| Section | Content |
|---|---|
| `TODAY'S DATE` | `max(production_df['date'])` — anchor for urgency calculations |
| `MACHINES` | machine_id, machine_name, tonnage for selected machines |
| `RECOMMENDATIONS` | Top 5 ranked orders per machine with ETD, capacity, shifts |
| `PAUSED ORDERS` | order_id, item_id, item_name, etd, remaining for all paused orders |
| `SYSTEM NOTICES` | Pre-generated notices from orchestrator — LLM copies as-is |

**Urgency rules passed to LLM:**
- `high` — ETD within 3 days, order is paused, or ETD already passed
- `medium` — ETD within 7 days
- `low` — ETD beyond 7 days

**Warning rules:**
- Must include ALL paused orders — both approaching ETD and overdue
- Each warning must include: order_id, item_id, item_name, remaining quantity, ETD, and whether it is overdue or approaching

#### `validation.py` — `validate()` / `fallback()`

Validates LLM output against the system's ground truth before returning to the user. Catches hallucinations before they reach the frontend.

**Validation rules:**

| Rule | Check |
|---|---|
| `valid_machine_id` | machine_id must be in results.keys() |
| `valid_item_id` | item_id must be in top 5 of that machine's results |
| `machine_assignment_match` | LLM cannot swap machine assignments |
| `top_pick_matches_priority_1` | top_pick must be rank 1 from the system |
| `urgency_high_for_paused` | paused orders must have urgency=high |
| `urgency_high_for_overdue` | ETD already passed must have urgency=high |
| `valid_urgency_enum` | urgency must be high, medium, or low |
| `warnings_required_for_paused` | warnings cannot be empty when paused orders exist |

If validation fails, `fallback()` is called — it returns the system's recommendation directly without LLM explanation, with a notice that the LLM response could not be parsed.

#### `recommendation.py` — `generate_recommendation_openai()`

Calls the LLM API, parses the JSON response, runs validation, and returns
the final output dict. Also tracks token usage and cost per call.

**Output shape:**

```json
{
  "machines": [
    {
      "machine_id": "...",
      "machine_name": "...",
      "top_pick": {
        "item_id": "...",
        "reason": "...",
        "urgency": "high|medium|low",
        "urgency_reason": "..."
      },
      "next_picks": ["item_id_2", "item_id_3"]
    }
  ],
  "warnings": ["order-level warnings — paused, overdue"],
  "system_notices": ["infrastructure notices — fallback, no-match"],
  "summary": "2-3 sentence shift summary",
  "validation": { "passed": true, "checks": [...] },
  "usage": {
    "model": "gpt-4o",
    "input_tokens": 1502,
    "output_tokens": 364,
    "input_cost": 0.003755,
    "output_cost": 0.003640,
    "total_cost": 0.007395
  }
}
```

**Separation of concerns in output:**

| Field | Source | Content |
|---|---|---|
| `warnings` | LLM | Order-level: paused orders, overdue ETDs |
| `system_notices` | Orchestrator → LLM copies as-is | Infrastructure: fallback, no-match |
| `validation` | `validate()` | Hallucination checks against ground truth |
| `usage` | API response | Token counts and cost tracking |

---

## Quick Start

```python
from orchestrator.orchestrator import BailoutOrchestrator

orchestrator = BailoutOrchestrator()

# Via FastAPI route — file upload
result = await orchestrator.run(
    machine_ids=["MD50S-000", "MD50S-001"],
    file=uploaded_file,        # UploadFile or None
    use_db=False,
)

# Via FastAPI route — use DB orders
result = await orchestrator.run(
    machine_ids=["MD50S-000", "MD50S-001"],
    file=None,
    use_db=True,
)

print(result["summary"])
print(result["system_notices"])
print(result["usage"])
```