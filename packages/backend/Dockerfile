# Multi-stage build for the backend.
# Stage 1: Build dependencies.
# Stage 2: Slim runtime image.

FROM python:3.11-slim AS builder

WORKDIR /app
COPY pyproject.toml .
RUN pip install --no-cache-dir --prefix=/install .

FROM python:3.11-slim AS runtime

WORKDIR /app
COPY --from=builder /install /usr/local
COPY app/ app/

# Non-root user for security
RUN useradd -r -s /bin/false copilot
USER copilot

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
