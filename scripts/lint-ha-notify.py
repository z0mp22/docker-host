#!/usr/bin/env python3
"""Fail when Home Assistant config sends phone pushes any way but script.notify_phones.

Regressions this guards against:
- Filtering states.notify for "mobile_app" finds nothing (Companion app entities are
  notify.<device>; the action is notify.mobile_app_<device>), so pushes silently fell back
  to persistent notifications.
- Six hand-copied notifier lookups drifted apart; only scripts.yaml's notify_phones may
  resolve notifiers or call notify.* now.
- One script hard-coded tag "plex-recordings" for Plex, Lift and Fingerboard alerts, and
  Android replaces a notification with the same tag, so alerts overwrote each other. Every
  notify_phones call needs its own tag.

Static only (no HA needed); validate-ha-config.py checks the live notifier lookup after deploy.
"""
from __future__ import annotations

import re
import sys
from collections import defaultdict
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
HA_CONFIG = ROOT / "homeassistant" / "config"
NOTIFY_SCRIPT = "notify_phones"
NOTIFIER_LOOKUP = "integration_entities('mobile_app')"

# Text patterns that are wrong anywhere in HA config (or code that calls HA).
BANNED_TEXT = [
    (re.compile(r"states\.notify\b"), "filters states.notify; use script.notify_phones"),
    (re.compile(r"""['"]search['"]\s*,\s*['"]mobile_app['"]"""), 'searches entity ids for "mobile_app"; they are notify.<device>'),
    (re.compile(r"script\.notify_mobile_recording\b"), "notify_mobile_recording was replaced by script.notify_phones"),
    (re.compile(r"/api/services/notify/"), "calls notify over the REST API; publish an event/MQTT topic and let an automation call script.notify_phones"),
]
CODE_GLOBS = ("*.py", "*.sh", "*.js")
SKIP_DIRS = {".git", "node_modules"}


class Loader(yaml.SafeLoader):
    pass


def _tagged(loader: yaml.SafeLoader, suffix: str, node: yaml.Node):
    if isinstance(node, yaml.ScalarNode):
        return f"!{suffix} {loader.construct_scalar(node)}"
    if isinstance(node, yaml.SequenceNode):
        return loader.construct_sequence(node)
    return loader.construct_mapping(node)


Loader.add_multi_constructor("!", _tagged)


def is_template(value: object) -> bool:
    return isinstance(value, str) and ("{{" in value or "{%" in value)


def walk(node, path):
    """Yield (path, mapping) for every mapping in the tree."""
    if isinstance(node, dict):
        yield path, node
        for key, value in node.items():
            yield from walk(value, path + [str(key)])
    elif isinstance(node, list):
        for i, value in enumerate(node):
            yield from walk(value, path + [str(i)])


def owner(rel: str, path: list[str], doc) -> str:
    """Name of the automation/script a node belongs to, so repeat calls within one are allowed."""
    if rel.endswith("scripts.yaml") and path:
        return f"script.{path[0]}"
    node = doc
    for i, key in enumerate(path):
        node = node[int(key)] if isinstance(node, list) else node.get(key)
        if isinstance(node, dict) and ("id" in node or "alias" in node) and (
            "triggers" in node or "trigger" in node or "sequence" in node
        ):
            return f"{rel}:{node.get('id') or node.get('alias')}"
    return f"{rel}:{'/'.join(path[:2])}"


def yaml_files() -> list[Path]:
    return sorted(p for p in HA_CONFIG.rglob("*.yaml") if not SKIP_DIRS & set(p.parts))


def code_files() -> list[Path]:
    out = []
    for pattern in CODE_GLOBS:
        out += [
            p for p in ROOT.rglob(pattern)
            if not SKIP_DIRS & set(p.parts) and p.resolve() != Path(__file__).resolve()
            and ".min." not in p.name
        ]
    return sorted(out)


