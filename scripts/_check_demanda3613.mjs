import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sa = require('../Arquivos_Gerais/sgt-renato-firebase-adminsdk-fbsvc-2c3d1c9c2c.json');
initializeApp({ credential: cert(sa) });
const db = getFirestore(undefined, 'default');

const doc = await db.collection('tickets_global').doc('DEMANDA-3613').get();
const data = doc.data();
console.log('percentualConclusao:', data.percentualConclusao);
console.log('percentualConclusaoTesteInterno:', data.percentualConclusaoTesteInterno);
const log = await db.collection('tickets_global').doc('DEMANDA-3613').collection('statusChangeLog').get();
console.log('statusChangeLog entries:', log.size);
log.forEach(d => {
  const dd = d.data();
  const ts = dd.changedAt?.toDate?.()?.toISOString?.()?.slice(0,10) || dd.changedAt;
  console.log(' field:', dd.field, '| newValue:', dd.newValue, '| changedAt:', ts);
});
process.exit(0);
