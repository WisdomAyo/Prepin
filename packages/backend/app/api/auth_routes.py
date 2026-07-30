"""
Auth endpoints — register + login for local dev.

In production, these are replaced by your managed IdP's login flow.
These endpoints exist so the full system works locally at $0.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select

from app.auth.tokens import create_access_token, hash_password, verify_password
import app.db.engine as db_engine
from app.db.models import User

router = APIRouter()


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str = ""


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str


@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest) -> TokenResponse:
    assert db_engine.async_session_factory is not None
    async with db_engine.async_session_factory() as db:
        # Check if user already exists
        result = await db.execute(select(User).where(User.email == req.email))
        if result.scalar_one_or_none():
            raise HTTPException(400, "Email already registered")

        user = User(
            id=uuid.uuid4(),
            email=req.email,
            hashed_password=hash_password(req.password),
            display_name=req.display_name,
        )
        db.add(user)
        await db.commit()

    token = create_access_token(user.id, user.email, user.display_name)
    return TokenResponse(access_token=token, user_id=str(user.id))


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest) -> TokenResponse:
    assert db_engine.async_session_factory is not None
    async with db_engine.async_session_factory() as db:
        result = await db.execute(select(User).where(User.email == req.email))
        user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(401, "Invalid email or password")

    token = create_access_token(user.id, user.email, user.display_name)
    return TokenResponse(access_token=token, user_id=str(user.id))
