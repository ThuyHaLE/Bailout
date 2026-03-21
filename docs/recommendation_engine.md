# Recommendation Engine

## Overview

`recommendation_engine` is a module within `services/` responsible for computing capacity for each (machine, mold) pair and recommending optimal order assignments for each machine based on spec data and historical production records.

---

## Folder Structure

```
services/
├── __init__.py
└── recommendation_engine/
    ├── __init__.py
    ├── default_capacity.py
    ├── historical_capacity.py
    ├── weighted_capacity.py
    ├── priority_matrix.py
    └── recommender.py
```

---

## Pipeline

```
[machine_spec_df]  [mold_spec_df]          → default_capacity.py
                                                      ↓
                                           default_capacity_matrix

[production_df]                            → historical_capacity.py
                                                      ↓
                                      estimated_capacity_matrix + filtered_df

default_capacity_matrix
+ estimated_capacity_matrix + filtered_df  → weighted_capacity.py
                                                      ↓
                                           weighted_capacity_matrix

weighted_capacity_matrix                   → priority_matrix.py
                                                      ↓
                                                priority_matrix

weighted_capacity_matrix + priority_matrix
+ orders_df + mold_spec_df + item_spec_df  → recommender.py
                                                      ↓
                                             recommendation results
```

---

## Modules

### `default_capacity.py`
Computes the **default capacity matrix** based on mold technical specifications and
tonnage compatibility between machines and molds.

- Capacity per shift = `(8 × 3600) / cycle_time × cavity`
- A machine can only run a mold if its tonnage is listed in the mold's `required_tonnage`
  field (format: `50/100/180`)
- Incompatible (machine, mold) pairs → `NaN`

**Input:** `machine_spec_df`, `mold_spec_df`
**Output:** `default_capacity_matrix` — matrix (machine × mold)

---

### `historical_capacity.py`
Computes the **estimated capacity matrix** from actual production history.

- Filters out idle shifts (`total_quantity = 0` or `NaN`)
- Groups by `(machine_id, mold_id)`, computes average `actual_shot` and `actual_cavity`
- `estimated_capacity = avg_shot × avg_cavity`

**Input:** `production_df`
**Output:** `estimated_capacity_matrix`, `filtered_df`

> `filtered_df` is returned for reuse in `weighted_capacity.py`,
> avoiding a redundant second filter pass.

---

### `weighted_capacity.py`
Combines `default_capacity` and `estimated_capacity` into a **weighted capacity matrix**
that accounts for the age of historical data.

#### Time Decay
Production records are bucketed by number of days since the most recent record:

| Bin      | Weight |
|----------|--------|
| 0–30d    | 1.00   |
| 31–60d   | 0.70   |
| 61–90d   | 0.40   |
| 91–180d  | 0.15   |
| >180d    | 0.05   |

#### Weight Computation
`effective_run_count` = total run count weighted by time decay bin.

The estimated weight `w2` is computed via sigmoid:

```
w2_raw = 1 / (1 + exp(-steepness × (effective_run_count - midpoint)))
w2     = w2_raw × (1 - w1_floor)
w1     = 1 - w2
```

| Parameter   | Default | Description                                         |
|-------------|---------|-----------------------------------------------------|
| `midpoint`  | 8       | Run count at which w2 reaches ~50% of its maximum   |
| `steepness` | 0.4     | Rate at which w2 grows with effective_run_count      |
| `w1_floor`  | 0.3     | Default capacity always contributes at least 30%    |

#### Edge Cases
| Case                              | Handling                         |
|-----------------------------------|----------------------------------|
| No historical records             | `w1 = 1, w2 = 0` (100% default) |
| Incompatible tonnage              | `NaN`                            |

**Input:** `machine_spec_df`, `mold_spec_df`, `production_df`
**Output:** `weighted_capacity_matrix` — matrix (machine × mold)

---

### `priority_matrix.py`
Converts `weighted_capacity_matrix` into a **priority matrix** — ranking machines
per mold based on capacity.

- Rank `1` = machine with the highest capacity for that mold
- Rank increases as capacity decreases
- Ties (equal capacity) share the same rank using `method="min"`
- Incompatible pairs → `NaN`

> When no historical data exists, all compatible machines fall back to 100% default
> capacity → equal capacity → all ranked `1`.
> This is **expected behavior** — insufficient data to differentiate.
> Rankings will naturally diverge as production data accumulates.

**Input:** `weighted_capacity_matrix`
**Output:** `priority_matrix` — matrix (machine × mold), dtype `Int64`

---

### `recommender.py`
Recommends order assignments for machines based on `weighted_capacity_matrix`
and `priority_matrix`.

#### `recommend_for_machine` — single machine
1. Retrieve all molds the machine can run (non-`NaN` in `priority_matrix`)
2. Map `item_type → mold`, select the mold with the best rank for this machine
3. Filter orders to those producible on this machine
4. Sort by `criteria`

#### `recommend_for_machines` — multiple machines (cross-check)
- Machines with more compatible molds are assigned first
- Once the top order is assigned to machine 1, it is removed from machine 2's pool
- Prevents two machines from being assigned the same order

#### Sort Criteria (`criteria`)
Passed as a list in priority order:

| Criterion   | Direction  | Description                              |
|-------------|------------|------------------------------------------|
| `mold_rank` | Ascending  | Best-fit mold for this machine first     |
| `etd`       | Ascending  | Earlier delivery deadline first          |
| `capacity`  | Descending | Higher throughput first                  |
| `quantity`  | Descending | Larger backlog first                     |

Default: `["mold_rank", "etd", "capacity", "quantity"]`

#### Completion Time Estimation
- `shifts_needed = ceil(quantity / capacity)`
- `days_needed   = ceil(shifts_needed / shifts_per_day)`

**Input:** `machine_ids`, `orders_df`, `mold_spec_df`, `item_spec_df`, 
`weighted_capacity_matrix`, `priority_matrix`
**Output:** `dict[machine_id → DataFrame]`

---

## Quick Start

```python
from services.recommendation_engine import (
    compute_weighted_capacity_matrix,
    build_priority_matrix,
    recommend_for_machines,
)

# Build matrices
weighted_capacity_matrix = compute_weighted_capacity_matrix(machine_spec_df, mold_spec_df, production_df)
priority_matrix = build_priority_matrix(weighted_capacity_matrix)

# Recommend
results = recommend_for_machines(
    machine_ids=["MD50S-000", "MD50S-001"],
    orders_df=orders_df,
    mold_spec_df=mold_spec_df, 
    item_spec_df=item_spec_df,
    weighted_capacity_matrix=weighted_capacity_matrix,
    priority_matrix=priority_matrix,
    criteria=["mold_rank", "etd", "capacity", "quantity"],
    shifts_per_day=3,
)

for machine_id, rec in results.items():
    print(f"\n=== {machine_id} ===")
    print(rec)
```