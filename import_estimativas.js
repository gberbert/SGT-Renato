import { readFileSync } from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "default");

const importData = async () => {
  try {
    console.log("Lendo arquivo final_estimativas.json...");
    const rawData = readFileSync('../GUIDE-ESTIMATIVAS-CPFL/final_estimativas.json', 'utf8');
    const data = JSON.parse(rawData);
    
    console.log(`Iniciando importação de ${data.length} regras...`);
    const rulesRef = collection(db, 'estimationRules');
    
    let count = 0;
    for (const rule of data) {
      await addDoc(rulesRef, rule);
      count++;
      if (count % 50 === 0) {
        console.log(`Importados ${count}/${data.length}...`);
      }
    }
    
    console.log("✅ Importação concluída com sucesso!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro na importação:", error);
    process.exit(1);
  }
};

importData();
