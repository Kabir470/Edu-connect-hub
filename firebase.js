// Firebase initialization tailored for React Native / Expo
import { initializeApp, getApps, getApp } from "firebase/app";
import AsyncStorage from '@react-native-async-storage/async-storage';
// Ensure the auth component is registered and use RN persistence
// Register auth component and use RN persistence
import 'firebase/auth';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from "firebase/firestore";

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

// Initialize or retrieve Auth with React Native persistence
let authInstance;
try {
  authInstance = getAuth(app);
} catch (e) {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

export const auth = authInstance;

// Firestore can be initialized normally
export const db = getFirestore(app);