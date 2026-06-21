"""Garmin Connect authentication for unattended batch runs."""

from pathlib import Path

from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
)

from garmin_connect_mcp.auth import GarminConfig, get_token_store
from garmin_connect_mcp.client import GarminClientWrapper

from .errors import AuthExpiredError

AUTH_SETUP_CMD = (
    "docker run -it --rm "
    "--env-file /docker/garmin-coaching-report/.env "
    "-v /docker/garmin-coaching-report/tokens:/root/.garminconnect "
    "--entrypoint python garmin-coaching-report:local "
    "-m garmin_connect_mcp.scripts.setup_auth"
)


def connect_with_tokens(config: GarminConfig) -> GarminClientWrapper:
    """
    Authenticate using cached tokens only.

    Unattended cron must not fall back to credential/MFA login.
    """
    tokenstore = get_token_store()
    token_path = Path(tokenstore)

    if not token_path.exists() or not any(token_path.iterdir()):
        raise AuthExpiredError(
            f"No Garmin tokens in {tokenstore}. "
            f"Run interactive auth once:\n  {AUTH_SETUP_CMD}"
        )

    try:
        garmin = Garmin()
        garmin.login(tokenstore)
        return GarminClientWrapper(garmin)
    except (
        FileNotFoundError,
        GarminConnectAuthenticationError,
        GarminConnectConnectionError,
    ) as exc:
        raise AuthExpiredError(
            f"Garmin token login failed: {exc}. "
            f"Re-authenticate interactively:\n  {AUTH_SETUP_CMD}"
        ) from exc
