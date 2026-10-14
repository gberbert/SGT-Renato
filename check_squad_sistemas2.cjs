/**
 * check_squad_sistemas2.cjs
 * Verifica a consistência entre:
 *  - collection 'systems' (lista de sistemas cadastrados em Configurações > Sistemas)
 *  - campo 'systemIds' nos documentos de 'squads' (lista de sistemas associados a cada squad)
 *  - campo 'squadId' nos documentos de 'systems' (relação inversa)
 */
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const sa = require('./Arquivos_Gerais/sgt-renato-firebase-adminsdk-fbsvc-2c3d1c9c2c.json');
initializeApp({ credential: cert(sa) });
const db = getFirestore(undefined, 'default');

async function main() {
  // 1) Carregar todos os sistemas
  const systemsSnap = await db.collection('systems').get();
  const systemsById = {};
  systemsSnap.forEach(d => {
    systemsById[d.id] = { id: d.id, ...d.data() };
  });
  console.log(`\n=== SISTEMAS cadastrados (collection 'systems'): ${systemsSnap.size} total ===`);
  Object.values(systemsById).forEach(s => {
    console.log(`  [${s.id}]  "${s.name}"  | squadId: ${s.squadId || '(nenhum)'}  | projectId: ${s.projectId || '(nenhum)'}`);
  });

  // 2) Carregar todos os squads
  const squadsSnap = await db.collection('squads').get();
  console.log(`\n=== SQUADS cadastrados: ${squadsSnap.size} total ===`);

  for (const squadDoc of squadsSnap.docs) {
    const sq = { id: squadDoc.id, ...squadDoc.data() };
    const systemIds = sq.systemIds || (sq.systemId ? [sq.systemId] : []);

    console.log(`\n--- Squad: "${sq.name}" [${sq.id}]  | projectId: ${sq.projectId || '(nenhum)'} ---`);
    console.log(`  systemIds no documento: ${systemIds.length}`);

    if (systemIds.length === 0) {
      console.log('  (nenhum sistema associado via systemIds)');
      continue;
    }

    let okCount = 0;
    let missingCount = 0;
    for (const sysId of systemIds) {
      const sys = systemsById[sysId];
      if (sys) {
        const squadMismatch = sys.squadId && sys.squadId !== sq.id ? ` ⚠️  sys.squadId aponta para OUTRA squad: ${sys.squadId}` : '';
        const squadMissing = !sys.squadId ? ` ⚠️  sys.squadId está VAZIO no documento do sistema` : '';
        console.log(`  ✅  [${sysId}]  "${sys.name}"${squadMismatch}${squadMissing}`);
        okCount++;
      } else {
        console.log(`  ❌  [${sysId}]  — NÃO encontrado na collection 'systems'`);
        missingCount++;
      }
    }
    console.log(`  → OK: ${okCount}  |  Não encontrados: ${missingCount}`);

    // Verificar sistemas que têm squadId apontando para esta squad mas NÃO estão em systemIds
    const inverseOrphans = Object.values(systemsById).filter(
      s => s.squadId === sq.id && !systemIds.includes(s.id)
    );
    if (inverseOrphans.length > 0) {
      console.log(`  ⚠️  Sistemas com squadId="${sq.id}" mas AUSENTES em systemIds:`);
      inverseOrphans.forEach(s => console.log(`       [${s.id}]  "${s.name}"`));
    }
  }

  // 3) Sistemas órfãos: têm squadId mas esse squad não existe
  console.log(`\n=== Sistemas com squadId que não corresponde a nenhum squad ===`);
  const squadIds = new Set(squadsSnap.docs.map(d => d.id));
  const orphanSystems = Object.values(systemsById).filter(s => s.squadId && !squadIds.has(s.squadId));
  if (orphanSystems.length === 0) {
    console.log('  Nenhum sistema órfão encontrado.');
  } else {
    orphanSystems.forEach(s => {
      console.log(`  ⚠️  [${s.id}]  "${s.name}"  | squadId inválido: ${s.squadId}`);
    });
  }

  // 4) Sistemas sem squadId e sem nenhuma squad que os referencie via systemIds
  console.log(`\n=== Sistemas SEM squad (nem squadId, nem em systemIds de qualquer squad) ===`);
  const allReferencedBySquads = new Set();
  squadsSnap.forEach(d => {
    const ids = d.data().systemIds || (d.data().systemId ? [d.data().systemId] : []);
    ids.forEach(id => allReferencedBySquads.add(id));
  });
  const unassociated = Object.values(systemsById).filter(
    s => !s.squadId && !allReferencedBySquads.has(s.id)
  );
  if (unassociated.length === 0) {
    console.log('  Todos os sistemas estão associados a pelo menos uma squad.');
  } else {
    unassociated.forEach(s => console.log(`  [${s.id}]  "${s.name}"  | projectId: ${s.projectId || '(nenhum)'}`));
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
