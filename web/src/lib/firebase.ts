import {initializeApp} from "firebase/app";
import {getAuth} from "firebase/auth";
import {getFirestore} from "firebase/firestore";
import {getFunctions} from "firebase/functions";

const defaults = {
  apiKey: "AIzaSyA7oiVVJ0Md_GZYgwxFU-qoBktWyrsHYvc",
  authDomain: "posd-b2422.firebaseapp.com",
  projectId: "posd-b2422",
  storageBucket: "posd-b2422.firebasestorage.app",
  messagingSenderId: "75073765141",
  appId: "1:75073765141:web:5f89ab2f7371a52e74331c",
};

const requiredEnv = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || defaults.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || defaults.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || defaults.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || defaults.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || defaults.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || defaults.appId,
};

const missing = Object.entries(requiredEnv)
  .filter(([, value]) => !value || String(value).startsWith("replace-with"))
  .map(([key]) => `VITE_FIREBASE_${key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`);

export const firebaseConfigMissing = missing;

export const app = initializeApp(requiredEnv);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(
  app,
  import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || "asia-northeast1",
);
