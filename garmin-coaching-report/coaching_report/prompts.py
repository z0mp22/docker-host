"""Load coaching system prompts."""

from pathlib import Path


def prompt_path() -> Path:
    return Path(__file__).resolve().parent.parent / "prompts" / "system.md"


def load_system_prompt() -> str:
    path = prompt_path()
    return path.read_text(encoding="utf-8")


def prompt_version() -> str:
    path = prompt_path()
    if not path.exists():
        return "missing"
    stat = path.stat()
    return f"mtime-{int(stat.st_mtime)}"
