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
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  // Customize notification here
  const notificationTitle = payload.notification?.title || 'IISc Shuttlers Alert';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new update.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'match-alert', // Prevents spamming multiple notifications
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
