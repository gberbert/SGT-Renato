import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBfX9ytpF-hXsLjvu8RFWd4qUIyRC1FiRs",
  authDomain: "sgt-renato.firebaseapp.com",
  projectId: "sgt-renato",
  storageBucket: "sgt-renato.firebasestorage.app",
  messagingSenderId: "759301519468",
  appId: "1:759301519468:web:7010dd7733a234387c4049"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Conectar explicitamente ao banco de dados nomeado como "default" (sem parênteses)
export const db = getFirestore(app, "default");
export const auth = getAuth(app);
export const storage = getStorage(app);

console.log("Firebase services initialized.");
