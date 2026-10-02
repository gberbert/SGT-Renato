const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const sa = require('./Arquivos_Gerais/sgt-renato-firebase-adminsdk-fbsvc-2c3d1c9c2c.json');
initializeApp({ credential: cert(sa) });
const db = getFirestore(undefined, 'default');
// 1) Verificar projectKeys distintos na collection
// 2) Pegar 1 ticket de ciclos_planejamento e buscar os tickets reais
async function main() {
  // Amostra de tickets_global para ver projectKeys existentes
  const sample = await db.collection('tickets_global').limit(200).get();
  const pkCounts = {};
  sample.forEach(d => {
    const pk = d.data().projectKey || d.data().escopo || '(sem projectKey)';
    pkCounts[pk] = (pkCounts[pk] || 0) + 1;
  });
  console.log('=== projectKeys na amostra de 200 docs de tickets_global ===');
  Object.entries(pkCounts).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(' ', k, ':', v));

  // Pegar um ciclo de ciclos_planejamento
  const ciclos = await db.collection('ciclos_planejamento').limit(3).get();
  console.log('\n=== ciclos_planejamento ===', ciclos.size, 'docs');
  for (const c of ciclos.docs) {
    const cicloData = c.data();
    const keys = (cicloData.ticketKeys || []).slice(0, 5);
    console.log('Ciclo:', c.id, '| ticketKeys sample:', keys);
    if (keys.length > 0) {
      // buscar 1 ticket por document ID (issueKey = doc ID)
      const ticketDoc = await db.collection('tickets_global').doc(keys[0]).get();
      if (ticketDoc.exists) {
        const td = ticketDoc.data();
        console.log('  Ticket', keys[0], '| squad:', td.squad, '| squadPrincipal:', td.squadPrincipal,
          '| _resolvedSquad:', td._resolvedSquad, '| sistemasImpactados:', td.sistemasImpactados,
          '| estimativaMacro:', td.estimativaMacro, '| grupoSuporte:', td.grupoSuporte);
      } else {
        console.log('  Ticket', keys[0], 'NÃO encontrado em tickets_global');
      }
    }
  }
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
