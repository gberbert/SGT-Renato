/**
 * Inspeciona a collection squads para entender estrutura de membros
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

function parseValue(v) {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue);
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.nullValue !== undefined) return null;
  if (v.arrayValue) return (v.arrayValue.values || []).map(parseValue);
  if (v.mapValue) {
    const m = {};
    for (const [k2, v2] of Object.entries(v.mapValue.fields || {})) m[k2] = parseValue(v2);
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

async function main() {
  console.log('Obtaining token...');
  const token = await getToken();

  console.log('\n=== SQUADS collection ===');
  const rawSquads = await listAll(token, 'squads');
  console.log(`Total squad docs: ${rawSquads.length}`);

  if (rawSquads.length === 0) {
    console.log('No squads found. Checking available collections...');
    // Try to list root collections
    const r = await fsGet(token, `/v1/projects/sgt-renato/databases/default/documents:listCollectionIds`);
    console.log('Collections:', r.body.slice(0, 500));
    return;
  }

  const squads = rawSquads.map(parseDoc);

  // Print all fields from first squad
  console.log('\nFirst squad full structure:');
  console.log(JSON.stringify(squads[0], null, 2).slice(0, 2000));

  // Print all squad names and member info
  console.log('\n\n=== ALL SQUADS SUMMARY ===');
  squads.forEach(s => {
    const memberFields = Object.keys(s).filter(k =>
      k.toLowerCase().includes('member') ||
      k.toLowerCase().includes('user') ||
      k.toLowerCase().includes('people') ||
      k.toLowerCase().includes('membro') ||
      k.toLowerCase().includes('integrante')
    );
    console.log(`Squad: ${s.name || s.id} (${s.id})`);
    console.log(`  All fields: ${Object.keys(s).join(', ')}`);
    if (memberFields.length > 0) {
      memberFields.forEach(f => {
        const val = s[f];
        if (Array.isArray(val)) {
          console.log(`  ${f}: [${val.length} items] sample:`, JSON.stringify(val.slice(0, 2)).slice(0, 300));
        } else {
          console.log(`  ${f}:`, JSON.stringify(val).slice(0, 300));
        }
      });
    }
  });

  // Check for subcollections in first squad
  console.log('\n\n=== SUBCOLLECTIONS of first squad ===');
  const firstSquadId = squads[0].id;
  const subr = await httpsReq(
    'POST',
    'firestore.googleapis.com',
    `/v1/projects/sgt-renato/databases/default/documents/squads/${firstSquadId}:listCollectionIds`,
    {},
    { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  );
  console.log('Subcollections of squad', firstSquadId, ':', subr.body.slice(0, 500));

  // Also check members subcollection
  const memr = await fsGet(token, `${BASE}/squads/${firstSquadId}/members?pageSize=5`);
  const memData = JSON.parse(memr.body);
  if (memData.documents) {
    console.log(`\nMembers subcollection has ${memData.documents.length} docs`);
    memData.documents.slice(0, 2).forEach(doc => {
      console.log('  Member doc:', JSON.stringify(parseDoc(doc)));
    });
  } else {
    console.log('\nNo members subcollection or empty:', memr.body.slice(0, 200));
  }
}

main().catch(e => { console.error('FATAL:', e.message, e.stack); process.exit(1); });
