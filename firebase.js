// Firebase initialization tailored for React Native / Expo
import { initializeApp, getApps, getApp } from 'firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBlXLMnOBvAHxFIrmUL90s0nyerPUKLMwU",
  authDomain: "educonnecthub-7454e.firebaseapp.com",
  projectId: "educonnecthub-7454e",
  storageBucket: "educonnecthub-7454e.firebasestorage.app",
  messagingSenderId: "40398803151",
  appId: "1:40398803151:web:6a48d84dbe77569a9067ba",
  measurementId: "G-LJXHJ3KMNQ"
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