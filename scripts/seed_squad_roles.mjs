/* eslint-disable no-console */
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, collection, query, orderBy, getDocs } from "firebase/firestore";

// Firebase config (same as src/firebase.js)
const firebaseConfig = {
  apiKey: "AIzaSyBfX9ytpF-hXsLjvu8RFWd4qUIyRC1FiRs",
  authDomain: "sgt-renato.firebaseapp.com",
  projectId: "sgt-renato",
  storageBucket: "sgt-renato.firebasestorage.app",
  messagingSenderId: "759301519468",
  appId: "1:759301519468:web:7010dd7733a234387c4049"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "default");

const SQUAD_ROLES = [
  { name: "Arquiteto", description: "Responsável pela arquitetura e design de soluções", order: 1 },
  { name: "Developer", description: "Desenvolvedor de software", order: 2 },
  { name: "Functional", description: "Analista funcional", order: 3 },
  { name: "GP", description: "Gerente de Projeto", order: 4 },
  { name: "Scrum Master", description: "Scrum Master", order: 5 },
];

async function seedSquadRoles() {
  console.log("[seed_squad_roles] Starting...");

  try {
    // Check if roles already exist
    const q = query(collection(db, "squadRoles"), orderBy("order", "asc"));
    const snapshot = await getDocs(q);
    
    if (snapshot.size > 0) {
      console.log(`[seed_squad_roles] Found ${snapshot.size} existing roles. Skipping seed.`);
      snapshot.docs.forEach(d => {
        console.log(`  - ${d.data().name}`);
      });
      return;
    }

    // Seed roles
    for (const role of SQUAD_ROLES) {
      const docId = role.name.toLowerCase().replace(/\s+/g, "_");
      const roleDoc = {
        name: role.name,
        description: role.description,
        order: role.order,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      console.log(`[seed_squad_roles] Creating role: ${role.name}...`);
      const ref = doc(db, "squadRoles", docId);
      await setDoc(ref, roleDoc);
    }

    console.log("[seed_squad_roles] Successfully seeded all squad roles.");
  } catch (error) {
    console.error("[seed_squad_roles] ERROR:", error);
    process.exit(1);
  }
}

seedSquadRoles().then(() => {
  console.log("[seed_squad_roles] Done. Exiting.");
  process.exit(0);
}).catch((e) => {
  console.error("[seed_squad_roles] Fatal error:", e);
  process.exit(1);
});
