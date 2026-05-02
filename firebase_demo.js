// Firebase initialization tailored for React Native / Expo
import { initializeApp, getApps, getApp } from 'firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  measurementId: ""
};

// Initialize Firebase app once (supports Fast Refresh)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Initialize Auth with persistent storage for React Native.
// Prefer initializeAuth with AsyncStorage; fall back to getAuth if already initialized.
let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  // If auth is already initialized, get existing instance
  authInstance = getAuth(app);
}

export const auth = authInstance;

// Firestore can be initialized normally
export const db = getFirestore(app);
export const storage = getStorage(app);
