// One page, two modes: ?mode=login (default) or ?mode=signup
const params = new URLSearchParams(window.location.search);
let mode = params.get("mode") === "signup" ? "signup" : "login";

const form = document.getElementById("auth-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const errorEl = document.getElementById("auth-error");
const submitBtn = document.getElementById("auth-submit");

function renderMode() {
  const signup = mode === "signup";
  document.getElementById("auth-title").textContent = signup ? "Create your account" : "Welcome back";
  document.getElementById("auth-lead").textContent = signup
    ? "Start tracking your coding journey."
    : "Log in to continue your coding journey.";
  submitBtn.textContent = signup ? "Create account" : "Log in";
  document.getElementById("switch-text").textContent = signup ? "Already have an account?" : "New here?";
  document.getElementById("switch-link").textContent = signup ? "Log in" : "Create an account";
  passwordInput.autocomplete = signup ? "new-password" : "current-password";
  errorEl.textContent = "";
}

document.getElementById("switch-link").addEventListener("click", (e) => {
  e.preventDefault();
  mode = mode === "signup" ? "login" : "signup";
  renderMode();
});

const MESSAGES = {
  401: "Incorrect email or password.",
  409: "That email is already registered. Try logging in.",
  422: "Enter a valid email and a password of 8 to 72 characters.",
};

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.textContent = "";
  submitBtn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/api/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailInput.value.trim(),
        password: passwordInput.value,
      }),
    });

    if (!res.ok) {
      errorEl.textContent = MESSAGES[res.status] || "Something went wrong. Try again.";
      submitBtn.disabled = false;
      return;
    }

    const { token } = await res.json();
    Auth.setToken(token);

    // New accounts finish onboarding; returning users go to the dashboard
    // (unless they never finished setup).
    const profile = mode === "signup" ? null : await Storage.getProfile();
    window.location.href = profile ? "dashboard.html" : "onboarding.html";
  } catch (err) {
    errorEl.textContent = "Can't reach the server. Is it running?";
    submitBtn.disabled = false;
  }
});

const toggleBtn = document.getElementById("toggle-password");
toggleBtn.addEventListener("click", () => {
  const show = passwordInput.type === "password";
  passwordInput.type = show ? "text" : "password";
  toggleBtn.textContent = show ? "Hide" : "Show";
  toggleBtn.setAttribute("aria-label", show ? "Hide password" : "Show password");
});

renderMode();