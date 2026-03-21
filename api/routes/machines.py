# api/routes/machines.py
import pandas as pd
from fastapi import APIRouter

router = APIRouter()

def _load_machines() -> list:
    df = pd.read_excel('mock_database/static/machine_spec.xlsx')
    return df[['machine_id', 'machine_name', 'tonnage', 'model']].to_dict(orient='records')

@router.get("/machines")
def get_machines():
    return _load_machines()