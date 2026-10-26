// All data access lives here. Pages call these functions and never talk to
// the API directly, so the rest of the app doesn't care how data is stored.

const API_BASE =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:8000"
    : "https://REPLACE-ME.onrender.com";
const TOKEN_KEY = "codepulse_token";

// ---------- Login state ----------
const Auth = {
  getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch (err) {
      return null;
    }
  },

  setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("codepulse_active_session");
    localStorage.removeItem("codepulse_onboarding_draft");
    window.location.href = "index.html";
  },
};

// fetch() that automatically sends the login token. If the server says we
// aren't logged in (missing, expired or bad token), clear it and go to login.
async function apiFetch(path, options = {}, redirectOnAuthFail = true) {
  const headers = { ...(options.headers || {}) };
  const token = Auth.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if ((res.status === 401 || res.status === 403) && redirectOnAuthFail) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "auth.html?mode=login";
    throw new Error("Not logged in");
  }
  return res;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

// Turn a server error (422, 500...) into a real error instead of handing
// an error message to the page as if it were data.
async function readJson(res) {
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

const Storage = {
  async saveProfile(profile) {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const res = await apiFetch("/api/profile", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ ...profile, timezone }),
    });
    return readJson(res);
  },
  
  // Pass quiet = true to skip the redirect-to-login on a bad token
  // (the welcome page uses this so it never bounces a visitor away).
  async getProfile(quiet = false) {
    const res = await apiFetch("/api/profile", {}, !quiet);
    if (quiet && (res.status === 401 || res.status === 403)) return null;
    return readJson(res);
  },

  // A session looks like:
  // { id, topic, activity, durationSec, accomplished, mood, note, date }
  async getSessions() {
    const res = await apiFetch("/api/sessions");
    return readJson(res);
  },

  async saveSession(session) {
    const res = await apiFetch("/api/sessions", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(session),
    });
    return readJson(res);
  },

  // Holds the in-progress session (topic, activity, duration) between the
  // timer screen and the reflection screen, before it's a saved session.
  saveActiveSession(session) {
    localStorage.setItem("codepulse_active_session", JSON.stringify(session));
  },

  getActiveSession() {
    const data = localStorage.getItem("codepulse_active_session");
    return data ? JSON.parse(data) : null;
  },

  clearActiveSession() {
    localStorage.removeItem("codepulse_active_session");
  },
};