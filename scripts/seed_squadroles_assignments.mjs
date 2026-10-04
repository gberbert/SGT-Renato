/**
 * seed_squadroles_assignments.mjs
 *
 * A collection `squadroles` tem dois tipos de docs:
 *   - Definição: { name, description, order } — já existem (9 docs)
 *   - Atribuição: { userId, squadId, squad, role } — FALTANDO (0 docs)
 *
 * Este script lê a collection `squads` (que tem users: [{id, role}]) e cria
 * os docs de atribuição na collection `squadroles`, restaurando o funcionamento
 * do subscribeToUsers() em settingsService.js.
 *
 * Execução: node scripts/seed_squadroles_assignments.mjs
 *           node scripts/seed_squadroles_assignments.mjs --dry-run
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

function fsPost(token, path, body) {
  return httpsReq('POST', 'firestore.googleapis.com', path, body, {
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

function toFSVal(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFSVal) } };
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) fields[k] = toFSVal(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

async function main() {
  if (DRY_RUN) console.log('🔍 DRY-RUN — nenhuma gravação será feita\n');

  console.log('Obtaining token...');
  const token = await getToken();

  // 1. Load all squads
  console.log('\nCarregando squads...');
  const rawSquads = await listAll(token, 'squads');
  const squads = rawSquads.map(parseDoc);
  console.log(`  ${squads.length} squads`);

  // 2. Check existing assignment docs (to avoid duplicates)
  console.log('\nCarregando squadroles existentes...');
  const rawRoles = await listAll(token, 'squadroles');
  const existingAssignments = rawRoles.map(parseDoc).filter(d => d.userId);
  console.log(`  ${existingAssignments.length} assignment docs existentes`);

  // Build a set of existing userId+squadId pairs
  const existingKeys = new Set(existingAssignments.map(d => `${d.userId}__${d.squadId}`));

  // 3. Build assignment list from squads
  const assignments = [];
  for (const squad of squads) {
    const members = Array.isArray(squad.users) ? squad.users : [];
    for (const member of members) {
      const userId = member.id || member.userId;
      const role = member.role || '';
      if (!userId) continue;
      assignments.push({
        userId,
        squadId: squad.id,
        squad: squad.name || squad.id,
        role
      });
    }
  }

  console.log(`\n  ${assignments.length} atribuições a criar (baseadas em squads.users[])`);

  // 4. Create docs
  let created = 0;
  let skipped = 0;

  for (const a of assignments) {
    const key = `${a.userId}__${a.squadId}`;
    if (existingKeys.has(key)) {
      console.log(`  ⏭️  Já existe: userId=${a.userId} squad=${a.squad}`);
      skipped++;
      continue;
    }

    console.log(`  ${DRY_RUN ? '[DRY]' : '→'} CREATE squadroles: userId=${a.userId} squad=${a.squad}(${a.role})`);

    if (!DRY_RUN) {
      const body = {
        fields: {
          userId: toFSVal(a.userId),
          squadId: toFSVal(a.squadId),
          squad: toFSVal(a.squad),
          role: toFSVal(a.role)
        }
      };
      // POST to create with auto-generated ID
      const r = await fsPost(token, `${BASE}/squadroles`, body);
      if (r.status !== 200) {
        console.error(`    ❌ ERRO (${r.status}):`, r.body.slice(0, 200));
      } else {
        created++;
      }
    } else {
      created++;
    }
  }

  console.log('\n=============================');
  console.log('Resultado:');
  console.log(`  ✅ Criados: ${created}`);
  console.log(`  ⏭️  Já existiam: ${skipped}`);
  if (DRY_RUN) console.log('\n  (DRY-RUN: nenhuma alteração foi gravada)');
  else console.log('\n  Recarregue a aplicação para ver os menus restaurados.');
}

main().catch(e => { console.error('FATAL:', e.message, e.stack); process.exit(1); });
