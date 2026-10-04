/**
 * seed_squad_roles_enterprise.mjs
 *
 * Semeia os papéis padrão diretamente no banco Enterprise "default"
 * (que é o banco que o app lê via getFirestore(app, "default")).
 *
 * Uso: node scripts/seed_squad_roles_enterprise.mjs
 *
 * Flags:
 *   --force   Remove todos os documentos existentes antes de reinserir
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SA_PATH = path.resolve(
  __dirname,
  "../Arquivos_Gerais/sgt-renato-firebase-adminsdk-fbsvc-2c3d1c9c2c.json"
);
const serviceAccount = JSON.parse(readFileSync(SA_PATH, "utf8"));

const FORCE = process.argv.includes("--force");

const appInst = initializeApp(
  { credential: cert(serviceAccount), projectId: "sgt-renato" },
  "enterprise_seed"
);

// Banco Enterprise nomeado "default" — mesmo que o app usa
const db = getFirestore(appInst, "default");

const DEFAULT_ROLES = [
  { name: "Arquiteto",        description: "Responsável pela arquitetura e design de soluções", order: 1 },
  { name: "Developer",        description: "Desenvolvedor de software",                         order: 2 },
  { name: "Functional",       description: "Analista funcional",                                order: 3 },
  { name: "GP",               description: "Gerente de Projeto",                                order: 4 },
  { name: "Scrum Master",     description: "Scrum Master",                                      order: 5 },
  { name: "Tech Lead",        description: "Líder técnico da squad",                            order: 6 },
  { name: "Product Owner",    description: "Gestor de produto",                                 order: 7 },
  { name: "QA/Tester",        description: "Profissional de qualidade e testes",                order: 8 },
];

async function run() {
  console.log("=".repeat(60));
  console.log("🚀  seed_squad_roles — Banco Enterprise \"default\"");
  console.log("=".repeat(60));

  const colRef = db.collection("squadroles");

  // Leitura dos documentos existentes
  const existing = await colRef.get();
  console.log(`\n📊 Documentos existentes em squadroles: ${existing.size}`);

  if (existing.size > 0) {
    if (FORCE) {
      console.log("⚠️  --force ativo: removendo documentos existentes…");
      const batch = db.batch();
      existing.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      console.log(`🗑️  ${existing.size} documento(s) removido(s).`);
    } else {
      // Verifica se algum documento está mal-formado (sem campo 'name')
      const malformed = existing.docs.filter(d => !d.data().name);
      if (malformed.length > 0) {
        console.log(`⚠️  ${malformed.length} documento(s) sem campo 'name' detectado(s):`);
        malformed.forEach(d => console.log(`   - id: ${d.id}, dados:`, JSON.stringify(d.data())));
        console.log("   Removendo documentos mal-formados…");
        const batch = db.batch();
        malformed.forEach(d => batch.delete(d.ref));
        await batch.commit();
        console.log("🗑️  Documentos mal-formados removidos.");
      }

      // Verifica docs válidos restantes
      const validAfterClean = await colRef.get();
      const validDocs = validAfterClean.docs.filter(d => d.data().name);
      if (validDocs.length > 0) {
        console.log(`\n✅ Já existem ${validDocs.length} papéis válidos cadastrados:`);
        validDocs.forEach(d => console.log(`   - ${d.data().name}`));
        console.log("\nℹ️  Use --force para recriar. Encerrando sem alterações.");
        process.exit(0);
      }
    }
  }

  // Inserir papéis
  console.log("\n▶  Inserindo papéis padrão…");
  const batch = db.batch();
  for (const role of DEFAULT_ROLES) {
    const docId = role.name.toLowerCase().replace(/[\s/]+/g, "_");
    const ref = colRef.doc(docId);
    batch.set(ref, {
      name: role.name,
      description: role.description,
      order: role.order,
      squadId: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`   ✓ ${role.name} (id: ${docId})`);
  }
  await batch.commit();

  console.log(`\n✅ ${DEFAULT_ROLES.length} papéis inseridos com sucesso no banco Enterprise "default".`);
  console.log("=".repeat(60));
}

run()
  .then(() => process.exit(0))
  .catch(e => {
    console.error("❌ ERRO:", e);
    process.exit(1);
  });
