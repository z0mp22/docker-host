FROM python:3.12-slim

# Debian's Chromium instead of `playwright install`: it has arm64 builds and gets security updates.
RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium poppler-utils fonts-liberation \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir playwright==1.61.0

WORKDIR /app
COPY hvac_prices.py ./

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    CHROMIUM=/usr/bin/chromium \
    STATE_DIR=/state \
    HOME=/tmp \
    XDG_CACHE_HOME=/tmp/.cache \
    XDG_CONFIG_HOME=/tmp/.config

USER 1000:1000

ENTRYPOINT ["python", "hvac_prices.py"]
