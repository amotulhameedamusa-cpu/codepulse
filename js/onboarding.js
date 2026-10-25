async function init() {
  const DRAFT_KEY = "codepulse_onboarding_draft";
  const continueBtn = document.getElementById("continue-btn");
  const sections = document.querySelectorAll("[data-question]");
  const isFinalStep = continueBtn.dataset.next === "dashboard.html";

  // While the wizard is in progress, answers live in a local draft, not the
  // backend. Only a COMPLETE profile (all 5 fields) is sent, on the final step.
  // A failure while loading earlier answers must NOT stop the buttons working.
  let answers = {};
  try {
    const draftRaw = localStorage.getItem(DRAFT_KEY);
    answers = draftRaw ? JSON.parse(draftRaw) || {} : (await Storage.getProfile()) || {};
  } catch (err) {
    console.warn("Could not load earlier answers:", err);
    localStorage.removeItem(DRAFT_KEY);
    answers = {};
  }

  function updateButton() {
    continueBtn.disabled = ![...sections].every((s) => answers[s.dataset.question]);
  }

  sections.forEach((section) => {
    const question = section.dataset.question;
    const options = section.querySelectorAll(".option");

    let restored = false;
    options.forEach((option) => {
      if (option.dataset.value === answers[question]) {
        option.classList.add("selected");
        restored = true;
      }
    });
    if (!restored) delete answers[question];

    options.forEach((option) => {
      option.addEventListener("click", () => {
        options.forEach((o) => o.classList.remove("selected"));
        option.classList.add("selected");
        answers[question] = option.dataset.value;
        updateButton();
      });
    });
  });

  updateButton();

  continueBtn.addEventListener("click", async () => {
    continueBtn.disabled = true;
    try {
      if (isFinalStep) {
        await Storage.saveProfile(answers); // throws if the server rejects it
        localStorage.removeItem(DRAFT_KEY);
      } else {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(answers));
      }
      window.location.href = continueBtn.dataset.next;
    } catch (err) {
      continueBtn.disabled = false;
      alert("Couldn't save. Check that the server is running and try again.");
    }
  });
}

init();