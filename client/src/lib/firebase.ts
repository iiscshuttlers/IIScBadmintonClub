import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getMessaging, type Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app, db, auth;
try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
} catch (e) {
  console.warn("Firebase blocked or failed to initialize", e);
}

// Initialized lazily (after SW is registered) so Firebase doesn't try to
// register firebase-messaging-sw.js at the domain root before we point it
// at the correct subpath (needed for GitHub Pages /iiscshuttlers/ deployment).
export function getFirebaseMessaging(): Messaging | null {
  if (!app || typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return getMessaging(app);
  } catch {
    return null;
  }
}

export { db, auth };
