"""
Token creation — used for local dev and tests.

In production, tokens are issued by your managed IdP (Auth0, Clerk, etc.).
This module is only for local development and test fixtures.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from jose import jwt
from passlib.context import CryptContext

from app.config import settings

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours for dev

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(
    user_id: UUID,
    email: str,
    display_name: str = "",
    expires_delta: timedelta | None = None,
) -> str:
    """Create a signed JWT for local dev. Production uses IdP tokens."""
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {
        "sub": str(user_id),
        "email": email,
        "name": display_name,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.app_secret_key, algorithm=ALGORITHM)
