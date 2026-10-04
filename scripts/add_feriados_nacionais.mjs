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


// Feriados Nacionais Fixos do Brasil (formato YYYY-MM-DD)
const feriadosNacionaisFixos = [
  "2024-01-01", // Ano Novo
  "2024-04-21", // Tiradentes
  "2024-05-01", // Dia do Trabalho
  "2024-09-07", // Independência do Brasil
  "2024-10-12", // Nossa Senhora Aparecida
  "2024-11-02", // Finados
  "2024-11-15", // Proclamação da República
  "2024-11-20", // Consciência Negra
  "2024-12-25", // Natal
  "2025-01-01", // Ano Novo
  "2025-04-21", // Tiradentes
  "2025-05-01", // Dia do Trabalho
  "2025-09-07", // Independência do Brasil
  "2025-10-12", // Nossa Senhora Aparecida
  "2025-11-02", // Finados
  "2025-11-15", // Proclamação da República
  "2025-11-20", // Consciência Negra
  "2025-12-25", // Natal
  "2026-01-01", // Ano Novo
  "2026-04-21", // Tiradentes
  "2026-05-01", // Dia do Trabalho
  "2026-09-07", // Independência do Brasil
  "2026-10-12", // Nossa Senhora Aparecida
  "2026-11-02", // Finados
  "2026-11-15", // Proclamação da República
  "2026-11-20", // Consciência Negra
  "2026-12-25", // Natal
];

async function addFeriadosNacionais() {
  try {
    console.log("🔍 Buscando municípios...");
    const snapshot = await db.collection("municipios").get();

    if (snapshot.empty) {
      console.log("❌ Nenhum município encontrado");
      return;
    }

    console.log(`✅ ${snapshot.size} municípios encontrados`);
    
    let updated = 0;
    for (const docSnapshot of snapshot.docs) {
      const municipioId = docSnapshot.id;
      const municipioData = docSnapshot.data();
      
      // Apenas atualiza se ainda não tem feriados_nacionais
      if (!municipioData.feriados_nacionais) {
        await db.collection("municipios").doc(municipioId).update({
          feriados_nacionais: feriadosNacionaisFixos
        });
        console.log(`✅ Atualizado: ${municipioData.nome} (${municipioData.uf})`);
        updated++;
      } else {
        console.log(`⏭️  Pulado: ${municipioData.nome} (já tem feriados_nacionais)`);
      }
    }

    console.log(`\n✅ Total atualizado: ${updated} municípios`);
    console.log(`📅 Feriados Nacionais adicionados:`);
    console.log("  - Ano Novo (01/01)");
    console.log("  - Tiradentes (21/04)");
    console.log("  - Dia do Trabalho (01/05)");
    console.log("  - Independência do Brasil (07/09)");
    console.log("  - Nossa Senhora Aparecida (12/10)");
    console.log("  - Finados (02/11)");
    console.log("  - Proclamação da República (15/11)");
    console.log("  - Consciência Negra (20/11)");
    console.log("  - Natal (25/12)");

  } catch (error) {
    console.error("❌ Erro:", error.message);
    process.exit(1);
  }
}

addFeriadosNacionais().then(() => {
  console.log("[add_feriados_nacionais] Done. Exiting.");
  process.exit(0);
}).catch((e) => {
  console.error("[add_feriados_nacionais] Fatal error:", e);
  process.exit(1);
});
