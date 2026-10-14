/**
 * seed_systems_from_grupos.cjs
 *
 * Reconstrói a collection 'systems' a partir de 'grupo_atendimento'.
 * Cada grupo solucionador vira um documento em 'systems' (usando o mesmo ID do grupo).
 * Em seguida, atualiza squad.systemIds com os novos IDs.
 *
 * Modo dry-run por padrao. Use --apply para gravar.
 */
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const sa = require('./Arquivos_Gerais/sgt-renato-firebase-adminsdk-fbsvc-2c3d1c9c2c.json');
initializeApp({ credential: cert(sa) });
const db = getFirestore(undefined, 'default');

const APPLY = process.argv.includes('--apply');

// Padroes de grupo por squad (substrings no ID ou nome do grupo, lower/normalized)
const SQUAD_PATTERNS = {
  'AGV':        ['agencia', 'agencia_virtual', 'lumens', 'clientes_vip', 'totem', 'rdct'],
  'GMP':        ['_gmp', 'ti-gmp', 'ti-web-gmp'],
  'PP':         ['projetos_particulares', 'spap', 'dcaf', 'pid', 'epm', 'mastersaf', 'gisd', 'cdre'],
  'CORP':       ['cws', 'sga', 'siga', 'logos', 'sanf', 'sefic', 'rhap', 'ged', 'gdo', 'solucionador', 'infra', 'rpa', 'weblogradouros', 'sharepoint', 'atendimento', 'bi_st', 'energia', 'cpflempresas', 'siase', 'siclope', 'inspecoes', 'cadeia_reversa', 'portaloperacoes', 'corporativo', 'comercial'],
  'SALESFORCE': ['salesforce'],
  'PROJETOS':   ['projetos_particulares'],
};

function normalize(str) {
  return (str || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '_');
}

function matchesSquad(grupoId, grupoNome, patterns) {
  const nId = normalize(grupoId);
  const nNome = normalize(grupoNome);
  return patterns.some(p => nId.includes(p) || nNome.includes(p));
}

async function main() {
  // 1) Carregar grupo_atendimento
  const gaSnap = await db.collection('grupo_atendimento').get();
  const grupos = [];
  gaSnap.forEach(d => {
    grupos.push({ id: d.id, ...d.data() });
  });
  console.log('Grupos em grupo_atendimento: ' + grupos.length);

  // 2) Carregar squads
  const squadsSnap = await db.collection('squads').get();
  const squads = [];
  squadsSnap.forEach(d => { squads.push({ id: d.id, ...d.data() }); });
  console.log('Squads: ' + squads.length);

  // 3) Carregar projectId do único projeto existente
  const projSnap = await db.collection('projects').limit(1).get();
  const defaultProjectId = projSnap.empty ? '' : projSnap.docs[0].id;
  console.log('ProjectId padrão: ' + defaultProjectId);

  // 4) Para cada grupo, determinar o squadId correspondente
  console.log('\n=== MAPEAMENTO GRUPO -> SQUAD ===');
  const systemDocs = [];
  const unmapped = [];

  for (const g of grupos) {
    let assignedSquadId = '';
    let assignedSquadName = '';

    for (const [squadName, patterns] of Object.entries(SQUAD_PATTERNS)) {
      if (matchesSquad(g.id, g.nome || '', patterns)) {
        const sq = squads.find(s => s.name === squadName);
        if (sq) {
          assignedSquadId = sq.id;
          assignedSquadName = sq.name;
          break;
        }
      }
    }

    const doc = {
      id: g.id,
      name: g.nome || g.id,
      grupoSuporte: g.nome || g.id,
      squadId: assignedSquadId,
      projectId: defaultProjectId,
    };

    systemDocs.push(doc);
    if (assignedSquadId) {
      console.log('  OK  [' + g.id + ']  "' + doc.name + '"  -> squad: ' + assignedSquadName);
    } else {
      unmapped.push(doc);
      console.log('  --  [' + g.id + ']  "' + doc.name + '"  -> squad: (nao mapeado)');
    }
  }

  console.log('\nMapeados: ' + (systemDocs.length - unmapped.length) + '  |  Nao mapeados: ' + unmapped.length);

  // 5) Calcular novos systemIds para cada squad
  console.log('\n=== NOVOS systemIds POR SQUAD ===');
  const squadNewSystemIds = {};

  for (const sq of squads) {
    const matchingSystems = systemDocs.filter(s => s.squadId === sq.id);
    squadNewSystemIds[sq.id] = matchingSystems.map(s => s.id);
    console.log('  Squad ' + sq.name + ': ' + matchingSystems.length + ' sistemas');
    matchingSystems.forEach(s => console.log('    - ' + s.id + ' "' + s.name + '"'));
  }

  if (!APPLY) {
    console.log('\n[DRY-RUN] Execute com --apply para gravar no Firestore.');
    process.exit(0);
  }

  // 6) Gravar sistemas na collection 'systems'
  console.log('\nGravando ' + systemDocs.length + ' documentos em systems...');
  let batch = db.batch();
  let count = 0;

  for (const sys of systemDocs) {
    const ref = db.collection('systems').doc(sys.id);
    batch.set(ref, {
      name: sys.name,
      grupoSuporte: sys.grupoSuporte,
      squadId: sys.squadId,
      projectId: sys.projectId,
      createdAt: FieldValue.serverTimestamp(),
      _source: 'seed_from_grupo_atendimento',
    }, { merge: true });
    count++;
    if (count % 400 === 0) {
      await batch.commit();
      batch = db.batch();
      console.log('  Lote ' + count + ' gravado...');
    }
  }
  if (count % 400 !== 0) await batch.commit();
  console.log('OK: ' + count + ' sistemas gravados.');

  // 7) Atualizar systemIds em cada squad
  console.log('\nAtualizando systemIds nos squads...');
  const batchSq = db.batch();
  let sqCount = 0;

  for (const sq of squads) {
    const newIds = squadNewSystemIds[sq.id] || [];
    if (newIds.length > 0) {
      const ref = db.collection('squads').doc(sq.id);
      batchSq.update(ref, { systemIds: newIds });
      sqCount++;
      console.log('  Squad ' + sq.name + ': ' + newIds.length + ' sistemas');
    }
  }

  await batchSq.commit();
  console.log('OK: ' + sqCount + ' squads atualizados.');
  console.log('\nConcluido! Verifique em Configuracoes > Sistemas.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
