/**
 * Deploy firestore.rules to the Enterprise "default" named database.
 *
 * The Firebase CLI historically deploys to release "cloud.firestore/default"
 * (the (default) Standard Edition database). The Enterprise named database
 * "default" requires release "cloud.firestore/databases/default".
 *
 * This script:
 *   1. Creates a new ruleset from firestore.rules
 *   2. Assigns it to the release "cloud.firestore/databases/default"
 */

import { readFileSync } from 'fs';
import { request } from 'https';

const PROJECT = 'sgt-renato';
const RULES_FILE = 'firestore.rules';
// Release name for the Enterprise named database "default"
// NOTE: slashes must NOT be percent-encoded in the HTTP path for the Firebase Rules API
const DB_RELEASE_ID = 'cloud.firestore/databases/default';
const RELEASE_NAME = `projects/${PROJECT}/releases/${DB_RELEASE_ID}`;

// ── Load access token ────────────────────────────────────────────────────────
const cfg = JSON.parse(
  readFileSync('/Users/rhonorin/.config/configstore/firebase-tools.json', 'utf8')
);
const token = cfg?.tokens?.access_token;
if (!token) { console.error('No access_token in firebase-tools.json'); process.exit(1); }

// ── HTTP helpers ─────────────────────────────────────────────────────────────
function apiRequest(method, path, body, hostname = 'firebaserules.googleapis.com') {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = request(
      { hostname, path, method, headers },
      res => {
        let buf = '';
        res.on('data', d => (buf += d));
        res.on('end', () => resolve({ status: res.statusCode, body: buf }));
      }
    );
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const rulesContent = readFileSync(RULES_FILE, 'utf8');
  console.log(`Loaded ${RULES_FILE} (${rulesContent.length} chars)`);

  // 1. Create new ruleset
  console.log('\n[1] Creating new ruleset...');
  const createRes = await apiRequest('POST', `/v1/projects/${PROJECT}/rulesets`, {
    source: {
      files: [{ name: 'firestore.rules', content: rulesContent }],
    },
  });

  if (createRes.status !== 200) {
    console.error('Failed to create ruleset:', createRes.status, createRes.body);
    process.exit(1);
  }

  const ruleset = JSON.parse(createRes.body);
  const rulesetName = ruleset.name; // e.g. projects/sgt-renato/rulesets/<uuid>
  console.log('Created ruleset:', rulesetName);

  // 2. Assign ruleset to Enterprise "default" DB release
  console.log('\n[2] Assigning ruleset to Enterprise "default" database release...');
  // First check if the release already exists
  console.log('  Checking if release exists...');
  const getRes = await apiRequest('GET', `/v1/${RELEASE_NAME}`);
  console.log('  GET status:', getRes.status);

  if (getRes.status === 200) {
    // Release exists → PATCH it
    console.log('  Release exists, updating via PATCH...');
    const patchRes = await apiRequest(
      'PATCH',
      `/v1/${RELEASE_NAME}?updateMask=rulesetName`,
      { name: RELEASE_NAME, rulesetName }
    );
    if (patchRes.status === 200) {
      const rel = JSON.parse(patchRes.body);
      console.log('✅ Release updated successfully!');
      console.log('  release name :', rel.name);
      console.log('  ruleset      :', rel.rulesetName);
      console.log('  updateTime   :', rel.updateTime);
      return;
    }
    console.error('PATCH failed:', patchRes.status, patchRes.body);
    process.exit(1);
  }

  // Release does not exist → POST to create it
  console.log('  Release not found (status ' + getRes.status + '), creating via POST...');
  const createRelRes = await apiRequest(
    'POST',
    `/v1/projects/${PROJECT}/releases`,
    { name: RELEASE_NAME, rulesetName }
  );

  if (createRelRes.status === 200) {
    const rel = JSON.parse(createRelRes.body);
    console.log('✅ Release created successfully!');
    console.log('  release name :', rel.name);
    console.log('  ruleset      :', rel.rulesetName);
    console.log('  updateTime   :', rel.updateTime);
    return;
  }

  console.error('POST create release failed:', createRelRes.status, createRelRes.body);
  process.exit(1);
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
