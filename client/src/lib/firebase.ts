import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

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
let app, db, auth;
try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
} catch (e) {
  console.warn("Firebase blocked or failed to initialize", e);
}

// Initialize Cloud Firestore and Authentication and export them
export { db, auth };
