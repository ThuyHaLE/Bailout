# services/llm_client/schema.py

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