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

const BASE = '/v1/projects/sgt-renato/databases/default/documents/permissionProfiles';

async function main() {
  // List all docs
  const list = await get(`${BASE}?pageSize=20`);
  const listData = JSON.parse(list.body);
  const ids = (listData.documents || []).map(d => d.name.split('/').pop());
  console.log('=== permissionProfiles docs:', ids.join(', '));

  for (const id of ids) {
    const r = await get(`${BASE}/${id}`);
    if (r.status !== 200) { console.log(`${id}: HTTP ${r.status}`); continue; }
    const data = JSON.parse(r.body);
    const fields = data.fields || {};
    const af = fields.allowedFunctions;
    if (af && af.arrayValue) {
      const vals = (af.arrayValue.values || []).map(v => v.stringValue);
      console.log(`\n[${id}] allowedFunctions (${vals.length}):`);
      vals.forEach(v => console.log(`  - ${v}`));
    } else {
      const fieldNames = Object.keys(fields);
      console.log(`\n[${id}] NO allowedFunctions! Fields present: ${fieldNames.join(', ')}`);
      // Print all field values
      for (const [k, v] of Object.entries(fields)) {
        const val = v.stringValue ?? v.booleanValue ?? v.integerValue ?? JSON.stringify(v).slice(0, 80);
        console.log(`  ${k}: ${val}`);
      }
    }
  }
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
