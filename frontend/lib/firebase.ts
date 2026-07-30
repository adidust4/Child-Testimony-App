import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "...",
  authDomain: "child-testimony.firebaseapp.com",
  projectId: "child-testimony",
  storageBucket: "child-testimony.firebasestorage.app",
  messagingSenderId: "980904584345",
  appId: "1:980904584345:web:c76323f02b08d2412b0408",
  measurementId: "G-DFVSN43M9J",
};

const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const db = getFirestore(app);