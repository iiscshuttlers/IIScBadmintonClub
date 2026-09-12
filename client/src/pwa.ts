// PWA has been disabled to ensure 0 caching.
// We manually unregister any existing service workers to clean up old PWA states
// and prevent the "Failed to register a ServiceWorker" error on Capacitor (localhost).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  }).catch((err) => {
    console.error("Service worker unregistration failed: ", err);
  });
}

export {};
