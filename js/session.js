async function init() {
  const startedAt = Date.now();

  const timerEl = document.getElementById("timer");
  const endBtn = document.getElementById("end-btn");

  // ---------- Timer (needs no data, starts immediately) ----------
  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function tick() {
    const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
    const h = Math.floor(elapsedSec / 3600);
    const m = Math.floor((elapsedSec % 3600) / 60);
    const s = elapsedSec % 60;
    timerEl.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  tick();
  setInterval(tick, 1000);

  // ---------- Topic chips, tailored to the learning area from onboarding ----------
  const TOPIC_SETS = {
    "web-development": ["HTML/CSS", "JavaScript", "React", "Node.js", "APIs"],
    "data-ai": ["Python", "Pandas", "Machine Learning", "SQL", "Data Viz"],
    "mobile-apps": ["Swift", "Kotlin", "Flutter", "React Native", "UI Design"],
    "computer-science": ["DSA", "Algorithms", "Systems Design", "Databases", "Networking"],
  };
  const DEFAULT_TOPICS = ["Python", "Backend", "DSA", "Frontend", "SQL"];

  let profile = null;
  try {
    profile = await Storage.getProfile();
  } catch (err) {
    // Server unreachable: fall back to the default topic chips
  }
  const topics = TOPIC_SETS[profile && profile.learning] || DEFAULT_TOPICS;
  const topicContainer = document.getElementById("topic-chips");

  topicContainer.innerHTML = "";
  topics.forEach((topic) => {
    const chip = document.createElement("div");
    chip.className = "chip-option";
    chip.dataset.value = topic;
    chip.textContent = topic;
    topicContainer.appendChild(chip);
  });

  const addChip = document.createElement("div");
  addChip.className = "chip-option chip-add";
  addChip.dataset.add = "true";
  addChip.dataset.value = "";
  addChip.textContent = "+ Add topic";
  topicContainer.appendChild(addChip);

  // The chips above only exist in the DOM *after* the await resolves --
  // so everything that queries or wires them has to come after it too.
  const topicChips = document.querySelectorAll("#topic-chips .chip-option");
  const activityChips = document.querySelectorAll("#activity-chips .chip-option");
  const regularTopicChips = Array.from(topicChips).filter((c) => c !== addChip);

  let selectedTopic = null;
  let selectedActivity = null;

  function updateEndButton() {
    endBtn.disabled = !(selectedTopic && selectedActivity);
  }

  function wireChips(chips, onSelect) {
    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        chips.forEach((c) => c.classList.remove("selected"));
        chip.classList.add("selected");
        onSelect(chip.dataset.value);
        updateEndButton();
      });
    });
  }

  function selectTopicChip(chip) {
    topicChips.forEach((c) => c.classList.remove("selected"));
    chip.classList.add("selected");
  }

  wireChips(regularTopicChips, (value) => {
    selectedTopic = value;
  });
  regularTopicChips.forEach((chip) => {
    chip.addEventListener("click", () => selectTopicChip(chip));
  });

  addChip.addEventListener("click", () => {
    if (addChip.querySelector("input")) return;

    const previousValue = addChip.dataset.value;
    addChip.innerHTML = '<input type="text" class="chip-input" placeholder="Type a topic" />';
    const input = addChip.querySelector("input");
    input.value = previousValue;
    input.focus();

    function commit() {
      const value = input.value.trim();
      addChip.dataset.value = value;
      addChip.textContent = value || "+ Add topic";

      if (value) {
        selectTopicChip(addChip);
        selectedTopic = value;
      } else if (selectedTopic === previousValue) {
        selectedTopic = null;
        addChip.classList.remove("selected");
      }
      updateEndButton();
    }

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      }
    });
    input.addEventListener("blur", commit);
  });

  // ---------- Activity chips ----------
  wireChips(activityChips, (value) => (selectedActivity = value));

  // ---------- End session ----------
  endBtn.addEventListener("click", () => {
    const durationSec = Math.floor((Date.now() - startedAt) / 1000);

    // Stays in localStorage on purpose -- see storage.js
    Storage.saveActiveSession({
      topic: selectedTopic,
      activity: selectedActivity,
      durationSec,
    });

    window.location.href = "reflection.html";
  });
}

init();