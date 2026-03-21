# services/llm_client/__init__.py
from services.llm_client.recommendation import generate_recommendation_openai
from services.llm_client.prompt import build_prompt
from services.llm_client.validation import validate, fallback