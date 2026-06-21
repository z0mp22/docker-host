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
    gmail_user: str
    gmail_app_password: str
    report_output_dir: Path
    unit_system: str
    max_input_tokens: int
    save_debug_input: bool


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
        anthropic_model=os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"),
        gmail_user=gmail_user,
        gmail_app_password=gmail_password,
        report_output_dir=Path(os.environ.get("REPORT_OUTPUT_DIR", "/reports")),
        unit_system=os.environ.get("UNIT_SYSTEM", "metric"),
        max_input_tokens=int(os.environ.get("MAX_INPUT_TOKENS", "150000")),
        save_debug_input=os.environ.get("SAVE_DEBUG_INPUT", "true").lower() in ("1", "true", "yes"),
    )
