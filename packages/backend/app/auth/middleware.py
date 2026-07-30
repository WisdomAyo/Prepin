"""
Auth middleware — JWT validation and user extraction.

Architecture decision: we use a simple JWT bearer scheme with HMAC-SHA256
for local dev and RS256 for production (managed IdP like Auth0/Clerk).
The middleware extracts the user from the token and injects it as a
FastAPI dependency. All routes except /health and /docs require auth.

In production, replace the HMAC key with your IdP's JWKS endpoint.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel

from app.config import settings

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

ALGORITHM = "HS256"
# In production, use your IdP's JWKS endpoint for RS256 validation.
# This HMAC key is for local dev only.


class AuthUser(BaseModel):
    """The authenticated user extracted from the JWT."""
    id: UUID
    email: str
    display_name: str = ""


def _decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises HTTPException on failure."""
    try:
        payload = jwt.decode(
            token,
            settings.app_secret_key,
            algorithms=[ALGORITHM],
            options={"verify_aud": False},
        )
    except JWTError as e:
        logger.warning("JWT validation failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check expiry
    exp = payload.get("exp")
    if exp and datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> AuthUser:
    """
    FastAPI dependency — extracts the authenticated user from the JWT.

    Usage in routes:
        @router.get("/foo")
        async def foo(user: AuthUser = Depends(get_current_user)):
            ...
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = _decode_token(credentials.credentials)

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token missing 'sub' claim")

    return AuthUser(
        id=UUID(user_id),
        email=payload.get("email", ""),
        display_name=payload.get("name", ""),
    )


async def get_optional_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> AuthUser | None:
    """Same as get_current_user but returns None instead of 401 for unauthenticated requests."""
    if credentials is None:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None
