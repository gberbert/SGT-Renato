import { readFileSync } from 'fs';
import { request } from 'https';

const cfg = JSON.parse(readFileSync('/Users/rhonorin/.config/configstore/firebase-tools.json', 'utf8'));
const token = cfg?.tokens?.access_token;
if (!token) { console.error('No access_token'); process.exit(1); }

function get(path, hostname = 'firebaserules.googleapis.com') {
  return new Promise((resolve, reject) => {
    const req = request(
      { hostname, path, method: 'GET', headers: { Authorization: `Bearer ${token}` } },
      res => { let buf = ''; res.on('data', d => buf += d); res.on('end', () => resolve({ status: res.statusCode, body: buf })); }
    );
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // List releases for the firestore/default database
  const r = await get('/v1/projects/sgt-renato/releases?pageSize=20');
  const data = JSON.parse(r.body);
  console.log('Status:', r.status);
  
  const releases = data.releases || [];
  console.log(`\nTotal releases: ${releases.length}`);
  
  for (const rel of releases) {
    console.log(`\n  name: ${rel.name}`);
    console.log(`  rulesetName: ${rel.rulesetName}`);
    console.log(`  updateTime: ${rel.updateTime}`);
  }
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
