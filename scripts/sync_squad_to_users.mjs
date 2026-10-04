/**
 * sync_squad_to_users.mjs
 *
 * Lê todos os documentos da collection `squads`, extrai os membros (users[]),
 * e replica as informações de squad/papel para cada documento da collection `users`.
 *
 * Campos adicionados em cada user doc:
 *   - squads: array de { squadId, squadName, role } — todas as squads do usuário
 *   - primarySquadId: squadId da primeira squad encontrada
 *   - primarySquadName: nome da primeira squad
 *   - primarySquadRole: papel na primeira squad
 *
 * Execução: node scripts/sync_squad_to_users.mjs
 *           node scripts/sync_squad_to_users.mjs --dry-run  (apenas preview, sem gravar)
 */
import { readFileSync } from 'fs';
import { request } from 'https';
import { createSign } from 'crypto';

const DRY_RUN = process.argv.includes('--dry-run');

const sa = JSON.parse(readFileSync('Arquivos_Gerais/sgt-renato-firebase-adminsdk-fbsvc-2c3d1c9c2c.json', 'utf8'));
const now = Math.floor(Date.now() / 1000);
const b64url = b => Buffer.from(b).toString('base64url');

const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
const claim = b64url(JSON.stringify({
  iss: sa.client_email,
  scope: 'https://www.googleapis.com/auth/datastore',
  aud: 'https://oauth2.googleapis.com/token',
  iat: now, exp: now + 3600
}));
const unsigned = `${header}.${claim}`;
const sign = createSign('RSA-SHA256'); sign.update(unsigned);
const jwt = `${unsigned}.${b64url(sign.sign(sa.private_key))}`;

function httpsReq(method, hostname, path, body, headers) {
  return new Promise((res, rej) => {
    const h = { ...headers };
    const buf = body ? Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)) : null;
    if (buf) h['Content-Length'] = buf.length;
    const r = request({ hostname, path, method, headers: h }, resp => {
      let b = ''; resp.on('data', d => b += d); resp.on('end', () => res({ status: resp.statusCode, body: b }));
    });
    r.on('error', rej);
    if (buf) r.write(buf);
    r.end();
  });
}

async function getToken() {
  const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
  const r = await httpsReq('POST', 'oauth2.googleapis.com', '/token', body, { 'Content-Type': 'application/x-www-form-urlencoded' });
  const parsed = JSON.parse(r.body);
  if (!parsed.access_token) throw new Error('Token error: ' + r.body);
  return parsed.access_token;
}

function fsGet(token, path) {
  return httpsReq('GET', 'firestore.googleapis.com', path, null, { Authorization: `Bearer ${token}` });
}

function fsPatch(token, path, body) {
  return httpsReq('PATCH', 'firestore.googleapis.com', path, body, {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  });
}

const BASE = '/v1/projects/sgt-renato/databases/default/documents';

async function listAll(token, collection) {
  const docs = [];
  let pageToken = '';
  do {
    const url = `${BASE}/${collection}?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`;
    const r = await fsGet(token, url);
    const data = JSON.parse(r.body);
    if (data.documents) docs.push(...data.documents);
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return docs;
}

function parseValue(v) {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue);
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.nullValue !== undefined) return null;
  if (v.arrayValue) return (v.arrayValue.values || []).map(parseValue);
  if (v.mapValue) {
    const m = {};
    for (const [k, v2] of Object.entries(v.mapValue.fields || {})) m[k] = parseValue(v2);
    return m;
  }
  return JSON.stringify(v).slice(0, 80);
}

function parseDoc(doc) {
  const id = doc.name.split('/').pop();
  const fields = {};
  for (const [k, v] of Object.entries(doc.fields || {})) fields[k] = parseValue(v);
  return { id, ...fields };
}

