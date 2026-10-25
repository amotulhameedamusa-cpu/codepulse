// Runs in the background, even when no CodePulse tab is open.
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "CodePulse", {
        body: data.body || "Time for a coding session.",
        tag: "codepulse-reminder",
        renotify: true,
        silent: false,
        data: { url: data.url || "dashboard.html" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data.url;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
      for (const tab of tabs) {
        if ("focus" in tab) {
          return tab
            .navigate(url)
            .then((client) => client && client.focus())
            .catch(() => clients.openWindow(url));
        }
      }
      return clients.openWindow(url);
    })
  );
});