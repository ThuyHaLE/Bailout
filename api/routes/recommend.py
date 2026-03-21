# api/routes/recommend.py
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import List, Optional
from orchestrator.orchestrator import BailoutOrchestrator
import pandas as pd

router = APIRouter()
orchestrator = BailoutOrchestrator()

@router.get("/orders/pending")
def get_pending_orders():
    """Preview pending + paused orders từ DB."""
    from services.order_tracking import track_orders, extract_pending_orders
    db = {
        "production_df": pd.read_excel('mock_database/dynamic/production_reports.xlsx'),
        "orders_df":     pd.read_excel('mock_database/dynamic/purchase_orders.xlsx'),
    }
    order_tracking = track_orders(db["orders_df"], db["production_df"])
    pending = extract_pending_orders(order_tracking)
    return pending.to_dict(orient="records")

@router.post("/recommend")
async def recommend(
    machine_ids: List[str] = Form(...),
    file: Optional[UploadFile] = File(None),
    use_db: str = Form("false"),
):  
    use_db_bool = use_db.lower() == "true"

    if not machine_ids:
        raise HTTPException(status_code=422, detail="Cần chọn ít nhất 1 máy")
    if not file and not use_db:
        raise HTTPException(status_code=422, detail="Cần upload file hoặc chọn use_db=true")
    return await orchestrator.run(machine_ids, file, use_db_bool)