/**
 * delete_incidentes.mjs
 * Remove da coleção tickets_global todos os documentos com escopo === 'INCIDENTE'
 * (ou variações com acento / maiúscula).
 *
 * Uso:
 *   node scripts/delete_incidentes.mjs            → apenas lista (dry-run)
 *   node scripts/delete_incidentes.mjs --confirm  → deleta de verdade
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Lê FIREBASE_SA_PATH do functions/.env manualmente (sem dotenv) ──────────
function loadEnvVar(key) {
  try {
    const envFile = readFileSync(resolve(__dirname, '../functions/.env'), 'utf8');
    const match = envFile.match(new RegExp(`^${key}=(.+)$`, 'm'));
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : null;
  } catch { return null; }
}

// ── Localiza service account (igual ao carga_por_escopo.mjs) ────────────────
function findServiceAccount() {
  const envPath = process.env.FIREBASE_SA_PATH || loadEnvVar('FIREBASE_SA_PATH');
  if (envPath && existsSync(envPath)) return envPath;
  const dir = resolve(__dirname, '../Arquivos_Gerais');
  if (existsSync(dir)) {
    const files = readdirSync(dir).filter(f => f.endsWith('.json') && f.includes('firebase-adminsdk'));
    if (files.length) return join(dir, files[0]);
  }
  return null;
}

const saPath = findServiceAccount();
if (!saPath) {
  console.error('❌ Service account não encontrado. Defina FIREBASE_SA_PATH em functions/.env ou coloque o JSON em Arquivos_Gerais/');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(saPath, 'utf8'));
initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id,
});
console.log(`🔑 Usando credencial: ${saPath} (project: ${serviceAccount.project_id})`);
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

const COLLECTION = 'tickets_global';
const DRY_RUN = !process.argv.includes('--confirm');
const BATCH_SIZE = 400;

// Valores aceitos como "INCIDENTE" (case-insensitive + variações)
const INCIDENTE_PATTERNS = /^incidente$/i;

async function run() {
  console.log(`\n🔍 Buscando documentos com escopo INCIDENTE em "${COLLECTION}"…`);
  console.log(DRY_RUN ? '⚠️  MODO DRY-RUN (use --confirm para deletar)\n' : '⚠️  MODO DESTRUTIVO — deletando!\n');

  let total = 0;
  let deleted = 0;
  let lastDoc = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q = db.collection(COLLECTION)
      .where('escopo', 'in', ['INCIDENTE', 'Incidente', 'incidente'])
      .limit(BATCH_SIZE);

    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;

    total += snap.size;
    console.log(`  Lote: ${snap.size} docs encontrados (total acumulado: ${total})`);

    if (!DRY_RUN) {
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      deleted += snap.size;
      console.log(`  ✅ ${snap.size} deletados`);
    } else {
      // Em dry-run, apenas lista alguns exemplos
      snap.docs.slice(0, 5).forEach(d => {
        const data = d.data();
        console.log(`  → ${d.id} | issueKey: ${data.issueKey ?? '—'} | escopo: ${data.escopo ?? '—'} | summary: ${String(data.summary ?? '').slice(0, 60)}`);
      });
      if (snap.size > 5) console.log(`  … e mais ${snap.size - 5} docs`);
    }

    // Paginação: se retornou menos que BATCH_SIZE, acabou (Firestore where + limit pagina pelo cursor)
    // Como deletamos, na próxima iteração o query começa do zero
    if (DRY_RUN) {
      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < BATCH_SIZE) break;
    } else {
      // Após deletar, não precisamos de cursor — o where vai retornar os próximos
      if (snap.size < BATCH_SIZE) break;
    }
  }

  console.log('\n─────────────────────────────────────────────────────');
  if (DRY_RUN) {
    console.log(`📊 Total encontrado: ${total} tickets com escopo INCIDENTE`);
    console.log('ℹ️  Para deletar, execute: node scripts/delete_incidentes.mjs --confirm');
  } else {
    console.log(`🗑️  Total deletado: ${deleted} tickets com escopo INCIDENTE`);
  }
  console.log('─────────────────────────────────────────────────────\n');
}

run().catch(e => { console.error('Erro:', e); process.exit(1); });
