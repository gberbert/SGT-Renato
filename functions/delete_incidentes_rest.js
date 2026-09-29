/**
 * delete_incidentes_rest.js
 * Deleta documentos com escopo === 'INCIDENTE' da coleção tickets_global
 * usando a Firestore REST API (database "default").
 *
 * Uso:
 *   node functions/delete_incidentes_rest.js            → dry-run
 *   node functions/delete_incidentes_rest.js --confirm  → deleta de verdade
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

// ── Service Account ──────────────────────────────────────────────────────────
function findServiceAccount() {
  try {
    const envFile = fs.readFileSync(path.resolve(__dirname, '.env'), 'utf8');
    const match = envFile.match(/^FIREBASE_SA_PATH=(.+)$/m);
    if (match) {
      const p = match[1].trim().replace(/^["']|["']$/g, '');
      if (fs.existsSync(p)) return p;
    }
  } catch {}
  const dir = path.resolve(__dirname, '../Arquivos_Gerais');
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f.includes('firebase-adminsdk'));
    if (files.length) return path.join(dir, files[0]);
  }
  return null;
}

const saPath = findServiceAccount();
if (!saPath) { console.error('❌ Service account não encontrado.'); process.exit(1); }

const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
console.log(`🔑 Credencial: ${saPath}`);
console.log(`📦 Project: ${sa.project_id}`);

const PROJECT_ID = sa.project_id;
const DB_NAME = 'default'; // getFirestore(app, "default") no frontend
const DRY_RUN = !process.argv.includes('--confirm');
const COLLECTION = 'tickets_global';
const PAGE_SIZE = 300;

// ── JWT / OAuth2 ─────────────────────────────────────────────────────────────
function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function makeJwt() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const payload = base64url(Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })));
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const sig = base64url(sign.sign(sa.private_key));
  return `${header}.${payload}.${sig}`;
}

function httpRequest(method, hostname, urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const reqHeaders = { ...headers };
    if (data) {
      reqHeaders['Content-Type'] = headers['Content-Type'] || 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(data);
    }
    const req = https.request({ hostname, path: urlPath, method, headers: reqHeaders }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function getAccessToken() {
  const jwt = makeJwt();
  const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
  const res = await httpRequest('POST', 'oauth2.googleapis.com', '/token', body, {
    'Content-Type': 'application/x-www-form-urlencoded',
  });
  if (!res.body || !res.body.access_token)
    throw new Error('Falha ao obter token: ' + JSON.stringify(res.body));
  return res.body.access_token;
}

// ── Firestore REST ────────────────────────────────────────────────────────────
const FS_HOST = 'firestore.googleapis.com';

async function queryDocs(token, offset) {
  const url = `/v1/projects/${PROJECT_ID}/databases/${DB_NAME}/documents:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: COLLECTION }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'escopo' },
          op: 'IN',
          value: {
            arrayValue: {
              values: [
                { stringValue: 'INCIDENTE' },
                { stringValue: 'Incidente' },
                { stringValue: 'incidente' },
              ],
            },
          },
        },
      },
      limit: PAGE_SIZE,
      offset,
    },
  };
  return httpRequest('POST', FS_HOST, url, body, { Authorization: `Bearer ${token}` });
}

async function deleteDoc(token, docName) {
  // docName = "projects/.../databases/.../documents/tickets_global/ID"
  const url = `/v1/${docName}`;
  return httpRequest('DELETE', FS_HOST, url, null, { Authorization: `Bearer ${token}` });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  console.log(`\n🔍 Buscando escopo INCIDENTE em "${COLLECTION}" (db: ${DB_NAME})…`);
  console.log(DRY_RUN ? '⚠️  DRY-RUN — use --confirm para deletar\n' : '🚨 MODO DESTRUTIVO — deletando!\n');

  const token = await getAccessToken();
  console.log('✅ Token OAuth2 obtido\n');

  let total = 0;
  let deleted = 0;
  let offset = 0;

  while (true) {
    const res = await queryDocs(token, DRY_RUN ? offset : 0);

    if (res.status !== 200) {
      console.error(`❌ Erro HTTP ${res.status}:`, JSON.stringify(res.body, null, 2));
      process.exit(1);
    }

    const docs = (Array.isArray(res.body) ? res.body : []).filter(r => r.document);

    if (docs.length === 0) break;

    total += docs.length;
    console.log(`  Lote (offset ${DRY_RUN ? offset : 0}): ${docs.length} docs | acumulado: ${total}`);

    if (!DRY_RUN) {
      for (const { document } of docs) {
        const delRes = await deleteDoc(token, document.name);
        if (delRes.status === 200 || delRes.status === 204) {
          deleted++;
        } else {
          console.warn(`  ⚠️  Falha ao deletar ${document.name}: HTTP ${delRes.status}`);
        }
      }
      console.log(`  ✅ ${docs.length} deletados`);
    } else {
      docs.slice(0, 5).forEach(({ document }) => {
        const f = document.fields || {};
        const id = document.name.split('/').pop();
        console.log(`  → ${id} | ${f.issueKey?.stringValue ?? '—'} | escopo: ${f.escopo?.stringValue ?? '—'} | ${(f.summary?.stringValue ?? '').slice(0, 60)}`);
      });
      if (docs.length > 5) console.log(`  … e mais ${docs.length - 5} docs`);
      offset += docs.length;
    }

    if (docs.length < PAGE_SIZE) break;
  }

  console.log('\n─────────────────────────────────────────────────────────');
  if (DRY_RUN) {
    console.log(`📊 Total encontrado: ${total} tickets com escopo INCIDENTE`);
    console.log('ℹ️  Para deletar execute:');
    console.log('   node functions/delete_incidentes_rest.js --confirm');
  } else {
    console.log(`🗑️  Total deletado: ${deleted} tickets com escopo INCIDENTE`);
  }
  console.log('─────────────────────────────────────────────────────────\n');
}

run().catch(e => { console.error('Erro fatal:', e.message || e); process.exit(1); });
