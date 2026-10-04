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
  const rulesetId = 'b8233fbc-1f85-4984-a82e-e8ed43047abe';
  const r = await get(`/v1/projects/sgt-renato/rulesets/${rulesetId}`);
  const data = JSON.parse(r.body);
  console.log('Status:', r.status);
  const files = data.source?.files || [];
  for (const f of files) {
    console.log(`\n=== File: ${f.name} ===`);
    // Print just the first 60 lines to confirm content
    const lines = (f.content || '').split('\n').slice(0, 60);
    console.log(lines.join('\n'));
  }
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
