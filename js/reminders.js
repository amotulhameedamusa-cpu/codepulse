// Behavior-based reminders, shown as an in-app banner (no push notifications
// needed, no permissions to ask for -- works reliably for the frontend MVP).

const Reminders = {
  PREFERRED_HOUR: { morning: 9, afternoon: 14, evening: 19, night: 22 },

  formatHour(hour) {
    const h = hour % 12 === 0 ? 12 : hour % 12;
    const period = hour < 12 ? "AM" : "PM";
    return `${h} ${period}`;
  },

  dayKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  },

  hasLoggedToday(sessions) {
    const todayKey = this.dayKey(new Date());
    return sessions.some((s) => this.dayKey(s.date) === todayKey);
  },

  daysSinceLastSession(sessions) {
    if (sessions.length === 0) return null;
    const latest = sessions.reduce((max, s) => (new Date(s.date) > new Date(max.date) ? s : max));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastDay = new Date(latest.date);
    lastDay.setHours(0, 0, 0, 0);
    return Math.round((today - lastDay) / 86400000);
  },

  // Most common hour-of-day sessions were started, if there's enough history
  usualHour(sessions) {
    if (sessions.length < 3) return null;
    const counts = {};
    sessions.forEach((s) => {
      const h = new Date(s.date).getHours();
      counts[h] = (counts[h] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return Number(sorted[0][0]);
  },

  // Returns { type, message } or null if nothing relevant right now
  getReminder(profile, sessions) {
    if (this.hasLoggedToday(sessions)) return null;

    const gapDays = this.daysSinceLastSession(sessions);
    if (gapDays !== null && gapDays >= 3) {
      return {
        type: "gap",
        message: `You haven't logged a session in ${gapDays} days. Want to get back on track?`,
      };
    }

    const currentHour = new Date().getHours();
    const usual = this.usualHour(sessions);

    if (usual !== null) {
      if (Math.abs(currentHour - usual) <= 1) {
        return {
          type: "usual-time",
          message: `You usually code around ${this.formatHour(usual)}. Ready to continue your journey?`,
        };
      }
      return null;
    }

    // Not enough history yet -- fall back to the time-of-day chosen in onboarding
    const prefHour = profile && this.PREFERRED_HOUR[profile.time];
    if (prefHour !== undefined && Math.abs(currentHour - prefHour) <= 1) {
      return {
        type: "preferred-time",
        message: `Ready to continue your journey? You usually code in the ${profile.time}.`,
      };
    }

    return null;
  },

  // Dismissing hides reminders for the rest of the day
  isDismissedToday() {
    const dismissed = localStorage.getItem("codepulse_reminder_dismissed");
    return dismissed === this.dayKey(new Date());
  },

  dismissToday() {
    localStorage.setItem("codepulse_reminder_dismissed", this.dayKey(new Date()));
  },

  // Renders the banner into the given container element, or clears it
  render(containerEl, profile, sessions) {
    containerEl.innerHTML = "";
    if (this.isDismissedToday()) return;

    const reminder = this.getReminder(profile, sessions);
    if (!reminder) return;

    const banner = document.createElement("div");
    banner.className = "reminder-banner";

    const text = document.createElement("span");
    text.textContent = reminder.message;

    const dismiss = document.createElement("button");
    dismiss.className = "reminder-dismiss";
    dismiss.setAttribute("aria-label", "Dismiss");
    dismiss.textContent = "\u2715";
    dismiss.addEventListener("click", () => {
      this.dismissToday();
      containerEl.innerHTML = "";
    });

    banner.append(text, dismiss);
    containerEl.appendChild(banner);
  },
};