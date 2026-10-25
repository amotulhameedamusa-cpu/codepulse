import os
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

import database as db

TOKEN_DAYS = 30


def _load_secret() -> str:
    """Env var in production; otherwise a key file created on first run."""
    from_env = os.environ.get("CODEPULSE_SECRET")
    if from_env:
        return from_env
    path = "secret.key"
    if os.path.exists(path):
        with open(path) as f:
            return f.read().strip()
    key = secrets.token_hex(32)
    with open(path, "w") as f:
        f.write(key)
    return key


SECRET_KEY = _load_secret()
bearer = HTTPBearer()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    """Use as a dependency: gives the logged-in user, or a 401 error."""
    try:
        payload = jwt.decode(creds.credentials, SECRET_KEY, algorithms=["HS256"])
        user = db.get_user_by_id(int(payload["sub"]))
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user