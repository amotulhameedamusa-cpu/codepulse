import json
import os

from pywebpush import webpush, WebPushException

import database as db

# Push services want a contact address for whoever runs the server.
VAPID_CLAIMS = {"sub": "mailto:" + os.environ.get("VAPID_EMAIL", "you@example.com")}


def send_push(sub: dict, title: str, body: str, url: str = "dashboard.html") -> bool:
    try:
        webpush(
            subscription_info={
                "endpoint": sub["endpoint"],
                "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
            },
            data=json.dumps({"title": title, "body": body, "url": url}),
            vapid_private_key="private_key.pem",
            vapid_claims=dict(VAPID_CLAIMS),
        )
        db.mark_sent(sub["endpoint"])
        return True
    except WebPushException as err:
        # 404/410 means the browser unsubscribed or the address expired
        if err.response is not None and err.response.status_code in (404, 410):
            db.delete_subscription(sub["user_id"], sub["endpoint"])
        print("Push failed:", err)
        return False