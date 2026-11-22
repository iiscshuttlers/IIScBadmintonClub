import { initializeApp, type FirebaseApp } from "firebase/app";
import { getMessaging, type Messaging } from "firebase/messaging";

// Firebase is used only for web push (Cloud Messaging). Data, auth and
// storage all live in Supabase, so Firestore/Auth/Storage are not set up
// here: initialising them pulled ~165 kB of unused code into startup.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp | undefined;
try {
  app = initializeApp(firebaseConfig);
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
