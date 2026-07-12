import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";
import { getFunctions } from "firebase/functions";

export const firebaseConfig = {
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
storage.maxUploadRetryTime = 10000; // 10 segundos máximo para não travar a interface
export const messaging = getMessaging(app);
export const functions = getFunctions(app);

console.log("Firebase services initialized.");

export const createAuthUser = async (email, password, sendEmail = true) => {
  try {
    // Procura se o app secundário já existe
    let secondaryApp = app; // Fallback
    try {
      const { getApp } = await import("firebase/app");
      secondaryApp = getApp("Secondary");
    } catch (e) {
      // Se não existir, inicializa
      secondaryApp = initializeApp(firebaseConfig, "Secondary");
    }

    const secondaryAuth = getAuth(secondaryApp);
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    
    if (sendEmail) {
      // Envia o link de redefinição para o usuário criar a senha real
      await sendPasswordResetEmail(secondaryAuth, email);
    }
    await signOut(secondaryAuth);
    
    return userCredential.user.uid;
  } catch (error) {
    console.error("Erro ao criar usuário no Firebase Auth:", error);
    throw error;
  }
};
