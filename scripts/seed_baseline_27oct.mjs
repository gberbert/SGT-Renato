/**
 * seed_baseline_27oct.mjs
 *
 * Grava os campos de baseline nos documentos de tickets_global:
 *   baselinePercentualConclusao        <- valor atual de percentualConclusao
 *   baselinePercentualConclusaoTeste   <- valor atual de percentualConclusaoTesteInterno
 *   baselineDate                       <- '2026-10-27'
 *
 * Dry-run por padrão. Use --apply para gravar no Firestore.
 *
 * Uso:
 *   node scripts/seed_baseline_27oct.mjs           # dry-run
 *   node scripts/seed_baseline_27oct.mjs --apply   # grava
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sa = require('../Arquivos_Gerais/sgt-renato-firebase-adminsdk-fbsvc-2c3d1c9c2c.json');

initializeApp({ credential: cert(sa) });
const db = getFirestore(undefined, 'default');

const APPLY = process.argv.includes('--apply');
const BASELINE_DATE = '2026-10-27';
const PAGE = 500;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log(`\n=== seed_baseline_27oct [${APPLY ? 'APPLY' : 'DRY-RUN'}] ===`);
  console.log(`Baseline date: ${BASELINE_DATE}\n`);

  let totalChecked = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let lastDoc = null;

  while (true) {
    let q = db.collection('tickets_global').limit(PAGE);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    let batchCount = 0;

    for (const ticketDoc of snap.docs) {
      const data = ticketDoc.data();
      const issueKey = data.issueKey || ticketDoc.id;
      totalChecked++;

      const devVal = data.percentualConclusao != null ? Number(data.percentualConclusao) : null;
      const testeVal = data.percentualConclusaoTesteInterno != null ? Number(data.percentualConclusaoTesteInterno) : null;

      // Skip if both values are null/0 and baseline already set
      if (devVal == null && testeVal == null) {
        totalSkipped++;
        continue;
      }

      // Check if already seeded to avoid overwrite
      if (data.baselineDate === BASELINE_DATE) {
        totalSkipped++;
        continue;
      }

      const update = {
        baselineDate: BASELINE_DATE,
        baselinePercentualConclusao: devVal ?? 0,
        baselinePercentualConclusaoTeste: testeVal ?? 0,
        baselineSeededAt: Timestamp.now(),
      };

      if (APPLY) {
        batch.update(ticketDoc.ref, update);
        batchCount++;
      }

      totalUpdated++;
      console.log(
        `  ${APPLY ? '✅' : '📝'} [${issueKey}]  dev=${devVal ?? '—'}%  teste=${testeVal ?? '—'}%`
        + (APPLY ? '' : '  (dry-run)')
      );

      // Flush batch every 400 docs
      if (APPLY && batchCount >= 400) {
        await batch.commit();
        batchCount = 0;
        await sleep(100);
      }
    }

    if (APPLY && batchCount > 0) {
      await batch.commit();
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE) break;
    await sleep(200);
  }

  console.log('\n=== RESUMO ===');
  console.log(`Tickets verificados : ${totalChecked}`);
  console.log(`Baseline gravado    : ${totalUpdated}`);
  console.log(`Ignorados           : ${totalSkipped}`);
  if (!APPLY) console.log('\n⚠️  Execute com --apply para gravar no Firestore.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
