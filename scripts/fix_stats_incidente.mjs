/**
 * fix_stats_incidente.mjs
 * Lê operacao_stats/summary, zera tudo relacionado a INCIDENTE e DEMANDAS FAST
 * e recalcula os totais (totalTickets, totalTicketsExact).
 *
 * Uso:
 *   node scripts/fix_stats_incidente.mjs            → mostra diff (dry-run)
 *   node scripts/fix_stats_incidente.mjs --confirm  → aplica no Firestore
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createSign } from 'crypto';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvVar(key) {
  try {
    const envFile = readFileSync(resolve(__dirname, '../functions/.env'), 'utf8');
    const match = envFile.match(new RegExp(`^${key}=(.+)$`, 'm'));
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : null;
  } catch { return null; }
}

function findServiceAccount() {
  const envPath = process.env.FIREBASE_SA_PATH || loadEnvVar('FIREBASE_SA_PATH');
  if (envPath && existsSync(envPath)) return envPath;
  const dir = resolve(__dirname, '../Arquivos_Gerais');
  if (existsSync(dir)) {
    const files = readdirSync(dir).filter(f => f.endsWith('.json') && f.includes('firebase-adminsdk'));
    if (files.length) return join(dir, files[0]);
  }
  return null;
}

const saPath = findServiceAccount();
if (!saPath) { console.error('Service account nao encontrado.'); process.exit(1); }

const sa = JSON.parse(readFileSync(saPath, 'utf8'));
console.log('Credencial:', saPath);
console.log('Project:', sa.project_id);

const PROJECT_ID = sa.project_id;
const DB_NAME = 'default';
const DRY_RUN = !process.argv.includes('--confirm');

// Escopos a serem zerados (normalizeKey faz toUpperCase + underscore→espaço)
const ESCOPOS_REMOVER = ['INCIDENTE', 'DEMANDA FAST'];

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
  const sign = createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const sig = base64url(sign.sign(sa.private_key));
  return `${header}.${payload}.${sig}`;
}

function httpRequest(method, hostname, urlPath, body, headers) {
  headers = headers || {};
  return new Promise((resolve, reject) => {
    const data = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const reqHeaders = Object.assign({}, headers);
    if (data) {
      if (!reqHeaders['Content-Type']) reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(data);
    }
    const req = https.request({ hostname, path: urlPath, method, headers: reqHeaders }, res => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch (e) { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function getAccessToken() {
  const jwt = makeJwt();
  const body = 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt;
  const res = await httpRequest('POST', 'oauth2.googleapis.com', '/token', body, {
    'Content-Type': 'application/x-www-form-urlencoded',
  });
  if (!res.body || !res.body.access_token) {
    throw new Error('Falha ao obter token: ' + JSON.stringify(res.body));
  }
  return res.body.access_token;
}

const FS_HOST = 'firestore.googleapis.com';
const DOC_PATH = 'projects/' + PROJECT_ID + '/databases/' + DB_NAME + '/documents/operacao_stats/summary';

function fsVal(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fsVal) } };
  if (typeof v === 'object') {
    const fields = {};
    for (const k of Object.keys(v)) fields[k] = fsVal(v[k]);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function fromFsVal(v) {
  if (!v) return null;
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFsVal);
  if ('mapValue' in v) {
    const obj = {};
    const fields = v.mapValue.fields || {};
    for (const k of Object.keys(fields)) obj[k] = fromFsVal(fields[k]);
    return obj;
  }
  return null;
}

function fromFsDoc(doc) {
  const obj = {};
  const fields = doc.fields || {};
  for (const k of Object.keys(fields)) obj[k] = fromFsVal(fields[k]);
  return obj;
}

async function getDoc(token) {
  const res = await httpRequest('GET', FS_HOST, '/v1/' + DOC_PATH, null, {
    Authorization: 'Bearer ' + token,
  });
  if (res.status !== 200) {
    throw new Error('GET falhou HTTP ' + res.status + ': ' + JSON.stringify(res.body));
  }
  return res.body;
}

async function patchDoc(token, fields, updateMaskFields) {
  const mask = updateMaskFields.map(f => 'updateMask.fieldPaths=' + encodeURIComponent(f)).join('&');
  const url = '/v1/' + DOC_PATH + '?' + mask;
  const res = await httpRequest('PATCH', FS_HOST, url, { fields }, {
    Authorization: 'Bearer ' + token,
  });
  if (res.status !== 200) {
    throw new Error('PATCH falhou HTTP ' + res.status + ': ' + JSON.stringify(res.body));
  }
  return res.body;
}

function normalizeKey(raw) {
  return String(raw || '').trim().toUpperCase().replace(/_/g, ' ').replace(/\s+/g, ' ');
}

function deveRemover(key) {
  return ESCOPOS_REMOVER.includes(normalizeKey(key));
}

async function run() {
  console.log('\nLendo operacao_stats/summary...');
  console.log(DRY_RUN ? 'DRY-RUN -- use --confirm para aplicar\n' : 'APLICANDO PATCH no Firestore\n');

  const token = await getAccessToken();
  console.log('Token OAuth2 obtido\n');

  const rawDoc = await getDoc(token);
  const data = fromFsDoc(rawDoc);

  console.log('Valores atuais:');
  console.log('  totalTickets:', data.totalTickets);
  console.log('  totalTicketsExact:', data.totalTicketsExact);

  let removedTotal = 0;
  const changedFields = {};

  // radarByEscopo (array)
  if (Array.isArray(data.radarByEscopo)) {
    const newArray = data.radarByEscopo.map(item => {
      const key = normalizeKey(item.key || item.label || '');
      if (deveRemover(key)) {
        const t = Number(item.total) || 0;
        removedTotal += t;
        console.log('  radarByEscopo ' + key + ': ' + t + ' -> 0');
        return Object.assign({}, item, { total: 0, issueTypes: [] });
      }
      return item;
    });
    changedFields['radarByEscopo'] = fsVal(newArray);
  }

  // byEscopo (map)
  if (data.byEscopo && typeof data.byEscopo === 'object' && !Array.isArray(data.byEscopo)) {
    const newByEscopo = Object.assign({}, data.byEscopo);
    for (const k of Object.keys(newByEscopo)) {
      if (deveRemover(k)) {
        const t = Number(newByEscopo[k]) || 0;
        // só soma se radarByEscopo não encontrou (evita dupla contagem)
        if (!Array.isArray(data.radarByEscopo)) removedTotal += t;
        console.log('  byEscopo.' + k + ': ' + t + ' -> 0');
        newByEscopo[k] = 0;
      }
    }
    changedFields['byEscopo'] = fsVal(newByEscopo);
  }

  // byIssueTypeByEscopo (map)
  if (data.byIssueTypeByEscopo && typeof data.byIssueTypeByEscopo === 'object') {
    const newMap = Object.assign({}, data.byIssueTypeByEscopo);
    for (const k of Object.keys(newMap)) {
      if (deveRemover(k)) {
        console.log('  byIssueTypeByEscopo.' + k + ' -> {}');
        newMap[k] = {};
      }
    }
    changedFields['byIssueTypeByEscopo'] = fsVal(newMap);
  }

  // campos top-level com ponto (ex: "byEscopo.INCIDENTE", "byEscopo.DEMANDA_FAST")
  // estes são campos separados no documento Firestore, não sub-campos do map byEscopo
  for (const k of Object.keys(data)) {
    if (k.includes('.')) {
      const parts = k.split('.');
      const escopoKey = parts[parts.length - 1];
      if (deveRemover(escopoKey)) {
        console.log('  top-level field "' + k + '": ' + data[k] + ' -> 0');
        changedFields[k] = fsVal(0);
      }
    }
  }

  // totalTickets / totalTicketsExact
  const oldTotal = Number(data.totalTickets) || 0;
  const oldExact = Number(data.totalTicketsExact) || 0;
  const newTotal = Math.max(0, oldTotal - removedTotal);
  const newExact = Math.max(0, oldExact - removedTotal);

  console.log('\n  Total removido (todos escopos): ' + removedTotal);
  console.log('  totalTickets: ' + oldTotal + ' -> ' + newTotal);
  console.log('  totalTicketsExact: ' + oldExact + ' -> ' + newExact);

  changedFields['totalTickets'] = fsVal(newTotal);
  changedFields['totalTicketsExact'] = fsVal(newExact);
  changedFields['updatedAt'] = fsVal(new Date().toISOString());

  if (DRY_RUN) {
    console.log('\nDRY-RUN concluido. Para aplicar execute:');
    console.log('  node scripts/fix_stats_incidente.mjs --confirm');
    return;
  }

  const maskFields = Object.keys(changedFields);
  await patchDoc(token, changedFields, maskFields);
  console.log('\nPATCH aplicado com sucesso! Campos atualizados: ' + maskFields.join(', '));
}

run().catch(e => { console.error('Erro fatal:', e.message || e); process.exit(1); });
