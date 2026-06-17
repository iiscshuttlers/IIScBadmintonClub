// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here. Other Firebase libraries
// are not available in the service worker.
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
// https://firebase.google.com/docs/web/setup#config-object
firebase.initializeApp({
  apiKey: "AIzaSyBswPW816r-G3UDRoQSf5eZLRSIlFHtJnc",
  authDomain: "iisc-badminton-hub.firebaseapp.com",
  projectId: "iisc-badminton-hub",
  storageBucket: "iisc-badminton-hub.firebasestorage.app",
  messagingSenderId: "258810088674",
  appId: "1:258810088674:web:457a6da843a1712d69a2bb"
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || 'IISc Shuttlers Alert';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new update.',
    icon: '/iiscshuttlers/icon-192.png',
    badge: '/iiscshuttlers/icon-192.png',
    tag: 'match-alert',
    data: payload.data
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click to deep link (#19)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let path = '/feed';

  switch (data.type) {
    case 'match_confirmation': path = '/feed/my-matches'; break;
    case 'challenge_expiry':   path = '/feed/challenges'; break;
    case 'find_lost':          path = '/find-lost'; break;
    case 'announcement':       path = '/feed/announcements'; break;
    case 'kudos':              path = '/feed'; break;
    case 'elo_milestone':      path = data.player_id ? `/player/${data.player_id}` : '/feed'; break;
    case 'weekly_digest':      path = '/feed/my-matches'; break;
    default:                   path = '/feed'; break;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'PUSH_DEEP_LINK', path });
          return client.focus();
        }
      }
      return clients.openWindow(path);
    })
  );
});

// Background Sync for offline match queue (#54)
const OFFLINE_QUEUE_KEY = 'offline_match_queue';
const SUPABASE_URL = self.__SUPABASE_URL__ || '';
const SUPABASE_ANON_KEY = self.__SUPABASE_ANON_KEY__ || '';

self.addEventListener('sync', (event) => {
  if (event.tag === 'offline-matches') {
    event.waitUntil(syncOfflineMatchesFromSW());
  }
});

async function syncOfflineMatchesFromSW() {
  const allClients = await clients.matchAll({ includeUncontrolled: true });
  // Prefer to let the main thread handle it if a client is open
  if (allClients.length > 0) {
    allClients.forEach((c) => c.postMessage({ type: 'SYNC_OFFLINE_MATCHES' }));
    return;
  }

  // No client open — sync directly from SW using Supabase REST API
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

  let queue = [];
  try {
    // IndexedDB would be ideal but for simplicity we skip SW-only sync;
    // the main thread listener handles it when the app opens.
    // This SW handler is a safety net that notifies open clients.
  } catch {}
}
