/**
 * seed_baseline_percentual_conclusao.mjs
 *
 * Para tickets que têm %Conclusão preenchido mas NÃO possuem registro no statusChangeLog
 * antes de 10/10/2026, insere um documento de baseline nessa subcollection.
 *
 * Dry-run por padrão. Use --apply para gravar.
 *
 * Uso:
 *   node scripts/seed_baseline_percentual_conclusao.mjs           # dry-run
 *   node scripts/seed_baseline_percentual_conclusao.mjs --apply   # grava
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sa = require('../Arquivos_Gerais/sgt-renato-firebase-adminsdk-fbsvc-2c3d1c9c2c.json');

initializeApp({ credential: cert(sa) });
const db = getFirestore(undefined, 'default');

const APPLY = process.argv.includes('--apply');
const BASELINE_DATE = new Date('2026-10-10T12:00:00-03:00'); // meio-dia horário de Brasília
const BASELINE_TS = Timestamp.fromDate(BASELINE_DATE);
const BASELINE_ISO = '2026-10-10';
const PAGE = 500;

const FIELDS = [
  { field: 'percentualConclusao',            fieldLabel: '% Conclusão' },
  { field: 'percentualConclusaoTesteInterno', fieldLabel: '% Conclusão Teste Interno' },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log(`\n=== seed_baseline_percentual_conclusao [${APPLY ? 'APPLY' : 'DRY-RUN'}] ===`);
  console.log(`Baseline date: ${BASELINE_ISO}\n`);

  let totalChecked = 0;
  let totalInserted = 0;
  let totalSkipped = 0;
  let lastDoc = null;

  while (true) {
    let q = db.collection('tickets_global').limit(PAGE);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;

    // Cache statusChangeLog per ticket to avoid duplicate reads for both FIELDS
    const allLogByTicket = new Map();

    for (const ticketDoc of snap.docs) {
      const data = ticketDoc.data();
      const issueKey = data.issueKey || ticketDoc.id;
      totalChecked++;

      for (const { field, fieldLabel } of FIELDS) {
        const currentVal = data[field];
        if (currentVal == null || currentVal === '' || Number(currentVal) === 0) continue;
        const numVal = Number(currentVal);
        if (!Number.isFinite(numVal) || numVal <= 0) continue;

        // Fetch ALL statusChangeLog entries (no WHERE to avoid index issues) and filter in memory
        // Only fetch once per ticket - cache below
        if (!allLogByTicket.has(ticketDoc.id)) {
          const allLog = await db
            .collection('tickets_global')
            .doc(ticketDoc.id)
            .collection('statusChangeLog')
            .get();
          allLogByTicket.set(ticketDoc.id, allLog.docs.map(d => ({ id: d.id, ...d.data() })));
        }
        const allLogDocs = allLogByTicket.get(ticketDoc.id);
        const fieldDocs = allLogDocs.filter(d => d.field === field);

        // Check if any entry is at or before baseline date
        let hasBaseline = false;
        for (const logDoc of fieldDocs) {
          const ts = logDoc.changedAt;
          if (!ts) continue;
          const d = ts.toDate ? ts.toDate() : new Date(ts);
          if (d.toISOString().slice(0, 10) <= BASELINE_ISO) {
            hasBaseline = true;
            break;
          }
        }

        if (hasBaseline) {
          totalSkipped++;
          continue;
        }

        // Determine oldValue from the first (oldest) entry for this field
        let oldValue = null;
        if (fieldDocs.length > 0) {
          const sorted = fieldDocs
            .filter(d => d.changedAt)
            .sort((a, b) => {
              const ta = a.changedAt.toDate ? a.changedAt.toDate() : new Date(a.changedAt);
              const tb = b.changedAt.toDate ? b.changedAt.toDate() : new Date(b.changedAt);
              return ta - tb;
            });
          if (sorted.length > 0) {
            const ov = sorted[0].oldValue;
            oldValue = ov != null ? Number(ov) : null;
          }
        }

        const newDoc = {
          field,
          fieldLabel,
          newValue: numVal,
          oldValue: oldValue ?? null,
          changedAt: BASELINE_TS,
          changedBy: 'baseline_migration',
          source: 'baseline',
          baseline: true,
          migratedAt: Timestamp.now(),
        };

        if (APPLY) {
          await db
            .collection('tickets_global')
            .doc(ticketDoc.id)
            .collection('statusChangeLog')
            .add(newDoc);
        }

        totalInserted++;
        console.log(`  ${APPLY ? '✅' : '📝'} [${issueKey}] ${fieldLabel}: ${numVal}% → baseline inserido${APPLY ? '' : ' (dry-run)'}`);
      }
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE) break;
    await sleep(200);
  }

  console.log('\n=== RESUMO ===');
  console.log(`Tickets verificados : ${totalChecked}`);
  console.log(`Baselines inseridos : ${totalInserted}`);
  console.log(`Já tinham baseline  : ${totalSkipped}`);
  if (!APPLY) console.log('\n⚠️  Execute com --apply para gravar no Firestore.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
