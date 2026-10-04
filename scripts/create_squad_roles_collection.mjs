/* eslint-disable no-console */
import admin from "firebase-admin";
import fs from "fs";
import path from "path";

// Initialize Firebase Admin with service account
const serviceAccountPath = path.resolve("./service-account-key.json");

let db;
if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "sgt-renato"
  });
  db = admin.firestore();
} else {
  // Fallback: use default credentials (works in Cloud Functions or with GOOGLE_APPLICATION_CREDENTIALS)
  admin.initializeApp({
    projectId: "sgt-renato"
  });
  db = admin.firestore();
}

const SQUAD_ROLES = [
  { 
    id: "arquiteto", 
    name: "Arquiteto", 
    description: "Responsável pela arquitetura e design de soluções", 
    order: 1,
    color: "#3b82f6"
  },
  { 
    id: "developer", 
    name: "Developer", 
    description: "Desenvolvedor de software", 
    order: 2,
    color: "#10b981"
  },
  { 
    id: "functional", 
    name: "Functional", 
    description: "Analista funcional", 
    order: 3,
    color: "#f59e0b"
  },
  { 
    id: "gp", 
    name: "GP", 
    description: "Gerente de Projeto", 
    order: 4,
    color: "#8b5cf6"
  },
  { 
    id: "scrum_master", 
    name: "Scrum Master", 
    description: "Scrum Master", 
    order: 5,
    color: "#ec4899"
  },
];

async function createSquadRolesCollection() {
  console.log("[create_squad_roles_collection] Starting...");

  try {
    // Check if collection exists and has data
    const snapshot = await db.collection("squadroles").get();
    
    if (snapshot.size > 0) {
      console.log(`[create_squad_roles_collection] Found ${snapshot.size} existing roles. Skipping creation.`);
      snapshot.docs.forEach(d => {
        console.log(`  - ${d.data().name} (${d.id})`);
      });
      return;
    }

    console.log("[create_squad_roles_collection] Creating squadroles collection with default roles...");

    // Create each role
    for (const role of SQUAD_ROLES) {
      const roleDoc = {
        name: role.name,
        description: role.description,
        order: role.order,
        color: role.color,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      console.log(`[create_squad_roles_collection] Creating role: ${role.name}...`);
      await db.collection("squadroles").doc(role.id).set(roleDoc);
    }

    console.log("[create_squad_roles_collection] Successfully created all squad roles.");
    console.log(`[create_squad_roles_collection] Total roles created: ${SQUAD_ROLES.length}`);
  } catch (error) {
    console.error("[create_squad_roles_collection] ERROR:", error);
    process.exit(1);
  }
}

createSquadRolesCollection().then(() => {
  console.log("[create_squad_roles_collection] Done. Exiting.");
  process.exit(0);
}).catch((e) => {
  console.error("[create_squad_roles_collection] Fatal error:", e);
  process.exit(1);
});
