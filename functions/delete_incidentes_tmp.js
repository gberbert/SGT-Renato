/**
 * delete_incidentes_tmp.js  (rodar de dentro de functions/)
 * Remove da coleção tickets_global todos os documentos com escopo === 'INCIDENTE'
 *
 * Uso:
 *   node functions/delete_incidentes_tmp.js            → dry-run
 *   node functions/delete_incidentes_tmp.js --confirm  → deleta
 */

const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

// ── Lê FIREBASE_SA_PATH do .env ──────────────────────────────────────────────
function loadEnvVar(key) {
  try {
    const envFile = fs.readFileSync(path.resolve(__dirname, '.env'), 'utf8');
    const match = envFile.match(new RegExp(`^${key}=(.+)$`, 'm'));
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : null;
  } catch { return null; }
}

function findServiceAccount() {
  const envPath = process.env.FIREBASE_SA_PATH || loadEnvVar('FIREBASE_SA_PATH');
  if (envPath && fs.existsSync(envPath)) return envPath;
  const dir = path.resolve(__dirname, '../Arquivos_Gerais');
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f.includes('firebase-adminsdk'));
    if (files.length) return path.join(dir, files[0]);
  }
  return null;
}

const saPath = findServiceAccount();
if (!saPath) {
  console.error('❌ Service account não encontrado.');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
console.log(`🔑 Credencial: ${saPath} (project: ${serviceAccount.project_id})`);

const db = new Firestore({
  projectId: serviceAccount.project_id,
  credentials: {
    client_email: serviceAccount.client_email,
    private_key: serviceAccount.private_key,
  },
});

const COLLECTION = 'tickets_global';
const DRY_RUN = !process.argv.includes('--confirm');
const BATCH_SIZE = 400;

async function run() {
  console.log(`\n🔍 Buscando escopo INCIDENTE em "${COLLECTION}"…`);
  console.log(DRY_RUN ? '⚠️  DRY-RUN (--confirm para deletar)\n' : '⚠️  DELETANDO!\n');

  let total = 0;
  let deleted = 0;
  let lastDoc = null;

  while (true) {
    let q = db.collection(COLLECTION)
      .where('escopo', 'in', ['INCIDENTE', 'Incidente', 'incidente'])
      .limit(BATCH_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;

    total += snap.size;
    console.log(`  Lote: ${snap.size} docs (acumulado: ${total})`);

    if (!DRY_RUN) {
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      deleted += snap.size;
      console.log(`  ✅ ${snap.size} deletados`);
    } else {
      snap.docs.slice(0, 5).forEach(d => {
        const data = d.data();
        console.log(`  → ${d.id} | ${data.issueKey ?? '—'} | escopo: ${data.escopo ?? '—'} | ${String(data.summary ?? '').slice(0, 60)}`);
      });
      if (snap.size > 5) console.log(`  … e mais ${snap.size - 5} docs`);
    }

    if (DRY_RUN) {
      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < BATCH_SIZE) break;
    } else {
      if (snap.size < BATCH_SIZE) break;
    }
  }

  console.log('\n─────────────────────────────────────────────');
  if (DRY_RUN) {
    console.log(`📊 Total encontrado: ${total} tickets INCIDENTE`);
    console.log('ℹ️  Para deletar: node functions/delete_incidentes_tmp.js --confirm');
  } else {
    console.log(`🗑️  Total deletado: ${deleted} tickets INCIDENTE`);
  }
  console.log('─────────────────────────────────────────────\n');
}

run().catch(e => { console.error('Erro:', e); process.exit(1); });
