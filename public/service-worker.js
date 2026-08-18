self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "MATE 포인트", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      data: { deepLink: data.deepLink || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const deepLink = event.notification.data?.deepLink || "/";
  event.waitUntil(clients.openWindow(deepLink));
});