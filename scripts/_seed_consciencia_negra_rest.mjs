/**
 * Seed Consciência Negra (20/11) no Firestore via REST API.
 * Usa o access_token do firebase-tools (mesmo padrão de _seed_via_rest.mjs).
 */
import { readFileSync } from 'fs';
import { request } from 'https';

const cfg = JSON.parse(readFileSync('/Users/rhonorin/.config/configstore/firebase-tools.json', 'utf8'));
const accessToken = cfg?.tokens?.access_token;
if (!accessToken) { console.error('No access_token in firebase-tools.json'); process.exit(1); }

const PROJECT = 'sgt-renato';
const DATABASE = 'default';
const BASE = 'firestore.googleapis.com';
const BASE_PATH = `/v1/projects/${PROJECT}/databases/${DATABASE}/documents`;

async function patchDoc(collection, docId, fields) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ fields });
    const path = `${BASE_PATH}/${collection}/${docId}`;
    const req = request({
      hostname: BASE, path, method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      }
    }, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const FERIADOS = [
  '2024-11-20', '2025-11-20', '2026-11-20', '2027-11-20',
];

for (const data of FERIADOS) {
  const docId = `consciencia-negra-${data}`;
  const fields = {
    data:  { stringValue: data },
    nome:  { stringValue: 'Consciência Negra' },
    tipo:  { stringValue: 'nacional' },
    pais:  { stringValue: 'BR' },
  };
  const res = await patchDoc('holydays', docId, fields);
  if (res.status === 200 || res.status === 201) {
    console.log(`✓ ${data} → holydays/${docId}`);
  } else {
    console.error(`✗ ${data} HTTP ${res.status}: ${res.body}`);
  }
}

console.log('Done.');
