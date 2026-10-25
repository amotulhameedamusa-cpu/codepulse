async function init() {
  const active = Storage.getActiveSession(); // still localStorage, not awaited
  if (!active) {
    window.location.href = "dashboard.html";
    return;
  }

  // Suggest the accomplishment that matches the activity picked during the session
  const ACTIVITY_TO_ACCOMPLISHMENT = {
    Learning: "Learned",
    Building: "Built",
    Debugging: "Debugged",
    Practicing: "Practiced",
    Revising: "Revised",
  };

  function renderDuration(totalSec) {
    const valueEl = document.getElementById("duration-value");
    const unitEl = document.getElementById("duration-unit");

    if (totalSec < 60) {
      valueEl.textContent = totalSec;
      unitEl.textContent = totalSec === 1 ? "second" : "seconds";
      return;
    }

    const totalMin = Math.round(totalSec / 60);
    if (totalMin < 60) {
      valueEl.textContent = totalMin;
      unitEl.textContent = totalMin === 1 ? "minute" : "minutes";
      return;
    }

    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    valueEl.textContent = m === 0 ? h : `${h}h ${m}m`;
    unitEl.textContent = m === 0 ? (h === 1 ? "hour" : "hours") : "";
  }

  renderDuration(active.durationSec);

  // ---------- Accomplishment chips ----------
  let selectedAccomplishment = null;
  const accomplishChips = document.querySelectorAll("#accomplish-chips .chip-option");

  accomplishChips.forEach((chip) => {
    if (chip.dataset.value === ACTIVITY_TO_ACCOMPLISHMENT[active.activity]) {
      chip.classList.add("selected");
      selectedAccomplishment = chip.dataset.value;
    }
    chip.addEventListener("click", () => {
      accomplishChips.forEach((c) => c.classList.remove("selected"));
      chip.classList.add("selected");
      selectedAccomplishment = chip.dataset.value;
      updateSaveButton();
    });
  });

  // ---------- Mood picker ----------
  let selectedMood = null;
  const moodOptions = document.querySelectorAll("#mood-options .mood-card");

  moodOptions.forEach((option) => {
    option.addEventListener("click", () => {
      moodOptions.forEach((o) => o.classList.remove("selected"));
      option.classList.add("selected");
      selectedMood = option.dataset.value;
      updateSaveButton();
    });
  });

  // ---------- Save ----------
  const saveBtn = document.getElementById("save-btn");
  const noteInput = document.getElementById("note-input");

  function updateSaveButton() {
    saveBtn.disabled = !(selectedAccomplishment && selectedMood);
  }
  updateSaveButton();

  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;

    try {
      await Storage.saveSession({
        topic: active.topic,
        activity: active.activity,
        durationSec: active.durationSec,
        accomplished: selectedAccomplishment,
        mood: selectedMood,
        note: noteInput.value.trim(),
      });
    } catch (err) {
      // The session stays in localStorage, so nothing is lost -- just retry
      saveBtn.disabled = false;
      alert("Couldn't save your session. Check that the server is running and try again.");
      return;
    }

    Storage.clearActiveSession();
    window.location.href = "dashboard.html";
  });

  // ---------- Discard ----------
  document.getElementById("discard-btn").addEventListener("click", () => {
    if (confirm("Discard this session? This can't be undone.")) {
      Storage.clearActiveSession();
      window.location.href = "dashboard.html";
    }
  });
}

init();