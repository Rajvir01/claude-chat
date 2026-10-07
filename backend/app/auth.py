"""A single shared password, checked on every API request.

Enough to stop strangers who find the URL from using your API credits. Not a
user-account system: everyone with the password sees the same chats.
"""

import secrets

from fastapi import Header, HTTPException

from app import config


async def require_password(authorization: str | None = Header(default=None)) -> None:
    """FastAPI dependency: reject the request unless it carries the right password.

    FastAPI reads the `Authorization` request header into `authorization` for us.
    """
    expected = f"Bearer {config.APP_PASSWORD}"
    # compare_digest takes the same time whether the first or the last character
    # is wrong, so an attacker can't guess the password one character at a time
    # by measuring how fast we say no. (A plain == can stop at the first mismatch.)
    if authorization is None or not secrets.compare_digest(authorization.encode(), expected.encode()):
        raise HTTPException(
            status_code=401,
            detail="Wrong or missing password",
            headers={"WWW-Authenticate": "Bearer"},
        )