def main() -> int:
    errors: list[str] = []
    tags: dict[str, set[str]] = defaultdict(set)
    clears: dict[str, str] = {}
    calls = 0

    for path in yaml_files() + code_files():
        rel = str(path.relative_to(ROOT))
        text = path.read_text(errors="replace")
        for line_no, line in enumerate(text.splitlines(), 1):
            for pattern, why in BANNED_TEXT:
                if pattern.search(line):
                    errors.append(f"{rel}:{line_no}: {why}")

    scripts_doc = None
    for path in yaml_files():
        rel = str(path.relative_to(ROOT))
        try:
            doc = yaml.load(path.read_text(), Loader=Loader)
        except yaml.YAMLError as exc:
            errors.append(f"{rel}: YAML parse error: {exc}")
            continue
        if path == HA_CONFIG / "scripts.yaml":
            scripts_doc = doc
        for node_path, node in walk(doc, []):
            in_notify_script = rel.endswith("scripts.yaml") and node_path[:1] == [NOTIFY_SCRIPT]
            if not in_notify_script and any(NOTIFIER_LOOKUP in str(v) for v in node.values() if isinstance(v, str)):
                errors.append(f"{rel}: {'/'.join(node_path)}: resolves mobile notifiers itself; call script.{NOTIFY_SCRIPT}")
            action = node.get("action", node.get("service"))
            if not isinstance(action, str):
                continue
            where = f"{rel}: {'/'.join(node_path)}"
            if action.startswith("notify.") and not in_notify_script:
                errors.append(f"{where}: calls {action} directly; call script.{NOTIFY_SCRIPT}")
            elif is_template(action) and not in_notify_script:
                errors.append(f"{where}: templated action {action!r} (could be a hidden notify call)")
            elif action == f"script.{NOTIFY_SCRIPT}":
                calls += 1
                data = node.get("data") or {}
                tag = data.get("tag")
                if not data.get("message"):
                    errors.append(f"{where}: script.{NOTIFY_SCRIPT} without a message")
                if not tag or not str(tag).strip():
                    errors.append(f"{where}: script.{NOTIFY_SCRIPT} without a tag (Android collapses same-tag alerts)")
                elif data.get("message") == "clear_notification":
                    # A clear targets another alert's tag on purpose; it just has to exist.
                    clears[str(tag).strip()] = where
                elif not is_template(tag):
                    tags[str(tag).strip()].add(owner(rel, node_path, doc))

    for tag, owners in sorted(tags.items()):
        if len(owners) > 1:
            errors.append(f"tag {tag!r} shared by {', '.join(sorted(owners))}; each alert needs its own tag")

    for tag, where in sorted(clears.items()):
        if tag not in tags:
            errors.append(f"{where}: clears tag {tag!r}, which no alert sends")

    script = (scripts_doc or {}).get(NOTIFY_SCRIPT)
    if not isinstance(script, dict):
        errors.append(f"homeassistant/config/scripts.yaml: script {NOTIFY_SCRIPT} is missing")
    else:
        body = yaml.safe_dump(script.get("sequence"))
        if NOTIFIER_LOOKUP not in body or "'notify.mobile_app_'" not in body:
            errors.append(
                f"scripts.yaml: {NOTIFY_SCRIPT} must map {NOTIFIER_LOOKUP} notify.<device> "
                "entities to notify.mobile_app_<device> actions"
            )
        if script.get("mode") != "parallel":
            errors.append(f"scripts.yaml: {NOTIFY_SCRIPT} must be mode: parallel (single drops concurrent alerts)")
    if calls == 0:
        errors.append(f"no callers of script.{NOTIFY_SCRIPT} found; the lint is probably looking in the wrong place")

    for error in errors:
        print(f"[lint-ha-notify] FAIL {error}")
    if errors:
        return 1
    print(f"[lint-ha-notify] OK {calls} script.{NOTIFY_SCRIPT} calls, {len(tags)} distinct static tags")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
