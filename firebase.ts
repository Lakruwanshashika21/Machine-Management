import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAptExYseFsoRoyGpCfRYYPVzrKF2Wi0ig",
  authDomain: "pro-scan-factory.firebaseapp.com",
  projectId: "pro-scan-factory",
  storageBucket: "pro-scan-factory.firebasestorage.app",
  messagingSenderId: "382392727004",
  appId: "1:382392727004:web:a858b28d40b2d3856acb19",
  measurementId: "G-YPZXKPJFPN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize and Export Services
export const analytics = getAnalytics(app);
export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;