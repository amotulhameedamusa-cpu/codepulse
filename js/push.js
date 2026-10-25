function urlBase64ToUint8Array(b64) {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

const Push = {
  supported() {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  },

  async getSubscription() {
    const reg = await navigator.serviceWorker.register("sw.js");
    return reg.pushManager.getSubscription();
  },

  async enable() {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Permission denied");

    const reg = await navigator.serviceWorker.register("sw.js");
    await navigator.serviceWorker.ready;

    const keyRes = await fetch(`${API_BASE}/api/push/key`);
    const { publicKey } = await keyRes.json();

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    await apiFetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
  },

  async disable() {
    const sub = await this.getSubscription();
    if (!sub) return;
    await apiFetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
  },
};

// Wire up the card on the Settings page
(async function () {
  const btn = document.getElementById("push-btn");
  if (!btn) return;
  const status = document.getElementById("push-status");

  if (!Push.supported()) {
    status.textContent = "This browser doesn't support notifications.";
    btn.hidden = true;
    return;
  }

  async function render() {
    if (Notification.permission === "denied") {
      status.textContent = "Notifications are blocked. Allow them in your browser's site settings.";
      btn.hidden = true;
      return;
    }
    const sub = await Push.getSubscription();
    status.textContent = sub ? "Reminders are on for this browser." : "Reminders are off.";
    btn.textContent = sub ? "Turn off reminders" : "Turn on reminders";
    btn.disabled = false;
  }

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      const sub = await Push.getSubscription();
      if (sub) await Push.disable();
      else await Push.enable();
    } catch (err) {
      status.textContent = "Couldn't change reminders. Is the server running?";
    }
    await render();
  });

  await render();
})();