async function init() {
  const allSessions = await Storage.getSessions();

  const MOOD_EMOJI = {
    tough: "\u{1F62B}", // 😫
    okay: "\u{1F610}", // 😐
    good: "\u{1F642}", // 🙂
    great: "\u{1F525}", // 🔥
  };

  const MOOD_LABEL = {
    tough: "Struggled",
    okay: "Okay",
    good: "Good",
    great: "Great",
  };

  const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function formatDuration(totalSec) {
    const totalMin = Math.round(totalSec / 60);
    if (totalMin < 1) return "under a minute";
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return `${m} min`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }

  function formatTimeOfDay(dateStr) {
    return new Date(dateStr).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function dayKey(dateStr) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  function dayLabel(dateStr) {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (dayKey(dateStr) === dayKey(today)) return "Today";
    if (dayKey(dateStr) === dayKey(yesterday)) return "Yesterday";

    const diffDays = Math.round((today.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
    if (diffDays > 0 && diffDays < 7) return WEEKDAYS[d.getDay()];

    return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  }

  function calcStreak(sessions) {
    const days = new Set(sessions.map((s) => dayKey(s.date)));
    const cursor = new Date();
    if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);

    let streak = 0;
    while (days.has(dayKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  // ---------- Progress summary ----------
  const totalSec = allSessions.reduce((sum, s) => sum + s.durationSec, 0);
  document.getElementById("hist-sessions").textContent = allSessions.length;
  document.getElementById("hist-total").textContent = allSessions.length ? formatDuration(totalSec) : "0m";

  const streak = calcStreak(allSessions);
  document.getElementById("progress-note").textContent =
    streak > 0
      ? `You're on a ${streak}-day streak. Keep it going!`
      : "Start a session today to build your streak!";

  // ---------- Filtering ----------
  let activeFilter = "All";
  const filterChips = document.querySelectorAll(".filter-chip");

  filterChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      filterChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      activeFilter = chip.dataset.filter;
      render();
    });
  });

  // ---------- Render ----------
  const listEl = document.getElementById("history-list");

  function render() {
    listEl.innerHTML = "";

    const filtered =
      activeFilter === "All"
        ? allSessions
        : allSessions.filter((s) => (s.accomplished || s.activity) === activeFilter);

    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "card empty-state";
      empty.innerHTML =
        allSessions.length === 0
          ? 'No sessions logged yet. <a href="dashboard.html">Start your first one</a>.'
          : "No sessions match this filter yet.";
      listEl.appendChild(empty);
      return;
    }

    const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));

    const groups = [];
    let currentKey = null;
    let currentGroup = null;

    sorted.forEach((session) => {
      const key = dayKey(session.date);
      if (key !== currentKey) {
        currentKey = key;
        currentGroup = { label: dayLabel(session.date), sessions: [] };
        groups.push(currentGroup);
      }
      currentGroup.sessions.push(session);
    });

    groups.forEach((group) => {
      const section = document.createElement("section");
      section.className = "day-group";

      const heading = document.createElement("div");
      heading.className = "day-heading";
      heading.innerHTML = `<span>${group.label}</span><span class="rule"></span>`;
      section.appendChild(heading);

      group.sessions.forEach((s) => {
        const card = document.createElement("div");
        card.className = "session-card";

        const top = document.createElement("div");
        top.className = "session-card-top";
        const topicEl = document.createElement("span");
        topicEl.className = "topic";
        topicEl.textContent = s.topic;
        const timeEl = document.createElement("span");
        timeEl.className = "time-of-day";
        timeEl.textContent = formatTimeOfDay(s.date);
        top.append(topicEl, timeEl);

        const sub = document.createElement("div");
        sub.className = "session-card-sub";
        sub.textContent = `${s.accomplished || s.activity || ""} \u2022 ${formatDuration(s.durationSec)}`;

        card.append(top, sub);

        if (s.mood || s.note) {
          const bottom = document.createElement("div");
          bottom.className = "session-card-bottom";

          if (s.mood) {
            const badge = document.createElement("span");
            badge.className = "mood-badge";
            badge.textContent = `${MOOD_EMOJI[s.mood] || ""} ${MOOD_LABEL[s.mood] || ""}`.trim();
            bottom.appendChild(badge);
          }

          if (s.note) {
            const note = document.createElement("span");
            note.className = "note-text";
            note.textContent = s.note;
            bottom.appendChild(note);
          }

          card.appendChild(bottom);
        }

        section.appendChild(card);
      });

      listEl.appendChild(section);
    });
  }

  render();
}

init();