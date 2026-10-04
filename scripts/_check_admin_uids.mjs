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
  let all = [];
  let pageToken = null;
  do {
    const url = `${BASE}/users?pageSize=100${pageToken ? '&pageToken=' + pageToken : ''}`;
    const r = await get(url);
    const data = JSON.parse(r.body);
    all = all.concat(data.documents || []);
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  console.log(`Total users: ${all.length}\n`);
  console.log('=== ADMIN USERS (full UID + email) ===');
  for (const doc of all) {
    const id = doc.name.split('/').pop();
    const f = doc.fields || {};
    const role = f.role?.stringValue || 'user';
    const email = f.email?.stringValue || '(no email)';
    const displayName = f.displayName?.stringValue || f.name?.stringValue || '';
    if (role === 'admin') {
      console.log(`  uid=${id}`);
      console.log(`  name=${displayName}`);
      console.log(`  email=${email}`);
      console.log('');
    }
  }
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
