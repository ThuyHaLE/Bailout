# api/routes/recommend.py
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import List, Optional
from orchestrator.orchestrator import BailoutOrchestrator

router = APIRouter()
orchestrator = BailoutOrchestrator()

@router.post("/recommend")
async def recommend(
    machine_ids: List[str]            = Form(...),
    file:        Optional[UploadFile] = File(None),
    use_db:      bool                 = Form(False),
):
    if not machine_ids:
        raise HTTPException(status_code=422, detail="Cần chọn ít nhất 1 máy")
    if not file and not use_db:
        raise HTTPException(status_code=422, detail="Cần upload file hoặc chọn use_db=true")

    return await orchestrator.run(machine_ids, file, use_db)