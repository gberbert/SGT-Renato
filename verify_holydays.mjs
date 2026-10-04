import admin from "firebase-admin";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SA_PATH = path.resolve(__dirname, "Arquivos_Gerais/sgt-renato-firebase-adminsdk-fbsvc-2c3d1c9c2c.json");

const serviceAccount = JSON.parse(readFileSync(SA_PATH, "utf8"));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "sgt-renato"
});

const db = admin.firestore();

async function verifyHolydays() {
  try {
    console.log("🔍 Verificando coleção 'holydays'...\n");
    
    const snapshot = await db.collection("holydays").limit(5).get();
    
    console.log(`✅ Total de documentos encontrados: ${snapshot.size}`);
    
    if (snapshot.size > 0) {
      console.log("\n📋 Primeiros 5 feriados:");
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`  - ${data.data}: ${data.nome}`);
      });
    }
    
    // Contar total
    const countSnapshot = await db.collection("holydays").count().get();
    console.log(`\n📊 Total de documentos na coleção: ${countSnapshot.data().count}`);
    
  } catch (error) {
    console.error("❌ Erro:", error.message);
    process.exit(1);
  }
}

verifyHolydays().then(() => {
  console.log("\n[verify_holydays] Done. Exiting.");
  process.exit(0);
}).catch((e) => {
  console.error("[verify_holydays] Fatal error:", e);
  process.exit(1);
});
