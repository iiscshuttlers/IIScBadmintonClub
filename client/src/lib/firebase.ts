import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCMuJ54BJIP54sEO53jdqxhU72CcvxpEcK",
  authDomain: "iisc-badminton.firebaseapp.com",
  projectId: "iisc-badminton",
  storageBucket: "iisc-badminton.firebasestorage.app",
  messagingSenderId: "543271687226",
  appId: "1:543271687226:web:ad8b388914ff4a531b5103"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);