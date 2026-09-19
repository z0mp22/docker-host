"""Test configuration.

garmin_connect_mcp (vendored) and garminconnect both declare Python >=3.12 in
their own package metadata. If they're genuinely importable -- running under
`uv sync` on a real 3.12 host, or inside the actual garmin-coaching-report
image -- this file does nothing and the real packages are used. If they're
not importable (developing/running these unit tests on an older host), a
minimal stub is installed so the rest of coaching_report's import chain still
works. None of these tests exercise garmin_connect_mcp/garminconnect
behavior directly (only the new lift-session modules), so the stub is safe
here -- it is not a substitute for the real package, which is always
exercised for real on the actual Pi during the staged verification in the
implementation plan.
"""

import sys
import types

try:
    import garmin_connect_mcp.auth  # noqa: F401
    import garmin_connect_mcp.client  # noqa: F401
except ImportError:
    gc_pkg = types.ModuleType("garmin_connect_mcp")
    gc_client = types.ModuleType("garmin_connect_mcp.client")
    gc_client.GarminClientWrapper = object
    gc_auth = types.ModuleType("garmin_connect_mcp.auth")
    gc_auth.GarminConfig = object
    gc_auth.load_config = lambda *a, **k: None
    gc_auth.get_token_store = lambda *a, **k: "/tmp/garmin-tokens-stub"
    sys.modules.setdefault("garmin_connect_mcp", gc_pkg)
    sys.modules.setdefault("garmin_connect_mcp.client", gc_client)
    sys.modules.setdefault("garmin_connect_mcp.auth", gc_auth)

try:
    import garminconnect  # noqa: F401
except ImportError:
    gc = types.ModuleType("garminconnect")
    for _name in (
        "Garmin",
        "GarminConnectAuthenticationError",
        "GarminConnectConnectionError",
    ):
        setattr(gc, _name, type(_name, (Exception,), {}))
    sys.modules.setdefault("garminconnect", gc)
