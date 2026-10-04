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

async function getAllUsers() {
  let all = [];
  let pageToken = null;
  do {
    const url = `${BASE}/users?pageSize=100${pageToken ? '&pageToken=' + pageToken : ''}`;
    const r = await get(url);
    const data = JSON.parse(r.body);
    all = all.concat(data.documents || []);
    pageToken = data.nextPageToken || null;
  } while (pageToken);
  return all;
}

async function main() {
  const docs = await getAllUsers();
  console.log(`=== Total users: ${docs.length} ===\n`);

  const byRole = {};
  for (const doc of docs) {
    const id = doc.name.split('/').pop();
    const fields = doc.fields || {};
    const email = fields.email?.stringValue || '(no email)';
    const role = fields.role?.stringValue || 'user';
    const displayName = fields.displayName?.stringValue || fields.name?.stringValue || '';
    if (!byRole[role]) byRole[role] = [];
    byRole[role].push({ id: id.slice(0, 12), displayName, email, role });
  }

  for (const [role, users] of Object.entries(byRole)) {
    console.log(`\n--- role: ${role} (${users.length}) ---`);
    users.forEach(u => console.log(`  [${u.id}] ${u.displayName || u.email}`));
  }
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
