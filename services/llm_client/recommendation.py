# services/llm_client/recommendation.py
import json
import os
import pandas as pd
from dotenv import load_dotenv

from services.llm_client.prompt import build_prompt
from services.llm_client.validation import validate, fallback

load_dotenv()

def generate_recommendation_openai(
    results: dict,
    order_tracking: pd.DataFrame,
    machine_spec_df: pd.DataFrame,
    model: str = "gpt-4o",
) -> dict:
    import openai

    prompt = build_prompt(results, order_tracking, machine_spec_df)
    client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    response = client.chat.completions.create(
        model=model,
        max_tokens=1000,
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.choices[0].message.content.strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return fallback(results, machine_spec_df)

    validation = validate(parsed, results, order_tracking)

    if not validation["passed"]:
        return {**fallback(results, machine_spec_df), "validation": validation}

    return {**parsed, "validation": validation}