/** Converte valor JS para formato Firestore REST */
function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) fields[k] = toFirestoreValue(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

async function main() {
  if (DRY_RUN) console.log('🔍 DRY-RUN mode — nenhuma gravação será feita\n');

  console.log('Obtaining token...');
  const token = await getToken();

  // 1. Load all squads
  console.log('\nCarregando squads...');
  const rawSquads = await listAll(token, 'squads');
  const squads = rawSquads.map(parseDoc);
  console.log(`  ${squads.length} squads encontradas`);

  // 2. Build userId → [{ squadId, squadName, role }] map
  const userSquadsMap = new Map(); // userId -> array of { squadId, squadName, role }

  for (const squad of squads) {
    const squadId = squad.id;
    const squadName = squad.name || squadId;
    const members = Array.isArray(squad.users) ? squad.users : [];

    for (const member of members) {
      const userId = member.id || member.userId;
      const role = member.role || '';
      if (!userId) continue;

      if (!userSquadsMap.has(userId)) userSquadsMap.set(userId, []);
      userSquadsMap.get(userId).push({ squadId, squadName, role });
    }
  }

  console.log(`  ${userSquadsMap.size} usuários com pelo menos uma squad`);

  // 3. Load all users to cross-reference
  console.log('\nCarregando users...');
  const rawUsers = await listAll(token, 'users');
  const users = rawUsers.map(parseDoc);
  console.log(`  ${users.length} users encontrados`);

  // 4. For each user with squad data, patch the user doc
  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  console.log('\nSincronizando squad → users...\n');

  for (const [userId, squadsData] of userSquadsMap.entries()) {
    const userExists = users.some(u => u.id === userId);

    if (!userExists) {
      console.log(`  ⚠️  userId ${userId} não encontrado em users collection — pulando`);
      notFound++;
      continue;
    }

    // Primary = first squad entry
    const primary = squadsData[0];

    const patchFields = {
      squads: squadsData,                    // array completo de todas as squads
      primarySquadId: primary.squadId,       // atalho para a primeira squad
      primarySquadName: primary.squadName,   // nome da primeira squad
      primarySquadRole: primary.role         // papel na primeira squad
    };

    // Build updateMask and fields payload
    const fieldPaths = Object.keys(patchFields);
    const updateMaskQuery = fieldPaths.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
    const docPath = `${BASE}/users/${userId}?${updateMaskQuery}`;

    const firestoreFields = {};
    for (const [k, v] of Object.entries(patchFields)) firestoreFields[k] = toFirestoreValue(v);
    const body = { fields: firestoreFields };

    const userDisplay = users.find(u => u.id === userId)?.displayName || users.find(u => u.id === userId)?.email || userId;
    const squadsSummary = squadsData.map(s => `${s.squadName}(${s.role})`).join(', ');
    console.log(`  ${DRY_RUN ? '[DRY]' : '→'} ${userDisplay}: ${squadsSummary}`);

    if (!DRY_RUN) {
      const r = await fsPatch(token, docPath, body);
      if (r.status !== 200) {
        console.error(`    ❌ ERRO (${r.status}):`, r.body.slice(0, 200));
      } else {
        updated++;
      }
    } else {
      updated++;
    }
  }

  // Users in `users` collection but not in any squad
  const assignedIds = new Set(userSquadsMap.keys());
  const unassigned = users.filter(u => !assignedIds.has(u.id));
  console.log(`\n  Usuários sem squad: ${unassigned.length}`);
  if (unassigned.length > 0) {
    unassigned.forEach(u => console.log(`    - ${u.displayName || u.email || u.id}`));
  }

  console.log('\n=============================');
  console.log(`Resultado:`);
  console.log(`  ✅ Atualizados: ${updated}`);
  console.log(`  ⚠️  userId não existe em users: ${notFound}`);
  console.log(`  ⏭️  Sem squad: ${unassigned.length}`);
  if (DRY_RUN) console.log('\n  (DRY-RUN: nenhuma alteração foi gravada)');
}

main().catch(e => { console.error('FATAL:', e.message, e.stack); process.exit(1); });
