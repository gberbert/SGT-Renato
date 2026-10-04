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

// Feriados Nacionais do Brasil - dados fornecidos pelo usuário
const feriadosNacionais = [
  { mes: "01", dia: "01", nome: "Ano novo" },
  { mes: "04", dia: "21", nome: "Tiradentes" },
  { mes: "05", dia: "01", nome: "Dia do trabalho" },
  { mes: "09", dia: "07", nome: "Dia da Independência do Brasil" },
  { mes: "10", dia: "12", nome: "Nossa Senhora Aparecida" },
  { mes: "11", dia: "02", nome: "Finados" },
  { mes: "11", dia: "15", nome: "Proclamação da república" },
  { mes: "12", dia: "25", nome: "Natal" },
];

// Gerar datas para múltiplos anos (2024-2026)
function gerarDatasHolydays() {
  const dados = [];
  const anos = [2024, 2025, 2026, 2027, 2028];
  
  for (const feriado of feriadosNacionais) {
    for (const ano of anos) {
      dados.push({
        data: `${ano}-${feriado.mes}-${feriado.dia}`,
        ano: ano,
        mes: parseInt(feriado.mes),
        dia: parseInt(feriado.dia),
        nome: feriado.nome,
        tipo: "nacional",
        pais: "Brasil",
        timestamp: admin.firestore.Timestamp.now()
      });
    }
  }
  
  return dados;
}

async function seedHolydays() {
  try {
    console.log("🔍 Gerando feriados nacionais...");
    const holydays = gerarDatasHolydays();
    
    console.log(`📅 Total de feriados a criar: ${holydays.length}`);
    
    let created = 0;
    
    // Usar batch para performance
    const batch = db.batch();
    
    for (const holyday of holydays) {
      const docRef = db.collection("holydays").doc(holyday.data);
      batch.set(docRef, holyday);
      created++;
    }
    
    console.log("⏳ Enviando para Firestore...");
    const result = await batch.commit();
    console.log(`✅ Batch commit retornou: ${result}`);
    
    console.log(`\n✅ ${created} feriados criados na coleção 'holydays'`);
    console.log(`📅 Feriados criados para os anos: 2024-2028`);
    console.log("\n📋 Feriados inclusos:");
    console.log("  - Ano novo (01/01)");
    console.log("  - Tiradentes (21/04)");
    console.log("  - Dia do trabalho (01/05)");
    console.log("  - Dia da Independência do Brasil (07/09)");
    console.log("  - Nossa Senhora Aparecida (12/10)");
    console.log("  - Finados (02/11)");
    console.log("  - Proclamação da república (15/11)");
    console.log("  - Natal (25/12)");

  } catch (error) {
    console.error("❌ Erro:", error.message);
    process.exit(1);
  }
}

seedHolydays().then(() => {
  console.log("[seed_holydays] Done. Exiting.");
  process.exit(0);
}).catch((e) => {
  console.error("[seed_holydays] Fatal error:", e);
  process.exit(1);
});
