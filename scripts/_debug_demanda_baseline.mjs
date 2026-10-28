import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sa = require('../Arquivos_Gerais/sgt-renato-firebase-adminsdk-fbsvc-2c3d1c9c2c.json');
initializeApp({ credential: cert(sa) });
const db = getFirestore(undefined, 'default');

const APPLY = process.argv.includes('--apply');
const BASELINE_ISO = '2026-10-10';
const BASELINE_TS = Timestamp.fromDate(new Date('2026-10-10T12:00:00-03:00'));
const FIELDS = [
  { field: 'percentualConclusao', fieldLabel: '% Conclusão' },
  { field: 'percentualConclusaoTesteInterno', fieldLabel: '% Conclusão Teste Interno' },
];

// Query only DEMANDA tickets
const snap = await db.collection('tickets_global')
  .where('escopo', '==', 'DEMANDA')
  .get();

console.log(`DEMANDA tickets found: ${snap.size}`);

let inserted = 0;
for (const ticketDoc of snap.docs) {
  const data = ticketDoc.data();
  const issueKey = data.issueKey || ticketDoc.id;

  const logSnap = await db.collection('tickets_global').doc(ticketDoc.id).collection('statusChangeLog').get();
  const allLog = logSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  for (const { field, fieldLabel } of FIELDS) {
    const currentVal = data[field];
    if (currentVal == null || currentVal === '' || Number(currentVal) === 0) continue;
    const numVal = Number(currentVal);
    if (!Number.isFinite(numVal) || numVal <= 0) continue;

    const fieldDocs = allLog.filter(d => d.field === field);
    let hasBaseline = false;
    for (const logDoc of fieldDocs) {
      const ts = logDoc.changedAt;
      if (!ts) continue;
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      if (d.toISOString().slice(0, 10) <= BASELINE_ISO) { hasBaseline = true; break; }
    }
    if (hasBaseline) continue;

    inserted++;
    console.log(`  ${APPLY ? '✅' : '📝'} [${issueKey}] ${fieldLabel}: ${numVal}%`);

    if (APPLY) {
      const ov = fieldDocs.length > 0
        ? Number(fieldDocs.sort((a,b) => (a.changedAt?.toDate?.()??new Date(a.changedAt)) - (b.changedAt?.toDate?.()??new Date(b.changedAt)))[0].oldValue) || null
        : null;
      await db.collection('tickets_global').doc(ticketDoc.id).collection('statusChangeLog').add({
        field, fieldLabel, newValue: numVal, oldValue: ov, changedAt: BASELINE_TS,
        changedBy: 'baseline_migration', source: 'baseline', baseline: true,
        migratedAt: Timestamp.now(),
      });
    }
  }
}

console.log(`\nTotal a inserir: ${inserted}`);
if (!APPLY) console.log('Execute com --apply para gravar.');
process.exit(0);
