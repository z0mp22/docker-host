"""Application configuration from environment."""

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

from garmin_connect_mcp.auth import GarminConfig, load_config as load_garmin_config


@dataclass
class AppConfig:
    garmin: GarminConfig
    anthropic_api_key: str
    anthropic_model: str
    anthropic_fallback_model: str
    gmail_user: str
    gmail_app_password: str
    report_output_dir: Path
    unit_system: str
    max_input_tokens: int
    max_output_tokens: int
    history_weeks: int
    garmin_maxchart: int
    garmin_maxpoly: int
    enable_prompt_cache: bool
    save_debug_input: bool
    athlete_timezone: str
    athlete_location: str
    fatsecret_consumer_key: str
    fatsecret_consumer_secret: str
    fatsecret_token_path: str


def load_app_config() -> AppConfig:
    load_dotenv()

    garmin = load_garmin_config()
    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    gmail_user = os.environ.get("GMAIL_USER", "").strip()
    gmail_password = os.environ.get("GMAIL_APP_PASSWORD", "").strip()

    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY is required")
    if not gmail_user or not gmail_password:
        raise ValueError("GMAIL_USER and GMAIL_APP_PASSWORD are required")

    return AppConfig(
        garmin=garmin,
        anthropic_api_key=api_key,
        anthropic_model=os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
        anthropic_fallback_model=os.environ.get(
            "ANTHROPIC_FALLBACK_MODEL", "claude-haiku-4-5-20251001"
        ),
        gmail_user=gmail_user,
        gmail_app_password=gmail_password,
        report_output_dir=Path(os.environ.get("REPORT_OUTPUT_DIR", "/reports")),
        unit_system=os.environ.get("UNIT_SYSTEM", "metric"),
        max_input_tokens=int(os.environ.get("MAX_INPUT_TOKENS", "180000")),
        max_output_tokens=int(os.environ.get("MAX_OUTPUT_TOKENS", "4096")),
        history_weeks=int(os.environ.get("HISTORY_WEEKS", "8")),
        garmin_maxchart=int(os.environ.get("GARMIN_MAXCHART", "500")),
        garmin_maxpoly=int(os.environ.get("GARMIN_MAXPOLY", "0")),
        enable_prompt_cache=os.environ.get("ENABLE_PROMPT_CACHE", "true").lower()
        in ("1", "true", "yes"),
        save_debug_input=os.environ.get("SAVE_DEBUG_INPUT", "false").lower()
        in ("1", "true", "yes"),
        athlete_timezone=os.environ.get("ATHLETE_TIMEZONE", "America/Denver"),
        athlete_location=os.environ.get("ATHLETE_LOCATION", "Fort Collins, CO"),
        fatsecret_consumer_key=os.environ.get("FATSECRET_CONSUMER_KEY", "").strip(),
        fatsecret_consumer_secret=os.environ.get(
            "FATSECRET_CONSUMER_SECRET", ""
        ).strip(),
        fatsecret_token_path=os.environ.get(
            "FATSECRET_TOKEN_PATH", "/root/.fatsecret/token.json"
        ),
    )
