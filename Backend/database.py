"""
All database access lives here. Data is stored in PostgreSQL; the connection
URL comes from the DATABASE_URL setting in backend/.env (or the host's
environment variables when deployed).

Every row of user data belongs to a user (user_id), so one person can never
see another person's data.
"""

import os
from datetime import datetime, timezone

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

load_dotenv()
DATABASE_URL = os.environ["DATABASE_URL"]


def get_connection():
    """Rows come back as dicts. Using `with get_connection() as conn:` commits
    when the block ends normally, rolls back on an error, and closes the
    connection either way."""
    return psycopg.connect(DATABASE_URL, row_factory=dict_row, connect_timeout=10)


def init_db():
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS profile (
                user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                level TEXT,
                learning TEXT,
                goal TEXT,
                frequency TEXT,
                time TEXT
            )
            """
        )
        conn.execute("ALTER TABLE profile ADD COLUMN IF NOT EXISTS timezone TEXT")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                topic TEXT NOT NULL,
                activity TEXT,
                duration_sec INTEGER NOT NULL,
                accomplished TEXT,
                mood TEXT,
                note TEXT,
                date TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                endpoint TEXT NOT NULL UNIQUE,
                p256dh TEXT NOT NULL,
                auth TEXT NOT NULL,
                last_sent_at TEXT
            )
            """
        )


# ---------- Users ----------

def create_user(email: str, password_hash: str):
    """Returns the new user's id, or None if that email is already taken."""
    try:
        with get_connection() as conn:
            row = conn.execute(
                """
                INSERT INTO users (email, password_hash, created_at)
                VALUES (%s, %s, %s)
                RETURNING id
                """,
                (email.strip().lower(), password_hash, datetime.now(timezone.utc).isoformat()),
            ).fetchone()
            return row["id"]
    except psycopg.errors.UniqueViolation:
        return None


def get_user_by_email(email: str):
    with get_connection() as conn:
        return conn.execute(
            "SELECT * FROM users WHERE email = %s", (email.strip().lower(),)
        ).fetchone()


def get_user_by_id(user_id: int):
    with get_connection() as conn:
        return conn.execute("SELECT * FROM users WHERE id = %s", (user_id,)).fetchone()


# ---------- Profile ----------

def get_profile(user_id: int):
    with get_connection() as conn:
        return conn.execute(
            "SELECT * FROM profile WHERE user_id = %s", (user_id,)
        ).fetchone()


def save_profile(user_id: int, data: dict):
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO profile (user_id, level, learning, goal, frequency, time, timezone)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id) DO UPDATE SET
                level = EXCLUDED.level,
                learning = EXCLUDED.learning,
                goal = EXCLUDED.goal,
                frequency = EXCLUDED.frequency,
                time = EXCLUDED.time,
                timezone = EXCLUDED.timezone
            """,
            (
                user_id, data["level"], data["learning"], data["goal"],
                data["frequency"], data["time"], data.get("timezone"),
            ),
        )
    return get_profile(user_id)

def get_all_profiles() -> list[dict]:
    """Used by the reminder scheduler to loop over every user."""
    with get_connection() as conn:
        return conn.execute("SELECT * FROM profile").fetchall()


# ---------- Sessions ----------

def _row_to_session(row) -> dict:
    return {
        "id": row["id"],
        "topic": row["topic"],
        "activity": row["activity"],
        "durationSec": row["duration_sec"],
        "accomplished": row["accomplished"],
        "mood": row["mood"],
        "note": row["note"] or "",
        "date": row["date"],
    }


def get_sessions(user_id: int) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM sessions WHERE user_id = %s ORDER BY date DESC", (user_id,)
        ).fetchall()
    return [_row_to_session(r) for r in rows]


def create_session(user_id: int, data: dict) -> dict:
    date = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        row = conn.execute(
            """
            INSERT INTO sessions (user_id, topic, activity, duration_sec, accomplished, mood, note, date)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                user_id,
                data["topic"],
                data["activity"],
                data["durationSec"],
                data.get("accomplished", ""),
                data.get("mood", ""),
                data.get("note", ""),
                date,
            ),
        ).fetchone()
    return {
        "id": row["id"],
        "topic": data["topic"],
        "activity": data["activity"],
        "durationSec": data["durationSec"],
        "accomplished": data.get("accomplished", ""),
        "mood": data.get("mood", ""),
        "note": data.get("note", ""),
        "date": date,
    }


# ---------- Push subscriptions ----------

def save_subscription(user_id: int, endpoint: str, p256dh: str, auth: str):
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (endpoint) DO UPDATE SET
                user_id = EXCLUDED.user_id,
                p256dh = EXCLUDED.p256dh,
                auth = EXCLUDED.auth
            """,
            (user_id, endpoint, p256dh, auth),
        )


def get_subscriptions(user_id: int | None = None) -> list[dict]:
    """One user's subscriptions, or everyone's when user_id is None."""
    with get_connection() as conn:
        if user_id is None:
            return conn.execute("SELECT * FROM push_subscriptions").fetchall()
        return conn.execute(
            "SELECT * FROM push_subscriptions WHERE user_id = %s", (user_id,)
        ).fetchall()


def delete_subscription(user_id: int, endpoint: str):
    """Only deletes the subscription if it belongs to this user."""
    with get_connection() as conn:
        conn.execute(
            "DELETE FROM push_subscriptions WHERE endpoint = %s AND user_id = %s",
            (endpoint, user_id),
        )


def mark_sent(endpoint: str):
    with get_connection() as conn:
        conn.execute(
            "UPDATE push_subscriptions SET last_sent_at = %s WHERE endpoint = %s",
            (datetime.now(timezone.utc).isoformat(), endpoint),
        )