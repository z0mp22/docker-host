FROM ghcr.io/astral-sh/uv:latest AS uv

FROM python:3.12-slim AS builder

COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /app

COPY pyproject.toml ./
COPY mpfeed ./mpfeed

RUN uv sync --no-dev

FROM python:3.12-slim

WORKDIR /app

COPY --from=builder /app/.venv /app/.venv
COPY pyproject.toml ./
COPY mpfeed ./mpfeed

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    STATE_DIR=/state

USER 1000:1000

ENTRYPOINT ["python", "-m", "mpfeed.main"]
