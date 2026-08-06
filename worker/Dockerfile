# syntax=docker/dockerfile:1.7
FROM ghcr.io/astral-sh/uv:0.8.14-python3.12-bookworm-slim AS build
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
COPY pyproject.toml uv.lock ./
COPY api/pyproject.toml api/pyproject.toml
COPY worker/pyproject.toml worker/pyproject.toml
COPY worker/src worker/src
RUN uv sync --frozen --no-dev --no-editable --project worker

FROM python:3.12.11-slim-bookworm
RUN groupadd --gid 10001 vonk && useradd --uid 10001 --gid 10001 --no-create-home vonk
WORKDIR /app
COPY --from=build --chown=10001:10001 /app/.venv /app/.venv
ENV PATH=/app/.venv/bin:$PATH PYTHONDONTWRITEBYTECODE=1
USER 10001:10001
CMD ["python", "-m", "vonk_catalog_worker.main"]
