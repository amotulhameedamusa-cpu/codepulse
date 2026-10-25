// Theme is applied instantly by an inline script in <head> (before paint)
// to avoid a flash of the wrong theme. This file just wires up the button.
const Theme = {
  current() {
    return document.documentElement.getAttribute("data-theme") || "light";
  },
  set(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("codepulse_theme", theme);
  },
  toggle() {
    this.set(this.current() === "dark" ? "light" : "dark");
  },
};

const themeBtn = document.getElementById("theme-toggle");
if (themeBtn) {
  themeBtn.addEventListener("click", () => Theme.toggle());
}