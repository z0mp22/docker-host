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


# --- Lift-session prompt: fully separate from the functions above, on purpose.
# The mountain report's prompt_path()/load_system_prompt()/prompt_version() are
# untouched by the functions below -- this file is deliberately not a shared
# "generic prompt loader" so that nothing about the lift-session feature can
# ever change the mountain report's prompt content or its cache-busting
# version hash. See prompts/lift_system.md and test_lift_prompt_isolation.py.


def lift_prompt_path() -> Path:
    return Path(__file__).resolve().parent.parent / "prompts" / "lift_system.md"


def load_lift_prompt() -> str:
    path = lift_prompt_path()
    return path.read_text(encoding="utf-8")


def lift_prompt_version() -> str:
    path = lift_prompt_path()
    if not path.exists():
        return "missing"
    stat = path.stat()
    return f"mtime-{int(stat.st_mtime)}"
