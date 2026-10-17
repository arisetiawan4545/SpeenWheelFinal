import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    "AIzaSyCTr4i_AuiODEKOFWs8esIC-JTzMTQJAg0",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    "care-plus-4f248.firebaseapp.com",
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "care-plus-4f248",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "care-plus-4f248.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    "67403429166",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    "1:67403429166:web:3f5a37cc66ebb1c8e976bf",
  measurementId:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ||
    "G-5088VT1MN7",
};

const app: FirebaseApp = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp();

const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);
const auth: Auth = getAuth(app);


export const COLLECTIONS = {
  USERS: "Speen_Users", 
  CAMPAIGNS: "Speen_Campaigns",       
  SLOTS: "Speen_CampaignSlots",       
  TV_SESSIONS: "Speen_TVSessions",    
  SPIN_HISTORY: "Speen_SpinHistory",
  CONSUMER_ACCESS: "Speen_ConsumerAccess", 
  VOUCHERS: "Speen_Vouchers",
} as const;

export { app, db, storage, auth };