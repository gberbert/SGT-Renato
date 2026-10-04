/**
 * Inspeciona a collection squadroles e users para entender a estrutura atual
 */
import { readFileSync } from 'fs';
import { request } from 'https';
import { createSign } from 'crypto';

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
  return JSON.parse(r.body).access_token;
}

function fsGet(token, path) {
  return httpsReq('GET', 'firestore.googleapis.com', path, null, { Authorization: `Bearer ${token}` });
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

function parseDoc(doc) {
  const id = doc.name.split('/').pop();
  const fields = {};
  for (const [k, v] of Object.entries(doc.fields || {})) {
    if (v.stringValue !== undefined) fields[k] = v.stringValue;
    else if (v.booleanValue !== undefined) fields[k] = v.booleanValue;
    else if (v.integerValue !== undefined) fields[k] = parseInt(v.integerValue);
    else if (v.arrayValue) fields[k] = (v.arrayValue.values || []).map(x => x.stringValue ?? x.integerValue ?? JSON.stringify(x));
    else if (v.mapValue) fields[k] = v.mapValue;
    else fields[k] = JSON.stringify(v).slice(0, 50);
  }
  return { id, ...fields };
}

async function main() {
  console.log('Obtaining token...');
  const token = await getToken();

  console.log('\n=== SQUADROLES (assignment docs) ===');
  const roles = (await listAll(token, 'squadroles')).map(parseDoc);
  // Only assignment docs (have userId)
  const assignments = roles.filter(r => r.userId);
  console.log(`Total assignment docs: ${assignments.length}`);
  if (assignments.length > 0) {
    console.log('\nSample doc fields:', Object.keys(assignments[0]).join(', '));
    console.log('First 3 samples:');
    assignments.slice(0, 3).forEach(a => console.log(' ', JSON.stringify(a)));
  }

  // Definition docs (have name field)
  const defs = roles.filter(r => r.name);
  console.log(`\nRole definition docs (${defs.length}):`, defs.map(d => `${d.id}=${d.name}`).join(', '));

  console.log('\n=== USERS (fields check) ===');
  const users = (await listAll(token, 'users')).map(parseDoc);
  console.log(`Total users: ${users.length}`);
  if (users.length > 0) {
    console.log('Fields in first user:', Object.keys(users[0]).join(', '));
    // Check how many users already have squad fields
    const withSquad = users.filter(u => u.squadId || u.primarySquadId || u.squads);
    console.log(`Users already with squad fields: ${withSquad.length}`);
    if (withSquad.length > 0) {
      console.log('Sample user with squad fields:', JSON.stringify(withSquad[0]).slice(0, 300));
    }
  }

  // Cross-reference
  console.log('\n=== CROSS-REFERENCE ===');
  const userIds = new Set(users.map(u => u.id));
  const assignedUserIds = new Set(assignments.map(a => a.userId));
  console.log(`Users with at least one squad assignment: ${[...assignedUserIds].filter(id => userIds.has(id)).length}`);
  const usersWithMultipleSquads = [...assignedUserIds].filter(id => assignments.filter(a => a.userId === id).length > 1);
  console.log(`Users with multiple squad assignments: ${usersWithMultipleSquads.length}`);
  if (usersWithMultipleSquads.length > 0) {
    const uid = usersWithMultipleSquads[0];
    console.log(`  Example (${uid}):`, assignments.filter(a => a.userId === uid).map(a => JSON.stringify(a)).join('\n    '));
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
