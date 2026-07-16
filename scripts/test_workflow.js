import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

import fs from 'fs';
import path from 'path';

// Read from functions/.env for config
const envContent = fs.readFileSync(path.resolve('./functions/.env'), 'utf-8');
const envLines = envContent.split('\n');
const envVars = {};
envLines.forEach(line => {
  if (line.trim() && !line.startsWith('#')) {
    const [key, ...val] = line.split('=');
    envVars[key.trim()] = val.join('=').trim();
  }
});

const app = initializeApp({
  projectId: 'sgt-renato'
  // I don't need full config just for some reads maybe?
  // Actually, I can use the same config logic from my previous scripts.
});
const db = getFirestore(app);

async function check() {
  const q = query(collection(db, 'workflows'));
  const snap = await getDocs(q);
  snap.docs.forEach(doc => {
    console.log(doc.id, doc.data());
  });
}
check().catch(console.error);
