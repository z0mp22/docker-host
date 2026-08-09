"""One-time FatSecret authorization entrypoint.

Run via scripts/setup-fatsecret-auth.sh to perform the 3-legged OAuth flow and
cache the access token so the unattended report can read your food diary.
"""

import sys

from .config import load_app_config
from .nutrition import authorize_interactive


def main() -> int:
    config = load_app_config()
    if not config.fatsecret_consumer_key or not config.fatsecret_consumer_secret:
        print(
            "Set FATSECRET_CONSUMER_KEY and FATSECRET_CONSUMER_SECRET in .env first.",
            file=sys.stderr,
        )
        return 1
    authorize_interactive(
        config.fatsecret_consumer_key,
        config.fatsecret_consumer_secret,
        config.fatsecret_token_path,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
