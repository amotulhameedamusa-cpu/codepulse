async function init() {
  const allSessions = await Storage.getSessions();

  const DAY_TAGS = ["M", "T", "W", "T", "F", "S", "S"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const SVG_NS = "http://www.w3.org/2000/svg";

  function formatDuration(totalSec) {
    const totalMin = Math.round(totalSec / 60);
    if (totalMin < 1) return "0m";
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }

  function startOfWeek(date) {
    const d = new Date(date);
    const diff = (d.getDay() + 6) % 7; // Monday = 0
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - diff);
    return d;
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  // SVG elements need createElementNS (the SVG namespace), unlike normal HTML
  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    return el;
  }

  // ---------- Line graph ----------
  function renderLineGraph(container, dailyMinutes, weekStart) {
    container.innerHTML = "";

    const width = container.clientWidth || 300; // 1 SVG unit = 1 pixel, so nothing stretches
    const height = 150;
    const baselineY = 120;
    const topY = 28; // leaves room above the highest point for its value label
    const maxMinutes = Math.max(...dailyMinutes, 1);
    const today = new Date();

    // Dots line up with the day letters below: each sits at the center of its 1/7th column
    const points = dailyMinutes.map((minutes, i) => ({
      x: (i + 0.5) * (width / 7),
      y: baselineY - (minutes / maxMinutes) * (baselineY - topY),
      minutes,
      isToday: sameDay(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i), today),
    }));

    const svg = svgEl("svg", { class: "chart-svg", viewBox: `0 0 ${width} ${height}` });

    // Grid lines (baseline + midpoint)
    svg.appendChild(svgEl("line", { class: "chart-grid", x1: 0, x2: width, y1: baselineY, y2: baselineY }));
    svg.appendChild(
      svgEl("line", { class: "chart-grid", x1: 0, x2: width, y1: (baselineY + topY) / 2, y2: (baselineY + topY) / 2 })
    );

    // Filled area under the line
    const linePoints = points.map((p) => `${p.x},${p.y}`).join(" L ");
    const areaPath = `M ${points[0].x},${baselineY} L ${linePoints} L ${points[points.length - 1].x},${baselineY} Z`;
    svg.appendChild(svgEl("path", { class: "chart-area", d: areaPath }));

    // The line itself
    svg.appendChild(svgEl("path", { class: "chart-line", d: `M ${linePoints}` }));

    // Dots + minute labels
    points.forEach((p) => {
      const dotClass = "chart-dot" + (p.minutes > 0 ? " has-time" : "") + (p.isToday ? " is-today" : "");
      svg.appendChild(svgEl("circle", { class: dotClass, cx: p.x, cy: p.y, r: p.isToday ? 5.5 : 4 }));

      if (p.minutes > 0) {
        const label = svgEl("text", { class: "chart-value", x: p.x, y: p.y - 12 });
        label.textContent = `${Math.round(p.minutes)}m`;
        svg.appendChild(label);
      }
    });

    container.appendChild(svg);

    // Day letters under the graph
    const labels = document.createElement("div");
    labels.className = "chart-labels";
    points.forEach((p, i) => {
      const tag = document.createElement("div");
      tag.className = "day-tag" + (p.isToday ? " is-today" : "");
      tag.textContent = DAY_TAGS[i];
      labels.appendChild(tag);
    });
    container.appendChild(labels);
  }

  // ---------- Week state ----------
  let weekOffset = 0; // 0 = current week, -1 = last week, etc.

  function getWeekStart() {
    const base = startOfWeek(new Date());
    base.setDate(base.getDate() + weekOffset * 7);
    return base;
  }

  function render() {
    const weekStart = getWeekStart();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const weekSessions = allSessions.filter((s) => {
      const d = new Date(s.date);
      return d >= weekStart && d < weekEnd;
    });

    // ---------- Week range label ----------
    const endDisplay = new Date(weekEnd);
    endDisplay.setDate(endDisplay.getDate() - 1);
    const rangeText =
      weekStart.getMonth() === endDisplay.getMonth()
        ? `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}\u2013${endDisplay.getDate()}`
        : `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()} \u2013 ${MONTHS[endDisplay.getMonth()]} ${endDisplay.getDate()}`;
    document.getElementById("week-range-text").textContent = rangeText;
    document.getElementById("this-week-tag").textContent = weekOffset === 0 ? "This week" : "";
    document.getElementById("next-week").disabled = weekOffset >= 0;

    // ---------- Stats ----------
    const totalSec = weekSessions.reduce((sum, s) => sum + s.durationSec, 0);
    document.getElementById("week-total").textContent = weekSessions.length ? formatDuration(totalSec) : "0m";
    document.getElementById("week-sessions").textContent = weekSessions.length;
    document.getElementById("week-avg").textContent = weekSessions.length
      ? formatDuration(totalSec / weekSessions.length)
      : "0m";

    // ---------- Daily line graph ----------
    const dailyMinutes = [0, 0, 0, 0, 0, 0, 0];
    weekSessions.forEach((s) => {
      const d = new Date(s.date);
      const dayIndex = (d.getDay() + 6) % 7; // Monday = 0
      dailyMinutes[dayIndex] += s.durationSec / 60;
    });

    renderLineGraph(document.getElementById("daily-chart"), dailyMinutes, weekStart);

    // ---------- Topic breakdown ----------
    const topicTotals = {};
    weekSessions.forEach((s) => {
      topicTotals[s.topic] = (topicTotals[s.topic] || 0) + s.durationSec;
    });
    const topics = Object.entries(topicTotals).sort((a, b) => b[1] - a[1]);
    const topicCard = document.getElementById("topic-card");
    const topicList = document.getElementById("topic-list");
    topicList.innerHTML = "";

    if (topics.length === 0) {
      topicCard.style.display = "none";
    } else {
      topicCard.style.display = "";
      const maxTopicSec = topics[0][1];
      topics.forEach(([topic, sec]) => {
        const row = document.createElement("div");
        row.className = "topic-row";

        const head = document.createElement("div");
        head.className = "topic-row-head";
        const nameEl = document.createElement("span");
        nameEl.className = "name";
        nameEl.textContent = topic;
        const timeEl = document.createElement("span");
        timeEl.className = "time";
        timeEl.textContent = formatDuration(sec);
        head.append(nameEl, timeEl);

        const track = document.createElement("div");
        track.className = "topic-bar-track";
        const fill = document.createElement("div");
        fill.className = "topic-bar-fill";
        fill.style.width = `${(sec / maxTopicSec) * 100}%`;
        track.appendChild(fill);

        row.append(head, track);
        topicList.appendChild(row);
      });
    }
  }

  document.getElementById("prev-week").addEventListener("click", () => {
    weekOffset -= 1;
    render();
  });

  document.getElementById("next-week").addEventListener("click", () => {
    if (weekOffset < 0) {
      weekOffset += 1;
      render();
    }
  });

  // Re-draw if the window is resized, so the graph keeps matching its container's width
  window.addEventListener("resize", render);

  render();
}

init();