# orchestrator/orchestrator.py
import io
import pandas as pd
from fastapi import HTTPException, UploadFile
from typing import List, Optional

from services.recommendation_engine import recommend_for_machines
from services.recommendation_engine.weighted_capacity import compute_weighted_capacity_matrix
from services.order_tracking import track_orders, extract_pending_orders
from services.llm_client.recommendation import generate_recommendation_openai


def _load_data() -> dict:
    return {
        "production_df":   pd.read_excel('mock_database/dynamic/production_reports.xlsx'),
        "orders_df":       pd.read_excel('mock_database/dynamic/purchase_orders.xlsx'),
        "mold_spec_df":    pd.read_excel('mock_database/static/mold_spec.xlsx'),
        "machine_spec_df": pd.read_excel('mock_database/static/machine_spec.xlsx'),
        "item_spec_df":    pd.read_excel('mock_database/static/item_spec.xlsx'),
    }


class BailoutOrchestrator:

    async def run(
        self,
        machine_ids: List[str],
        file: Optional[UploadFile],
        use_db: bool,
    ) -> dict:

        # ── 1. Load static + dynamic data ─────────────────────────────────────
        db = _load_data()

        # ── 2. Build weighted capacity matrix ─────────────────────────────────
        weighted_capacity_matrix = compute_weighted_capacity_matrix(
            machine_spec_df=db["machine_spec_df"],
            mold_spec_df=db["mold_spec_df"],
            production_df=db["production_df"],
        )

        # ── 3. Track orders ───────────────────────────────────────────────────
        order_tracking = track_orders(db["orders_df"], db["production_df"])

        # ── 4. Resolve orders_df: upload > db ─────────────────────────────────
        if file:
            orders_df = await self._parse_file(file)
        else:
            orders_df = extract_pending_orders(order_tracking)

        # ── 5. Recommend ──────────────────────────────────────────────────────
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

        # ── 6. Generate explanation ───────────────────────────────────────────
        output = generate_recommendation_openai(
            results=results,
            order_tracking=order_tracking,
            machine_spec_df=db["machine_spec_df"],
            production_df=db["production_df"],
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
                detail=f"File thiếu cột: {missing}"
            )

        return df