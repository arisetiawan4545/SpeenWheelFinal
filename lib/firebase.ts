// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCTr4i_AuiODEKOFWs8esIC-JTzMTQJAg0",
  authDomain: "care-plus-4f248.firebaseapp.com",
  projectId: "care-plus-4f248",
  storageBucket: "care-plus-4f248.firebasestorage.app",
  messagingSenderId: "67403429166",
  appId: "1:67403429166:web:3f5a37cc66ebb1c8e976bf",
  measurementId: "G-5088VT1MN7"
};

// Mencegah inisialisasi ulang saat hot-reload di Next.js
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const storage = getStorage(app);
export const auth = getAuth(app);

export { app, db, storage };