"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export function isFirebaseClientConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
}

function getFirebaseApp() {
  if (!isFirebaseClientConfigured()) throw new Error("Firebase client configuration is missing.");
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseAuth() {
  const auth = getAuth(getFirebaseApp());
  if (useLocalEmulators() && !localAuth.has(auth)) { connectAuthEmulator(auth, "http://127.0.0.1:19099", { disableWarnings: true }); localAuth.add(auth); }
  return auth;
}

export function getFirebaseDb() {
  const db = getFirestore(getFirebaseApp());
  if (useLocalEmulators() && !localDb.has(db)) { connectFirestoreEmulator(db, "127.0.0.1", 18080); localDb.add(db); }
  return db;
}
const localAuth = new WeakSet(), localDb = new WeakSet();
function useLocalEmulators() { return process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true" && firebaseConfig.projectId?.startsWith("demo-") && typeof window !== "undefined" && ["127.0.0.1", "localhost"].includes(window.location.hostname); }

// Analytics should only be initialized after the visitor has accepted analytics cookies.
export async function enableFirebaseAnalyticsAfterConsent() {
  if (typeof window === "undefined" || !isFirebaseClientConfigured()) return null;
  const { getAnalytics, isSupported } = await import("firebase/analytics");
  if (!(await isSupported())) return null;
  return getAnalytics(getFirebaseApp());
}
