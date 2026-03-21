# orchestrator/orchestrator.py
import io
import pandas as pd
from fastapi import HTTPException, UploadFile
from typing import List, Optional

from services.recommendation_engine import recommend_for_machines
from services.recommendation_engine.weighted_capacity import compute_weighted_capacity_matrix
from services.order_tracking import track_orders, extract_pending_orders
from services.llm_client.recommendation import generate_recommendation_openai
from services.llm_client.schema import empty_response

def _load_data() -> dict:
    return {
        "production_df":   pd.read_excel('mock_database/dynamic/production_reports.xlsx'),
        "orders_df":       pd.read_excel('mock_database/dynamic/purchase_orders.xlsx'),
        "mold_spec_df":    pd.read_excel('mock_database/static/mold_spec.xlsx'),
        "machine_spec_df": pd.read_excel('mock_database/static/machine_spec.xlsx'),
        "item_spec_df":    pd.read_excel('mock_database/static/item_spec.xlsx'),
    }


def _run_recommend(machine_ids, orders_df, db, weighted_capacity_matrix) -> dict:
    """Run recommend_for_machines and return only non-empty results."""
    results = recommend_for_machines(
        machine_ids=machine_ids,
        orders_df=orders_df,
        production_df=db["production_df"],
        mold_spec_df=db["mold_spec_df"],
        item_spec_df=db["item_spec_df"],
        weighted_capacity_matrix=weighted_capacity_matrix,
        criteria=["mold_rank", "etd", "capacity", "quantity"],
        shifts_per_day=3,
    )
    return {k: v for k, v in results.items() if not v.empty}


class BailoutOrchestrator:

    async def run(
        self,
        machine_ids: List[str],
        file: Optional[UploadFile],
        use_db: bool,
    ) -> dict:

        # ── 1. Load data ───────────────────────────────────────────────────────
        db = _load_data()

        # ── 2. Build weighted capacity matrix ─────────────────────────────────
        weighted_capacity_matrix = compute_weighted_capacity_matrix(
            machine_spec_df=db["machine_spec_df"],
            mold_spec_df=db["mold_spec_df"],
            production_df=db["production_df"],
        )

        # ── 3. Track orders ───────────────────────────────────────────────────
        order_tracking = track_orders(db["orders_df"], db["production_df"])
        db_orders      = extract_pending_orders(order_tracking)

        # ── 4. Resolve orders + fallback logic ────────────────────────────────
        fallback_machines = []   # track machines that need fallback to DB

        if file:
            uploaded_orders = await self._parse_file(file)
            results = _run_recommend(machine_ids, uploaded_orders, db, weighted_capacity_matrix)

            # Machines that don't have recommendations from the file → fallback to DB
            no_match = [m for m in machine_ids if m not in results]
            if no_match:
                db_results = _run_recommend(no_match, db_orders, db, weighted_capacity_matrix)
                results.update(db_results)
                fallback_machines = [m for m in no_match if m in db_results]  # these machines had no match in the file but got a match from the DB

        else:
            results = _run_recommend(machine_ids, db_orders, db, weighted_capacity_matrix)

        # ── 5. Build system notices ───────────────────────────────────────────

        # Machines that still don't have recommendations despite fallback to DB

        still_no_match = [m for m in machine_ids if m not in results]
        system_notices = []

        if fallback_machines:
            system_notices.append(
                f"No matching orders from uploaded file for: {', '.join(fallback_machines)}. "
                "Showing recommendations from database instead."
            )

        if still_no_match:
            system_notices.append(
                f"No compatible orders found for: {', '.join(still_no_match)}. "
                "Please check tonnage compatibility or expand the order list."
            )

        # ── 6. Generate explanation ───────────────────────────────────────────
        valid_results = {k: v for k, v in results.items() if v is not None and not v.empty}

        if not valid_results:
            return empty_response(system_notices)

        output = generate_recommendation_openai(
            results=valid_results,
            order_tracking=order_tracking,
            machine_spec_df=db["machine_spec_df"],
            production_df=db["production_df"],
            system_notices=system_notices,
        )

        return output

    async def _parse_file(self, file: UploadFile) -> pd.DataFrame:
        contents = await file.read()
        df = (
            pd.read_csv if file.filename.endswith(".csv")
            else pd.read_excel
        )(io.BytesIO(contents))

        df.columns = df.columns.str.strip().str.lower()

        missing = {"item_id", "quantity", "etd"} - set(df.columns)
        if missing:
            raise HTTPException(
                status_code=422,
                detail=f"Missing required columns: {missing}"
            )

        return df