/* eslint-disable no-console */
import admin from "firebase-admin";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SA_PATH = path.resolve(__dirname, "../Arquivos_Gerais/sgt-renato-firebase-adminsdk-fbsvc-2c3d1c9c2c.json");

const serviceAccount = JSON.parse(readFileSync(SA_PATH, "utf8"));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "sgt-renato"
});

const db = admin.firestore();

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
    const snapshot = await db.collection("squadroles").orderBy("order", "asc").get();
    
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
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      console.log(`[seed_squad_roles] Creating role: ${role.name}...`);
      await db.collection("squadroles").doc(docId).set(roleDoc);
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
