import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getMessaging } from "firebase/messaging";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBswPW816r-G3UDRoQSf5eZLRSIlFHtJnc",
  authDomain: "iisc-badminton-hub.firebaseapp.com",
  projectId: "iisc-badminton-hub",
  storageBucket: "iisc-badminton-hub.firebasestorage.app",
  messagingSenderId: "258810088674",
  appId: "1:258810088674:web:457a6da843a1712d69a2bb",
};

// Initialize Firebase
let app, db, auth, messaging;
try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  
  // Only initialize messaging if supported in the browser
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    messaging = getMessaging(app);
  }
} catch (e) {
  console.warn("Firebase blocked or failed to initialize", e);
}

export { db, auth, messaging };
