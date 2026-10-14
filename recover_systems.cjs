/**
 * recover_systems.cjs
 * Recupera os documentos da collection 'systems' a partir de:
 *  1) Dados nos documentos de 'squads' (systemIds)
 *  2) Dados em 'tickets_global' (sistemaId, sistemasImpactados, grupoSuporte, sistema, sistemaNome)
 *  3) Quaisquer outros campos relevantes encontrados
 *
 * Modo dry-run por padrao. Use --restore para gravar de fato no Firestore.
 */
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const sa = require('./Arquivos_Gerais/sgt-renato-firebase-adminsdk-fbsvc-2c3d1c9c2c.json');
initializeApp({ credential: cert(sa) });
const db = getFirestore(undefined, 'default');

const RESTORE = process.argv.includes('--restore');

async function main() {
  // 1) Coletar todos os systemIds unicos dos squads
  const squadsSnap = await db.collection('squads').get();
  const squadById = {};
  const allSystemIds = new Set();

  squadsSnap.forEach(d => {
    const sq = { id: d.id, ...d.data() };
    squadById[sq.id] = sq;
    const ids = sq.systemIds || (sq.systemId ? [sq.systemId] : []);
    ids.forEach(id => allSystemIds.add(id));
  });

  console.log('\nSquads: ' + squadsSnap.size + '  |  System IDs unicos nos squads: ' + allSystemIds.size);

  // 2) Verificar quais ja existem em 'systems'
  const systemsSnap = await db.collection('systems').get();
  const existingIds = new Set();
  systemsSnap.forEach(d => existingIds.add(d.id));
  console.log('Sistemas ja existentes: ' + existingIds.size + ' (' + [...existingIds].join(', ') + ')');

  const missingIds = [...allSystemIds].filter(id => !existingIds.has(id));
  console.log('Sistemas AUSENTES que precisam ser recuperados: ' + missingIds.length + '\n');

  // 3) Mapear systemId -> {name, grupoSuporte, squadId, projectId}
  const recovered = {};

  // Pre-fill com o que sabemos do squad (squadId e projectId)
  squadsSnap.forEach(d => {
    const sq = d.data();
    const ids = sq.systemIds || (sq.systemId ? [sq.systemId] : []);
    ids.forEach(id => {
      if (!existingIds.has(id)) {
        if (!recovered[id]) {
          recovered[id] = { squadId: d.id, projectId: sq.projectId || '' };
        } else {
          // Se o mesmo ID aparece em multiplos squads, deixa sem squadId exclusivo
          if (recovered[id].squadId && recovered[id].squadId !== d.id) {
            recovered[id].squadId = '';
          }
        }
      }
    });
  });

  // 4) Varrer tickets_global em busca de nome + grupoSuporte
  console.log('Varrendo tickets_global para recuperar nomes e grupoSuporte...');

  let scanned = 0;
  let foundNames = 0;
  const missingSet = new Set(missingIds);

  let lastDoc = null;
  const PAGE = 500;

  while (true) {
    let q = db.collection('tickets_global').limit(PAGE);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;
    lastDoc = snap.docs[snap.docs.length - 1];
    scanned += snap.size;

    snap.forEach(d => {
      const t = d.data();

      // Campo sistemaId (string) + sistemaNome ou sistema (string)
      if (t.sistemaId && missingSet.has(t.sistemaId)) {
        const rec = recovered[t.sistemaId] || {};
        if (!rec.name && (t.sistemaNome || t.sistema)) {
          rec.name = t.sistemaNome || t.sistema;
          foundNames++;
        }
        if (!rec.grupoSuporte && t.grupoSuporte) rec.grupoSuporte = t.grupoSuporte;
        recovered[t.sistemaId] = rec;
      }

      // Campo sistemasImpactados (array de IDs)
      if (Array.isArray(t.sistemasImpactados)) {
        t.sistemasImpactados.forEach(sysId => {
          if (missingSet.has(sysId)) {
            const rec = recovered[sysId] || {};
            // Tenta pegar nome de um campo paralelo como sistemasImpactadosNomes
            if (!rec.name && Array.isArray(t.sistemasImpactadosNomes)) {
              const idx = t.sistemasImpactados.indexOf(sysId);
              if (idx >= 0 && t.sistemasImpactadosNomes[idx]) {
                rec.name = t.sistemasImpactadosNomes[idx];
                foundNames++;
              }
            }
            if (!rec.grupoSuporte && t.grupoSuporte) rec.grupoSuporte = t.grupoSuporte;
            recovered[sysId] = rec;
          }
        });
      }

      // Enriquece grupoSuporte se ja temos o ID
      if (t.sistemaId && recovered[t.sistemaId] && !recovered[t.sistemaId].grupoSuporte && t.grupoSuporte) {
        recovered[t.sistemaId].grupoSuporte = t.grupoSuporte;
      }
    });

    process.stdout.write('  ... ' + scanned + ' tickets varridos, ' + foundNames + ' nomes encontrados\r');
    if (snap.size < PAGE) break;
  }
  console.log('\nTotal varrido: ' + scanned + ' tickets  |  Nomes recuperados: ' + foundNames);

  // 5) Verificar outras collections
  const extraCollections = ['tickets', 'demandas', 'operacao_tickets', 'incidentes'];
  for (const col of extraCollections) {
    try {
      const snap = await db.collection(col).limit(300).get();
      if (snap.empty) continue;
      let hits = 0;
      snap.forEach(d => {
        const t = d.data();
        if (t.sistemaId && missingSet.has(t.sistemaId)) {
          const rec = recovered[t.sistemaId] || {};
          if (!rec.name && (t.sistemaNome || t.sistema)) { rec.name = t.sistemaNome || t.sistema; hits++; }
          if (!rec.grupoSuporte && t.grupoSuporte) rec.grupoSuporte = t.grupoSuporte;
          recovered[t.sistemaId] = rec;
        }
      });
      if (hits > 0) console.log('  Collection \'' + col + '\': ' + hits + ' nomes adicionais recuperados');
    } catch (_) { /* collection nao existe */ }
  }

  // 6) Exibir resultado
  console.log('\n=== RESULTADO DA RECUPERACAO ===');
  const toRestore = [];
  const stillMissing = [];

  for (const id of missingIds) {
    const rec = recovered[id] || {};
    const sq = rec.squadId ? squadById[rec.squadId] : null;
    const squadName = (sq && sq.name) ? sq.name : (rec.squadId || '?');
    if (rec.name) {
      toRestore.push({ id, ...rec });
      console.log('  OK  [' + id + ']  "' + rec.name + '"  | squad: ' + squadName + '  | grupoSuporte: ' + (rec.grupoSuporte || '(nao encontrado)'));
    } else {
      stillMissing.push({ id, ...rec });
      console.log('  ??  [' + id + ']  NOME DESCONHECIDO  | squad: ' + squadName + '  | grupoSuporte: ' + (rec.grupoSuporte || '?'));
    }
  }

  console.log('\nProntos para restaurar: ' + toRestore.length + '  |  Sem nome (precisam de atencao): ' + stillMissing.length);

  if (!RESTORE) {
    console.log('\n[DRY-RUN] Execute com --restore para gravar os sistemas no Firestore.');
    process.exit(0);
  }

  // 7) Restaurar
  if (toRestore.length === 0) {
    console.log('\nNenhum documento com nome para restaurar.');
    process.exit(0);
  }

  console.log('\nRestaurando ' + toRestore.length + ' documentos em \'systems\'...');
  let batch = db.batch();
  let count = 0;

  for (const sys of toRestore) {
    const ref = db.collection('systems').doc(sys.id);
    batch.set(ref, {
      name: sys.name,
      projectId: sys.projectId || '',
      squadId: sys.squadId || '',
      grupoSuporte: sys.grupoSuporte || '',
      createdAt: FieldValue.serverTimestamp(),
      _recoveredAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    count++;
    if (count % 400 === 0) {
      await batch.commit();
      batch = db.batch();
      console.log('  Lote de ' + count + ' gravado...');
    }
  }
  if (count % 400 !== 0) await batch.commit();
  console.log('SUCESSO: ' + count + ' sistemas restaurados na collection \'systems\'.');

  if (stillMissing.length > 0) {
    console.log('\nATENCAO: ' + stillMissing.length + ' sistemas sem nome nao puderam ser restaurados automaticamente:');
    stillMissing.forEach(s => {
      const sq = s.squadId ? squadById[s.squadId] : null;
      console.log('  [' + s.id + ']  squad: ' + ((sq && sq.name) || s.squadId || '?'));
    });
    console.log('Esses precisam ser recadastrados manualmente em Configuracoes > Sistemas.');
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
