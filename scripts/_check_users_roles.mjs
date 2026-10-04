import { readFileSync } from 'fs';
import { request } from 'https';

const cfg = JSON.parse(readFileSync('/Users/rhonorin/.config/configstore/firebase-tools.json', 'utf8'));
const token = cfg?.tokens?.access_token;
if (!token) { console.error('No access_token'); process.exit(1); }

function get(path) {
  return new Promise((resolve, reject) => {
    const req = request(
      { hostname: 'firestore.googleapis.com', path, method: 'GET', headers: { Authorization: `Bearer ${token}` } },
      res => { let buf = ''; res.on('data', d => buf += d); res.on('end', () => resolve({ status: res.statusCode, body: buf })); }
    );
    req.on('error', reject);
    req.end();
  });
}

const BASE = '/v1/projects/sgt-renato/databases/default/documents';

async function main() {
  const r = await get(`${BASE}/users?pageSize=30`);
  const data = JSON.parse(r.body);
  const docs = data.documents || [];
  console.log(`=== users (${docs.length} found) ===`);

  for (const doc of docs) {
    const id = doc.name.split('/').pop();
    const fields = doc.fields || {};
    const email = fields.email?.stringValue || fields.name?.stringValue || '(no email)';
    const role = fields.role?.stringValue || '(NO ROLE → defaults to user)';
    const displayName = fields.displayName?.stringValue || fields.name?.stringValue || '';
    console.log(`  [${id.slice(0,8)}] ${displayName || email} → role: ${role}`);
  }
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
