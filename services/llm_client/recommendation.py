# services/llm_client/recommendation.py
import json
import os
import pandas as pd
from dotenv import load_dotenv

from services.llm_client.prompt import build_prompt
from services.llm_client.validation import validate, fallback

load_dotenv()

OPENAI_PRICING = {
    "gpt-4o":      {"input": 2.50,  "output": 10.00},
    "gpt-4o-mini": {"input": 0.15,  "output": 0.60},
    "o3-mini":     {"input": 1.10,  "output": 4.40},
}

def empty_response(system_notices: list = []) -> dict:
    """
    Return a valid response shape when no recommendations are available.
    Skips LLM call entirely.
    """
    return {
        "machines":       [],
        "warnings":       [],
        "system_notices": system_notices,
        "summary":        "No recommendations could be generated for the selected machines and orders.",
        "validation":     {"passed": True, "checks": []},
        "usage":          None,
    }

def _compute_cost(model: str, 
                  input_tokens: int, 
                  output_tokens: int, 
                  pricing: dict) -> dict:
    price = pricing.get(model, {"input": 0, "output": 0})
    input_cost  = input_tokens  / 1_000_000 * price["input"]
    output_cost = output_tokens / 1_000_000 * price["output"]
    return {
        "model":         model,
        "input_tokens":  input_tokens,
        "output_tokens": output_tokens,
        "input_cost":    round(input_cost,  6),
        "output_cost":   round(output_cost, 6),
        "total_cost":    round(input_cost + output_cost, 6),
    }

def generate_recommendation_openai(
    results: dict,
    order_tracking: pd.DataFrame,
    machine_spec_df: pd.DataFrame,
    production_df: pd.DataFrame,
    system_notices: list = [],
    model: str = "gpt-4o",
) -> dict:
    import openai

    today  = production_df['date'].max()
    prompt = build_prompt(results, order_tracking, machine_spec_df, production_df, system_notices=system_notices)
    client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    response = client.chat.completions.create(
        model=model,
        max_tokens=1000,
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": prompt}],
    )

    raw   = response.choices[0].message.content.strip()
    usage = _compute_cost(
        model=model,
        input_tokens=response.usage.prompt_tokens,
        output_tokens=response.usage.completion_tokens,
        pricing=OPENAI_PRICING,
    )

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {**fallback(results, machine_spec_df), "usage": usage}

    validation = validate(parsed, results, order_tracking, today=today)

    if not validation["passed"]:
        return {**fallback(results, machine_spec_df), "validation": validation, "usage": usage}

    return {**parsed, "validation": validation, "usage": usage}