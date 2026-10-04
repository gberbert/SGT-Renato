/**
 * seed_all_enterprise.mjs
 *
 * Master seed script que popula todas as collections essenciais
 * no banco Enterprise "default" com dados padrão.
 *
 * Uso: node scripts/seed_all_enterprise.mjs
 *
 * Flags:
 *   --force   Remove todos os dados antes de reinseri-los
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
  "seed_all_enterprise"
);

// Banco Enterprise nomeado "default"
const db = getFirestore(appInst, "default");

// ============================================================================
// DEFAULT DATA
// ============================================================================

const DEFAULT_SQUAD_ROLES = [
  { name: "Arquiteto",        description: "Responsável pela arquitetura e design de soluções", order: 1 },
  { name: "Developer",        description: "Desenvolvedor de software",                         order: 2 },
  { name: "Functional",       description: "Analista funcional",                                order: 3 },
  { name: "GP",               description: "Gerente de Projeto",                                order: 4 },
  { name: "Scrum Master",     description: "Scrum Master",                                      order: 5 },
  { name: "Tech Lead",        description: "Líder técnico da squad",                            order: 6 },
  { name: "Product Owner",    description: "Gestor de produto",                                 order: 7 },
  { name: "QA/Tester",        description: "Profissional de qualidade e testes",                order: 8 },
];

const DEFAULT_TICKET_TYPES = [
  { name: "Bug",              description: "Correção de bug",                                   order: 1 },
  { name: "Feature",          description: "Nova funcionalidade",                               order: 2 },
  { name: "Improvement",      description: "Melhoria em funcionalidade existente",              order: 3 },
  { name: "Tech Debt",        description: "Débito técnico",                                    order: 4 },
  { name: "Documentation",    description: "Documentação",                                      order: 5 },
  { name: "Support",          description: "Suporte ao usuário",                                order: 6 },
];

const DEFAULT_WORKFLOWS = [
  { 
    name: "Backlog to Done", 
    description: "Workflow padrão de desenvolvimento",
    stages: [
      { id: "col-backlog",   name: "Backlog",   order: 1 },
      { id: "col-todo",      name: "A Fazer",   order: 2 },
      { id: "col-progress",  name: "Em Progresso", order: 3 },
      { id: "col-review",    name: "Review",    order: 4 },
      { id: "col-done",      name: "Concluído", order: 5 },
    ],
    order: 1 
  },
];

const DEFAULT_SYSTEMS = [
  { name: "SGT",             description: "Sistema de Gestão de Tickets",                      order: 1 },
  { name: "JIRA",            description: "Jira Integrado",                                     order: 2 },
  { name: "Operação",        description: "Sistema de Operação",                                order: 3 },
];

// ============================================================================
// SEED FUNCTIONS
// ============================================================================

async function seedCollection(collectionName, items, idField = "name") {
  console.log(`\n▶  Semeando collection "${collectionName}"…`);
  
  const colRef = db.collection(collectionName);
  const existing = await colRef.get();
  
  console.log(`   📊 Documentos existentes: ${existing.size}`);

  if (existing.size > 0 && !FORCE) {
    console.log(`   ℹ️  Pulando (use --force para recriar)`);
    return;
  }

  if (existing.size > 0 && FORCE) {
    console.log(`   ⚠️  Removendo ${existing.size} documento(s) existente(s)…`);
    const batch = db.batch();
    existing.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }

  const batch = db.batch();
  for (const item of items) {
    const docId = item[idField]?.toLowerCase().replace(/[\s/]+/g, "_") || item.name?.toLowerCase().replace(/[\s/]+/g, "_");
    const ref = colRef.doc(docId);
    batch.set(ref, {
      ...item,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`   ✓ ${item.name || item[idField]}`);
  }
  await batch.commit();
  console.log(`   ✅ ${items.length} documentos inseridos`);
}

async function run() {
  console.log("=".repeat(70));
  console.log("🚀  Seed All Collections — Banco Enterprise \"default\"");
  console.log("=".repeat(70));

  try {
    // Seed collections
    await seedCollection("squadroles", DEFAULT_SQUAD_ROLES, "name");
    await seedCollection("ticketTypes", DEFAULT_TICKET_TYPES, "name");
    await seedCollection("workflows", DEFAULT_WORKFLOWS, "name");
    await seedCollection("systems", DEFAULT_SYSTEMS, "name");

    console.log("\n" + "=".repeat(70));
    console.log("✅ Seed finalizado com sucesso!");
    console.log("=".repeat(70));
  } catch (error) {
    console.error("\n❌ ERRO:", error);
    process.exit(1);
  }
}

run()
  .then(() => process.exit(0))
  .catch(e => {
    console.error("❌ ERRO:", e);
    process.exit(1);
  });
