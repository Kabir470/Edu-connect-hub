// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);