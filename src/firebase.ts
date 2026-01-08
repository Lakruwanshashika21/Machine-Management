import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAptExYseFsoRoyGpCfRYYPVzrKF2Wi0ig",
  authDomain: "pro-scan-factory.firebaseapp.com",
  projectId: "pro-scan-factory",
  storageBucket: "pro-scan-factory.firebasestorage.app",
  messagingSenderId: "382392727004",
  appId: "1:382392727004:web:a858b28d40b2d3856acb19",
  measurementId: "G-YPZXKPJFPN"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);