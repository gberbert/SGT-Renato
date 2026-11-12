import admin from "firebase-admin";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SA_PATH = path.resolve(__dirname, "../Arquivos_Gerais/sgt-renato-firebase-adminsdk-fbsvc-2c3d1c9c2c.json");
const serviceAccount = JSON.parse(readFileSync(SA_PATH, "utf8"));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: "sgt-renato" });
const db = admin.firestore();

// Consciência Negra — feriado nacional desde 2024 (Lei 14.759/2023)
const FERIADOS = [
  { data: '2024-11-20', nome: 'Consciência Negra', tipo: 'nacional', pais: 'BR' },
  { data: '2025-11-20', nome: 'Consciência Negra', tipo: 'nacional', pais: 'BR' },
  { data: '2026-11-20', nome: 'Consciência Negra', tipo: 'nacional', pais: 'BR' },
  { data: '2027-11-20', nome: 'Consciência Negra', tipo: 'nacional', pais: 'BR' },
];

for (const f of FERIADOS) {
  // usa a data como docId para evitar duplicatas
  const docId = `consciencia-negra-${f.data}`;
  await db.collection('holydays').doc(docId).set(f, { merge: false });
  console.log(`SET: ${f.data} → ${docId}`);
}

console.log('Done.');
process.exit(0);
