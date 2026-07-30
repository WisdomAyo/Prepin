"""
Shared test fixtures.
"""

import pytest


def pytest_configure(config: pytest.Config) -> None:
    """Register custom markers."""
    config.addinivalue_line("markers", "integration: marks tests that need running services")
