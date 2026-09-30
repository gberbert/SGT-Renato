/**
 * fix_escopo_misclass.mjs
 * Revisa e corrige/deleta tickets_global com classificação de escopo incorreta.
 *
 * Casos tratados (conforme screenshot byIssueTypeByEscopo):
 *   escopo="DEMANDA FAST" + issueType="[System] Service request"  → correto: SOLICITACAO
 *   escopo="DEMANDA FAST" + issueType="[System] Incidente"         → correto: INCIDENTE
 *   escopo="INCIDENTE"    + issueType="[System] Service request"  → correto: SOLICITACAO
 *
 * Uso:
 *   node scripts/fix_escopo_misclass.mjs               → dry-run (lista contagens e exemplos)
 *   node scripts/fix_escopo_misclass.mjs --fix          → corrige o campo escopo no Firestore
 *   node scripts/fix_escopo_misclass.mjs --delete       → deleta os tickets misclassificados
 *   node scripts/fix_escopo_misclass.mjs --escopo DEMANDA_FAST   → filtra só esse grupo
 *   node scripts/fix_escopo_misclass.mjs --escopo INCIDENTE      → filtra só esse grupo
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Lê FIREBASE_SA_PATH do functions/.env ───────────────────────────────────
function loadEnvVar(key) {
  try {
    const envFile = readFileSync(resolve(__dirname, '../functions/.env'), 'utf8');
    const match = envFile.match(new RegExp(`^${key}=(.+)$`, 'm'));
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : null;
  } catch { return null; }
}

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
initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
console.log(`🔑 Usando credencial: ${saPath} (project: ${serviceAccount.project_id})`);
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

// ── CLI flags ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const MODE_FIX    = args.includes('--fix');
const MODE_DELETE = args.includes('--delete');
const DRY_RUN     = !MODE_FIX && !MODE_DELETE;

const escopoFilterIdx = args.indexOf('--escopo');
const escopoFilter = escopoFilterIdx >= 0 ? args[escopoFilterIdx + 1]?.toUpperCase().replace(/_/g, ' ') : null;

// ── Regras de misclassificação ───────────────────────────────────────────────
// Cada regra define: escopo incorreto atual + issueType detectado → escopo correto
const RULES = [
  {
    id: 'DEMANDA_FAST_SERVICE_REQUEST',
    escopo: 'DEMANDA FAST',
    issueTypePattern: /service\s*request/i,
    issueTypeLabel: '[System] Service request',
    correctEscopo: 'SOLICITACAO',
    description: 'DEMANDA FAST com issueType Service request → SOLICITACAO',
  },
  {
    id: 'DEMANDA_FAST_INCIDENTE',
    escopo: 'DEMANDA FAST',
    issueTypePattern: /incidente/i,
    issueTypeLabel: '[System] Incidente',
    correctEscopo: 'INCIDENTE',
    description: 'DEMANDA FAST com issueType Incidente → INCIDENTE',
  },
  {
    id: 'INCIDENTE_SERVICE_REQUEST',
    escopo: 'INCIDENTE',
    issueTypePattern: /service\s*request/i,
    issueTypeLabel: '[System] Service request',
    correctEscopo: 'SOLICITACAO',
    description: 'INCIDENTE com issueType Service request → SOLICITACAO',
  },
];

const COLLECTION = 'tickets_global';
const BATCH_SIZE = 400;

// ── Utilitários ──────────────────────────────────────────────────────────────
function pad(str, len) { return String(str).padEnd(len, ' '); }

async function processRule(rule) {
  if (escopoFilter && rule.escopo !== escopoFilter) return { count: 0, fixed: 0, deleted: 0 };

  console.log(`\n📋 Regra: ${rule.description}`);
  console.log(`   Buscando escopo="${rule.escopo}" + issueType ≈ "${rule.issueTypeLabel}"…`);

  // Firestore não suporta filtro regex — filtramos no cliente após buscar por escopo
  let total = 0;
  let processed = 0;
  let lastDoc = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q = db.collection(COLLECTION)
      .where('escopo', '==', rule.escopo)
      .limit(BATCH_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;

    // Filtrar pelo issueType no cliente
    const matched = snap.docs.filter(d => {
      const it = String(d.data().issueType || d.data().tipo || '');
      return rule.issueTypePattern.test(it);
    });

    total += matched.length;

    if (matched.length > 0) {
      if (DRY_RUN) {
        console.log(`   Lote: ${matched.length} misclassificados (de ${snap.size} com escopo="${rule.escopo}")`);
        matched.slice(0, 5).forEach(d => {
          const data = d.data();
          const it = data.issueType || data.tipo || '—';
          console.log(`     → ${pad(d.data().issueKey || d.id, 22)} | issueType: ${pad(String(it).slice(0,35), 37)} | summary: ${String(data.summary || '').slice(0, 50)}`);
        });
        if (matched.length > 5) console.log(`     … e mais ${matched.length - 5}`);
      } else if (MODE_FIX) {
        const batch = db.batch();
        matched.forEach(d => batch.update(d.ref, {
          escopo: rule.correctEscopo,
          escopoOriginal: rule.escopo,
          escopoFixedAt: new Date().toISOString(),
        }));
        await batch.commit();
        processed += matched.length;
        console.log(`   ✅ ${matched.length} tickets com escopo corrigido → "${rule.correctEscopo}"`);
      } else if (MODE_DELETE) {
        const batch = db.batch();
        matched.forEach(d => batch.delete(d.ref));
        await batch.commit();
        processed += matched.length;
        console.log(`   🗑️  ${matched.length} tickets deletados (escopo="${rule.escopo}" + issueType≈"${rule.issueTypeLabel}")`);
      }
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < BATCH_SIZE) break;
  }

  return { count: total, fixed: MODE_FIX ? processed : 0, deleted: MODE_DELETE ? processed : 0 };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  const modeLabel = DRY_RUN ? '🔍 DRY-RUN' : MODE_FIX ? '🔧 FIX' : '🗑️  DELETE';
  console.log(`\n${'═'.repeat(60)}`);
  console.log(` fix_escopo_misclass.mjs — modo: ${modeLabel}`);
  if (escopoFilter) console.log(` Filtro: escopo="${escopoFilter}"`);
  console.log(`${'═'.repeat(60)}`);

  if (DRY_RUN) {
    console.log('\n⚠️  MODO DRY-RUN — nenhuma alteração será feita.');
    console.log('   Use --fix para corrigir o campo escopo.');
    console.log('   Use --delete para deletar os tickets misclassificados.\n');
  }

  let grandTotal = 0;
  const summary = [];

  for (const rule of RULES) {
    const result = await processRule(rule);
    grandTotal += result.count;
    summary.push({ rule, ...result });
  }

  // ── Resumo final ──────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(60)}`);
  console.log(' RESUMO');
  console.log(`${'─'.repeat(60)}`);
  console.log(` ${pad('Regra', 45)} ${pad('Contagem', 10)} ${MODE_FIX ? 'Corrigidos' : MODE_DELETE ? 'Deletados' : 'Encontrados'}`);
  console.log(` ${'─'.repeat(58)}`);
  for (const s of summary) {
    const action = MODE_FIX ? s.fixed : MODE_DELETE ? s.deleted : s.count;
    console.log(` ${pad(s.rule.description, 45)} ${pad(s.count, 10)} ${action}`);
  }
  console.log(` ${'─'.repeat(58)}`);
  console.log(` ${'TOTAL'.padEnd(45)} ${grandTotal}`);
  console.log(`${'─'.repeat(60)}\n`);

  if (DRY_RUN && grandTotal > 0) {
    console.log('ℹ️  Próximos passos:');
    console.log('   node scripts/fix_escopo_misclass.mjs --fix          → corrige escopo no lugar');
    console.log('   node scripts/fix_escopo_misclass.mjs --delete        → remove para re-carga via JQL');
    console.log('   node scripts/fix_escopo_misclass.mjs --fix --escopo DEMANDA_FAST  → só DEMANDA FAST\n');
  }
}

run().catch(e => { console.error('Erro:', e); process.exit(1); });
