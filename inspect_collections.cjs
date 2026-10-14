const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const sa = require('./Arquivos_Gerais/sgt-renato-firebase-adminsdk-fbsvc-2c3d1c9c2c.json');
initializeApp({ credential: cert(sa) });
const db = getFirestore(undefined, 'default');

async function main() {
  // Check grupo_atendimento
  const ga = await db.collection('grupo_atendimento').get();
  console.log('=== grupo_atendimento: ' + ga.size + ' docs ===');
  ga.forEach(d => {
    console.log('  [' + d.id + ']', JSON.stringify(d.data()).slice(0, 300));
  });

  // Check operacao_config
  const oc = await db.collection('operacao_config').get();
  console.log('\n=== operacao_config: ' + oc.size + ' docs ===');
  oc.forEach(d => {
    console.log('  [' + d.id + ']', JSON.stringify(d.data()).slice(0, 400));
  });

  // Check escopo collection (might store system/group mappings)
  const esc = await db.collection('escopo').limit(5).get();
  console.log('\n=== escopo: ' + esc.size + ' docs (sample) ===');
  esc.forEach(d => {
    console.log('  [' + d.id + ']', JSON.stringify(d.data()).slice(0, 300));
  });

  // Check operacao_stats (might have sistema names)
  const os = await db.collection('operacao_stats').limit(5).get();
  console.log('\n=== operacao_stats: ' + os.size + ' docs (sample) ===');
  os.forEach(d => {
    const data = d.data();
    const keys = Object.keys(data).slice(0, 10);
    const sub = {};
    keys.forEach(k => { sub[k] = data[k]; });
    console.log('  [' + d.id + ']', JSON.stringify(sub).slice(0, 300));
  });

  // Check tickets collection (different from tickets_global)
  const t = await db.collection('tickets').limit(3).get();
  console.log('\n=== tickets: ' + t.size + ' docs (sample) ===');
  t.forEach(d => {
    const data = d.data();
    const keys = ['sistemaId', 'sistema', 'sistemaNome', 'grupoSuporte', 'grupoSolucionador', 'sistemasImpactados', 'sistema_id'];
    const sub = {};
    Object.keys(data).forEach(k => { sub[k] = typeof data[k] === 'string' ? data[k] : JSON.stringify(data[k]).slice(0,80); });
    console.log('  [' + d.id + ']', JSON.stringify(sub).slice(0, 400));
  });

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
