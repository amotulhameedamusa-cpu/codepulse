import asyncio
import base64
import os
import secrets
import time
from collections import defaultdict
from typing import Optional

from cryptography.hazmat.primitives import serialization
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field, field_validator

import auth
import database as db
import scheduler


# ---------- Request models ----------

class SessionIn(BaseModel):
    topic: str
    activity: str
    durationSec: int = Field(ge=0, le=86400)
    accomplished: Optional[str] = ""
    mood: Optional[str] = ""
    note: Optional[str] = ""


class Profile(BaseModel):
    level: str
    learning: str
    goal: str
    frequency: str
    time: str
    timezone: Optional[str] = Field(default=None, max_length=64)


class PushKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscription(BaseModel):
    endpoint: str
    keys: PushKeys


class PushUnsubscribe(BaseModel):
    endpoint: str


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def password_fits_bcrypt(cls, value: str) -> str:
        # bcrypt only handles 72 bytes; some characters take more than one byte
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password is too long")
        return value


# ---------- App setup ----------

ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",")]

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    db.init_db()
    if os.environ.get("DISABLE_SCHEDULER") != "1":
        asyncio.create_task(scheduler.run_forever())


@app.get("/")
def read_root():
    return {"status": "CodePulse API is running"}


# ---------- Accounts ----------

FAILED_LOGINS = defaultdict(list)  # email -> times of recent failed attempts
MAX_FAILS = 5
WINDOW_SEC = 15 * 60


def check_login_allowed(email: str):
    now = time.time()
    recent = [t for t in FAILED_LOGINS[email] if now - t < WINDOW_SEC]
    FAILED_LOGINS[email] = recent
    if len(recent) >= MAX_FAILS:
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")


@app.post("/api/signup")
def signup(creds: Credentials):
    user_id = db.create_user(creds.email, auth.hash_password(creds.password))
    if user_id is None:
        raise HTTPException(status_code=409, detail="Email already registered")
    return {"token": auth.create_token(user_id)}


@app.post("/api/login")
def login(creds: Credentials):
    email = creds.email.strip().lower()
    check_login_allowed(email)
    user = db.get_user_by_email(email)
    if not user or not auth.verify_password(creds.password, user["password_hash"]):
        FAILED_LOGINS[email].append(time.time())
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    FAILED_LOGINS.pop(email, None)  # a good login clears the counter
    return {"token": auth.create_token(user["id"])}


# ---------- Profile and sessions (logged-in users only) ----------

@app.post("/api/profile")
def save_profile(profile: Profile, user: dict = Depends(auth.get_current_user)):
    return db.save_profile(user["id"], profile.model_dump())


@app.get("/api/profile")
def read_profile(user: dict = Depends(auth.get_current_user)):
    return db.get_profile(user["id"])


@app.get("/api/sessions")
def read_sessions(user: dict = Depends(auth.get_current_user)):
    return db.get_sessions(user["id"])


@app.post("/api/sessions")
def write_session(session: SessionIn, user: dict = Depends(auth.get_current_user)):
    return db.create_session(user["id"], session.model_dump())


# ---------- Push notifications ----------

def get_public_key_b64() -> str:
    """Browsers want the public key as URL-safe base64, no padding."""
    with open(os.environ.get("VAPID_KEY_FILE", "private_key.pem"), "rb") as f:
        private_key = serialization.load_pem_private_key(f.read(), password=None)
    raw = private_key.public_key().public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    )
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


@app.get("/api/push/key")
def push_key():
    return {"publicKey": get_public_key_b64()}


@app.post("/api/push/subscribe")
def push_subscribe(sub: PushSubscription, user: dict = Depends(auth.get_current_user)):
    db.save_subscription(user["id"], sub.endpoint, sub.keys.p256dh, sub.keys.auth)
    return {"status": "subscribed"}


@app.post("/api/push/unsubscribe")
def push_unsubscribe(body: PushUnsubscribe, user: dict = Depends(auth.get_current_user)):
    db.delete_subscription(user["id"], body.endpoint)
    return {"status": "unsubscribed"}


# ---------- Reminder timer (called by an outside cron service) ----------

@app.post("/api/cron/send-reminders")
async def cron_send_reminders(x_cron_secret: str = Header(default="")):
    expected = os.environ.get("CRON_SECRET", "")
    if not expected or not secrets.compare_digest(x_cron_secret.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Not allowed")
    await asyncio.to_thread(scheduler.check_and_send)
    return {"status": "done"}