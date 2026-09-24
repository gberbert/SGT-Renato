/**
 * Migração: remove prefixo numérico de prioridadeInterna em tickets_global
 *
 * Converte valores como '5-Muito baixo', '1-Crítico', '2-Alto', etc.
 * para apenas o label limpo ('Muito baixo', 'Crítico', 'Alto', ...)
 *
 * Uso:
 *   node scripts/migrate_prioridade_interna.mjs [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert, getApps, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SA_PATH = path.resolve(__dirname, '../Arquivos_Gerais/sgt-renato-firebase-adminsdk-fbsvc-2c3d1c9c2c.json');
const DRY_RUN = process.argv.includes('--dry-run');

// Padrão: qualquer string que começa com dígito(s) seguido de hífen
// Ex: '5-Muito baixo' → 'Muito baixo'  |  '1-Crítico' → 'Crítico'
const PREFIX_RE = /^\d+[-–]\s*/;

function stripPrefix(value) {
  if (typeof value !== 'string') return null;
  if (!PREFIX_RE.test(value)) return null;
  return value.replace(PREFIX_RE, '').trim();
}

async function getDb() {
  if (!fs.existsSync(SA_PATH)) {
    throw new Error(`Service account não encontrado: ${SA_PATH}`);
  }
  const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));

  const app = initializeApp({ credential: cert(sa), projectId: sa.project_id });

  // Tenta '(default)', com fallback para 'default'
  const databaseIds = [
    process.env.FIRESTORE_DATABASE_ID || '(default)',
    'default',
  ];

  for (const databaseId of databaseIds) {
    console.log(`Conectando ao Firestore databaseId="${databaseId}" projeto="${sa.project_id}"`);
    const db = getFirestore(app, databaseId);
    try {
      await db.collection('tickets_global').limit(1).get();
      console.log(`✔ Conexão OK com databaseId="${databaseId}"`);
      return db;
    } catch (e) {
      console.log(`  ✗ Falhou (${e?.message?.split('\n')[0]})`);
    }
  }

  throw new Error('Não foi possível conectar ao Firestore com nenhum databaseId.');
}

async function run() {
  console.log(DRY_RUN ? '🔍 DRY-RUN ativo — nenhuma escrita será feita\n' : '🚀 Modo real — atualizando Firestore\n');

  const db = await getDb();

  const snap = await db.collection('tickets_global').select('prioridadeInterna').get();
  console.log(`\nTotal de documentos lidos: ${snap.size}`);

  const toUpdate = [];
  snap.docs.forEach(doc => {
    const raw = doc.data().prioridadeInterna;
    const clean = stripPrefix(raw);
    if (clean !== null) {
      toUpdate.push({ ref: doc.ref, id: doc.id, from: raw, to: clean });
    }
  });

  if (toUpdate.length === 0) {
    console.log('✅ Nenhum documento precisa de migração.');
    return;
  }

  console.log(`\nDocumentos a migrar: ${toUpdate.length}`);

  // Preview das transformações únicas
  const unique = [...new Map(toUpdate.map(x => [x.from, x.to])).entries()];
  console.log('\nMapeamento detectado:');
  unique.forEach(([from, to]) => console.log(`  "${from}"  →  "${to}"`));

  if (DRY_RUN) {
    console.log('\n[DRY-RUN] Nenhuma alteração gravada.');
    return;
  }

  // Escrever em batches de 500
  const BATCH_SIZE = 500;
  let updated = 0;
  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const chunk = toUpdate.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    chunk.forEach(({ ref, to }) => batch.update(ref, { prioridadeInterna: to }));
    await batch.commit();
    updated += chunk.length;
    console.log(`  ✔ ${updated}/${toUpdate.length} atualizados`);
  }

  console.log(`\n✅ Migração concluída: ${updated} documentos atualizados.`);
}

run().catch(err => {
  console.error('Erro na migração:', err);
  process.exit(1);
});
