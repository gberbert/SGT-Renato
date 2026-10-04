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

async function displayHolydays() {
  try {
    console.log("\n" + "=".repeat(80));
    console.log("📋 COLEÇÃO 'HOLYDAYS' - DADOS CARREGADOS DO FIRESTORE");
    console.log("=".repeat(80) + "\n");
    
    const snapshot = await db.collection("holydays").orderBy("data").get();
    
    console.log(`Total de documentos: ${snapshot.size}\n`);
    
    const holidaysByYear = {};
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      const ano = data.ano;
      
      if (!holidaysByYear[ano]) {
        holidaysByYear[ano] = [];
      }
      
      holidaysByYear[ano].push(data);
    });
    
    // Exibir organizados por ano
    Object.keys(holidaysByYear).sort().forEach((ano) => {
      console.log(`\n📅 ANO ${ano}:`);
      console.log("-".repeat(80));
      
      holidaysByYear[ano].forEach((holyday) => {
        const dataFormatada = holyday.data;
        const nome = holyday.nome;
        const tipo = holyday.tipo;
        const pais = holyday.pais;
        
        console.log(`  📌 ${dataFormatada} | ${nome.padEnd(35)} | Tipo: ${tipo.padEnd(10)} | País: ${pais}`);
      });
    });
    
    console.log("\n" + "=".repeat(80));
    console.log("✅ Validação completa: Todos os feriados foram carregados com sucesso!");
    console.log("=".repeat(80) + "\n");
    
  } catch (error) {
    console.error("❌ Erro:", error.message);
    process.exit(1);
  }
}

displayHolydays().then(() => {
  process.exit(0);
}).catch((e) => {
  console.error("[display_holydays] Fatal error:", e);
  process.exit(1);
});
