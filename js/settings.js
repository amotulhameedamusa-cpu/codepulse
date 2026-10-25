async function init() {
  let profile;
  try {
    profile = await Storage.getProfile();
  } catch (err) {
    console.warn("Could not reach the server:", err);
    profile = {}; // keep the page usable; saving will report the error
  }
  if (!profile) {
    // Nothing saved yet, so there's nothing to edit -- run onboarding first
    window.location.href = "onboarding.html";
    return;
  }

  const KEYS = ["level", "learning", "goal", "frequency", "time"];

  const sections = document.querySelectorAll("[data-question]");
  const saveBtn = document.getElementById("save-btn");
  const statusEl = document.getElementById("save-status");

  let saved = {};   // what's currently stored in the database
  const answers = {}; // what's selected on screen right now
  KEYS.forEach((key) => {
    saved[key] = profile[key];
    answers[key] = profile[key];
  });

  function isDirty() {
    return KEYS.some((key) => answers[key] !== saved[key]);
  }

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = "save-status" + (kind ? ` ${kind}` : "");
  }

  sections.forEach((section) => {
    const key = section.dataset.question;
    const options = section.querySelectorAll(".option");

    // Show the currently saved answer as selected
    options.forEach((option) => {
      if (option.dataset.value === answers[key]) option.classList.add("selected");
    });

    options.forEach((option) => {
      option.addEventListener("click", () => {
        options.forEach((o) => o.classList.remove("selected"));
        option.classList.add("selected");
        answers[key] = option.dataset.value;

        saveBtn.disabled = !isDirty();
        setStatus(isDirty() ? "You have unsaved changes" : "", "");
      });
    });
  });

  saveBtn.disabled = true; // nothing has changed yet

  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    setStatus("Saving...", "");

    try {
      const payload = {};
      KEYS.forEach((key) => (payload[key] = answers[key]));

      const result = await Storage.saveProfile(payload);
      // A rejected save comes back as an error object, not a profile
      if (!result || !result.level) throw new Error("Save failed");

      saved = { ...payload };
      setStatus("Saved \u2713", "ok");
    } catch (err) {
      saveBtn.disabled = false;
      setStatus("Couldn't save. Is the server running?", "error");
    }
  });
}

init();
document.getElementById("logout-btn").addEventListener("click", async () => {
  // Stop reminders on this browser so the next person to log in doesn't
  // inherit this account's notifications
  try {
    await Push.disable();
  } catch (err) {}
  Auth.logout();
});