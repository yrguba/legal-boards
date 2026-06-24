/** Минимальный SW только для системных уведомлений Legal Boards. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const route = event.notification.data && event.notification.data.route;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (route && 'navigate' in client) {
          return client.navigate(route).then(() => client.focus());
        }
        if (client.focus) return client.focus();
      }
      if (route) return self.clients.openWindow(route);
      return undefined;
    }),
  );
});
