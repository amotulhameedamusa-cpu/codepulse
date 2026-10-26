import asyncio
from datetime import datetime
from zoneinfo import ZoneInfo

import database as db
import push

REMINDER_HOURS = {"morning": 8, "afternoon": 14, "evening": 19, "night": 21}


def pick_message(days_silent):
    """Return (title, body), or None if today is a quiet day."""
    if days_silent <= 1:
        return ("Time to code", "Your session is waiting. Even 20 minutes keeps the momentum.")
    if days_silent == 3:
        return ("Still there?", "It's been 3 days. Even 10 minutes counts.")
    if days_silent >= 7 and days_silent % 7 == 0:
        return ("We miss you", "A short session today restarts your momentum.")
    return None


def in_user_timezone(profile: dict, now: datetime) -> datetime:
    """Convert 'now' to the user's own timezone, or leave it as is if unknown."""
    try:
        return now.astimezone(ZoneInfo(profile["timezone"]))
    except Exception:
        return now


def check_user(profile: dict, now: datetime):
    """Decide whether this one user gets a reminder right now."""
    now = in_user_timezone(profile, now)
    user_id = profile["user_id"]

    hour = REMINDER_HOURS.get(profile["time"], 19)
    if now.hour < hour:
        return

    sessions = db.get_sessions(user_id)  # newest first
    if sessions:
        last = datetime.fromisoformat(sessions[0]["date"]).astimezone(now.tzinfo).date()
        days_silent = (now.date() - last).days
    else:
        days_silent = 1  # brand-new user: treat like a normal daily reminder

    if days_silent == 0:
        return  # already coded today

    message = pick_message(days_silent)
    if not message:
        return

    for sub in db.get_subscriptions(user_id):
        if sub["last_sent_at"]:
            sent = datetime.fromisoformat(sub["last_sent_at"]).astimezone(now.tzinfo).date()
            if sent == now.date():
                continue  # already reminded this browser today
        push.send_push(sub, message[0], message[1])


def check_and_send():
    now = datetime.now().astimezone()
    for profile in db.get_all_profiles():
        try:
            check_user(profile, now)
        except Exception as err:
            # one user's problem must never stop reminders for everyone else
            print(f"Reminder error for user {profile['user_id']}:", err)


async def run_forever():
    while True:
        try:
            await asyncio.to_thread(check_and_send)
        except Exception as err:
            print("Scheduler error:", err)
        await asyncio.sleep(60)