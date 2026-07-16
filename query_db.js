import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: './functions/.env' });
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
};
// wait, I don't have Vite env vars in functions/.env, they are usually in .env or .env.local in the root.
