# Multi-stage build: vendor garmin-connect-mcp + coaching_report
FROM ghcr.io/astral-sh/uv:latest AS uv

FROM python:3.12-slim AS builder

COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /app

COPY pyproject.toml ./
COPY vendor/garmin-connect-mcp ./vendor/garmin-connect-mcp
COPY coaching_report ./coaching_report
COPY prompts ./prompts

RUN uv sync --no-dev

FROM python:3.12-slim

WORKDIR /app

COPY --from=builder /app/.venv /app/.venv
COPY pyproject.toml ./
COPY vendor/garmin-connect-mcp ./vendor/garmin-connect-mcp
COPY coaching_report ./coaching_report
COPY prompts ./prompts

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    GARMINTOKENS=/root/.garminconnect \
    REPORT_OUTPUT_DIR=/reports

ENTRYPOINT ["python", "-m", "coaching_report.main"]
