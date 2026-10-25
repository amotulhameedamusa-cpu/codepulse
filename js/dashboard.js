async function init() {
  const profile = await Storage.getProfile();
  if (!profile) {
    window.location.href = "onboarding.html";
    return;
  }

  const sessions = await Storage.getSessions();

  const LEARNING_LABELS = {
    "web-development": "Web Development",
    "data-ai": "Data & AI",
    "mobile-apps": "Mobile Apps",
    "computer-science": "Computer Science",
  };

  // Matches the mood scale the Session Reflection screen will save
  const MOOD_EMOJI = {
    tough: "\u{1F62B}", // 😫
    okay: "\u{1F610}", // 😐
    good: "\u{1F642}", // 🙂
    great: "\u{1F525}", // 🔥
  };

  // ---------- Helpers ----------
  function formatDuration(totalSec) {
    const totalMin = Math.round(totalSec / 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return `${m} min`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }

  function dayKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  function calcStreak(sessions) {
    const days = new Set(sessions.map((s) => dayKey(s.date)));
    const cursor = new Date();

    // If nothing today, the streak can still be alive from yesterday
    if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);

    let streak = 0;
    while (days.has(dayKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function startOfWeek() {
    const d = new Date();
    const diff = (d.getDay() + 6) % 7; // Monday = 0
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // ---------- Greeting ----------
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  document.getElementById("greeting").textContent = `${greeting} \u{1F44B}`;

  // ---------- Stats ----------
  const streak = calcStreak(sessions);
  const totalSec = sessions.reduce((sum, s) => sum + s.durationSec, 0);

  document.getElementById("stat-streak").textContent = `${streak} ${streak === 1 ? "day" : "days"}`;
  document.getElementById("stat-time").textContent = totalSec ? formatDuration(totalSec) : "0m";
  document.getElementById("stat-sessions").textContent = sessions.length;

  // ---------- Weekly progress ----------
  const weeklyGoal = Number(profile.frequency) || 5;
  const weekStart = startOfWeek();
  const weekSessions = sessions.filter((s) => new Date(s.date) >= weekStart).length;
  const percent = Math.min(100, (weekSessions / weeklyGoal) * 100);

  document.getElementById("week-fill").style.width = `${percent}%`;
  document.getElementById("week-text").textContent = `${weekSessions} / ${weeklyGoal} sessions`;

  // ---------- Current focus ----------
  document.getElementById("focus-value").textContent =
    LEARNING_LABELS[profile.learning] || "Not set";

  const topicCounts = {};
  sessions.forEach((s) => {
    topicCounts[s.topic] = (topicCounts[s.topic] || 0) + 1;
  });
  const topTopic = Object.keys(topicCounts).sort((a, b) => topicCounts[b] - topicCounts[a])[0];
  if (topTopic) {
    document.getElementById("focus-note").textContent = `Most studied topic: ${topTopic}`;
  }

  // ---------- Recent sessions ----------
  const list = document.getElementById("recent-list");
  const recent = sessions.slice(0, 3);

  if (recent.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No sessions yet. Start your first one above.";
    list.appendChild(empty);
  } else {
    recent.forEach((s) => {
      const row = document.createElement("div");
      row.className = "session-row";

      const left = document.createElement("div");
      const topic = document.createElement("div");
      topic.className = "topic";
      topic.textContent = s.topic;
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = s.activity || "";
      left.append(topic, meta);

      const right = document.createElement("div");
      right.className = "right";

      const time = document.createElement("div");
      time.className = "time";
      time.textContent = formatDuration(s.durationSec);

      const mood = document.createElement("span");
      mood.className = "mood";
      mood.textContent = MOOD_EMOJI[s.mood] || "";

      right.append(time, mood);
      row.append(left, right);
      list.appendChild(row);
    });
  }

  Reminders.render(document.getElementById("reminder-slot"), profile, sessions);
}

init();