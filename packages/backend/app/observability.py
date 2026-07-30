"""
Observability — OpenTelemetry tracing + Sentry error tracking.

Architecture decision: we initialize both at app startup. OTel provides
distributed tracing across the pipeline (STT → detect → retrieve → answer).
Sentry catches unhandled exceptions and sends alerts.

In local dev, OTel exports to console (or nothing). In production,
configure OTEL_EXPORTER_OTLP_ENDPOINT for Jaeger/Tempo/etc.
"""

from __future__ import annotations

import logging
import os

from app.config import settings

logger = logging.getLogger(__name__)


def init_observability(app: object) -> None:
    """
    Initialize OpenTelemetry and Sentry.
    Call this during app startup (lifespan).
    """
    _init_opentelemetry(app)
    _init_sentry()


def _init_opentelemetry(app: object) -> None:
    """Set up OpenTelemetry with FastAPI auto-instrumentation."""
    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import (
            BatchSpanExporter,
            ConsoleSpanExporter,
        )
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

        resource = Resource.create({
            "service.name": "interview-copilot",
            "service.version": "0.1.0",
            "deployment.environment": "local" if settings.is_local else "cloud",
        })

        provider = TracerProvider(resource=resource)

        # In production, use OTLP exporter pointed at your collector.
        # Locally, we use console exporter if LOG_LEVEL=DEBUG, otherwise no-op.
        otlp_endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT")
        if otlp_endpoint:
            try:
                from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
                    OTLPSpanExporter,
                )
                exporter = OTLPSpanExporter(endpoint=otlp_endpoint)
                provider.add_span_processor(BatchSpanExporter(exporter))
                logger.info("OTel: exporting to %s", otlp_endpoint)
            except ImportError:
                logger.warning("OTel OTLP exporter not installed, falling back to console")
                if settings.log_level == "DEBUG":
                    provider.add_span_processor(BatchSpanExporter(ConsoleSpanExporter()))
        elif settings.log_level == "DEBUG":
            provider.add_span_processor(BatchSpanExporter(ConsoleSpanExporter()))

        trace.set_tracer_provider(provider)

        # Auto-instrument FastAPI — adds spans for every request
        FastAPIInstrumentor.instrument_app(app)  # type: ignore[arg-type]
        logger.info("OpenTelemetry initialized.")

    except ImportError:
        logger.info("OpenTelemetry SDK not installed — tracing disabled.")
    except Exception:
        logger.exception("Failed to initialize OpenTelemetry")


def _init_sentry() -> None:
    """Set up Sentry error tracking."""
    sentry_dsn = os.environ.get("SENTRY_DSN")
    if not sentry_dsn:
        logger.info("Sentry DSN not set — error tracking disabled.")
        return

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

        sentry_sdk.init(
            dsn=sentry_dsn,
            traces_sample_rate=0.1 if settings.is_local else 0.3,
            profiles_sample_rate=0.1,
            environment="local" if settings.is_local else "production",
            integrations=[
                FastApiIntegration(transaction_style="endpoint"),
                SqlalchemyIntegration(),
            ],
            # Don't send PII
            send_default_pii=False,
        )
        logger.info("Sentry initialized.")

    except ImportError:
        logger.info("Sentry SDK not installed — error tracking disabled.")
    except Exception:
        logger.exception("Failed to initialize Sentry")


def get_tracer(name: str = "interview-copilot"):
    """Get an OTel tracer for custom spans in the pipeline."""
    try:
        from opentelemetry import trace
        return trace.get_tracer(name)
    except ImportError:
        return None
