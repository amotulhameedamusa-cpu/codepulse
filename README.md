# CodePulse

**Track your coding. Build your momentum.**

CodePulse is a coding-journey tracker for student developers. Log focused coding sessions, watch your streak and weekly progress grow, and get gentle reminders that nudge you back without spamming you.

Live app: https://codepulse-4a6f.onrender.com

## Features

- Accounts with email and password (per-user data, JWT login)
- Onboarding that tailors topics and reminder time to you
- Session timer with topic and activity, then a short reflection
- Dashboard, history and progress charts (streaks, weekly sessions, focus time)
- Custom topics that you add once and see again next time
- Browser push reminders at your chosen time, in your own timezone, with back-off nudges if you go quiet
- Light and dark theme

## Tech stack

- **Frontend:** HTML, CSS, vanilla JavaScript, a service worker for push
- **Backend:** Python, FastAPI
- **Database:** PostgreSQL (Supabase)
- **Push:** Web Push with VAPID keys (`pywebpush`)
- **Hosting:** Render (API and static site); cron-job.org triggers reminder checks

## Project structure

```
Backend/        FastAPI app (main.py, auth.py, database.py, push.py, scheduler.py)
css/            Page styles
js/             Frontend logic (storage.js talks to the API)
*.html          Pages (welcome, auth, onboarding, dashboard, session, ...)
sw.js           Service worker for push notifications
```

## Run it locally

You need Python 3.11+ and a PostgreSQL database (a free Supabase project works).

1. Create a virtual environment and install dependencies:

   ```bash
   cd Backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. Create `Backend/.env` with your database connection string:

   ```
   DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/postgres
   ```

3. Generate push keys (writes `private_key.pem` and `public_key.pem`):

   ```bash
   vapid --gen
   ```

4. Start the API:

   ```bash
   uvicorn main:app --reload
   ```

5. In a second terminal, serve the frontend from the project root:

   ```bash
   python3 -m http.server 5500
   ```

6. Open http://localhost:5500

## Environment variables (production)

| Name | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `CODEPULSE_SECRET` | Signs login tokens |
| `CRON_SECRET` | Protects the reminders endpoint |
| `ALLOWED_ORIGINS` | Frontend address allowed to call the API |
| `VAPID_EMAIL` | Contact email sent with push messages |
| `VAPID_KEY_FILE` | Path to the private push key (e.g. a Render secret file) |
| `DISABLE_SCHEDULER` | Set to `1` where an external timer sends reminders |

Never commit `.env`, `*.pem` or `secret.key`. They are listed in `.gitignore`.

## How reminders work

An external timer calls `POST /api/cron/send-reminders` every few minutes with an `X-Cron-Secret` header. The server checks each user's reminder hour in their own timezone and sends a push only if they haven't coded today and haven't already been reminded.

## Status

Personal project, in active development.
