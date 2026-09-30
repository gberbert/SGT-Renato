/**
 * delete_incidentes.mjs
 * Remove da coleção tickets_global todos os documentos com escopo === 'INCIDENTE'
 * ou escopo === 'DEMANDA FAST' para permitir nova carga limpa via JQL.
 * Usa REST API diretamente (mesmo padrão de fix_stats_incidente.mjs).
 *
 * Uso:
 *   node scripts/delete_incidentes.mjs                       → dry-run (lista sem deletar)
 *   node scripts/delete_incidentes.mjs --confirm             → deleta INCIDENTE + DEMANDA FAST
 *   node scripts/delete_incidentes.mjs --escopo INCIDENTE    → filtra só INCIDENTE
 *   node scripts/delete_incidentes.mjs --escopo DEMANDA_FAST → filtra só DEMANDA FAST
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createSign } from 'crypto';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Service account ──────────────────────────────────────────────────────────
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
if (!saPath) {
  console.error('❌ Service account não encontrado. Defina FIREBASE_SA_PATH em functions/.env ou coloque o JSON em Arquivos_Gerais/');
  process.exit(1);
}

const sa = JSON.parse(readFileSync(saPath, 'utf8'));
const PROJECT_ID = sa.project_id;
console.log(`🔑 Credencial: ${saPath}`);
console.log(`📦 Project   : ${PROJECT_ID}`);

// ── CLI flags ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--confirm');

const escopoFilterIdx = args.indexOf('--escopo');
const escopoFilterRaw = escopoFilterIdx >= 0 ? args[escopoFilterIdx + 1] : null;
const escopoFilterKey = escopoFilterRaw
  ? escopoFilterRaw.toUpperCase().replace(/_/g, ' ')
  : null;

// Valores exatos armazenados no Firestore para cada escopo
const ALL_TARGET_ESCOPOS = {
  'INCIDENTE':    ['INCIDENTE', 'Incidente', 'incidente'],
  'DEMANDA FAST': ['DEMANDA FAST', 'DEMANDA_FAST', 'Demanda Fast', 'demanda fast'],
};

const TARGET_ESCOPOS = escopoFilterKey
  ? Object.fromEntries(Object.entries(ALL_TARGET_ESCOPOS).filter(([k]) => k === escopoFilterKey))
  : ALL_TARGET_ESCOPOS;

if (escopoFilterKey && Object.keys(TARGET_ESCOPOS).length === 0) {
  console.error(`❌ Escopo desconhecido: "${escopoFilterKey}". Use INCIDENTE ou DEMANDA_FAST.`);
  process.exit(1);
}

// ── JWT / OAuth2 ─────────────────────────────────────────────────────────────
function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function makeJwt() {
  const now = Math.floor(Date.now() / 1000);
  const header  = base64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const payload = base64url(Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })));
  const sign = createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  return `${header}.${payload}.${base64url(sign.sign(sa.private_key))}`;
}

function httpReq(method, host, path, body, headers = {}) {
  return new Promise((res, rej) => {
    const data = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const hh = { ...headers };
    if (data) {
      if (!hh['Content-Type']) hh['Content-Type'] = 'application/json';
      hh['Content-Length'] = Buffer.byteLength(data);
    }
    const req = https.request({ hostname: host, path, method, headers: hh }, resp => {
      let raw = '';
      resp.on('data', c => { raw += c; });
      resp.on('end', () => {
        try { res({ status: resp.statusCode, body: JSON.parse(raw) }); }
        catch { res({ status: resp.statusCode, body: raw }); }
      });
    });
    req.on('error', rej);
    if (data) req.write(data);
    req.end();
  });
}

async function getToken() {
  const body = 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + makeJwt();
  const r = await httpReq('POST', 'oauth2.googleapis.com', '/token', body, {
    'Content-Type': 'application/x-www-form-urlencoded',
  });
  if (!r.body?.access_token) throw new Error('Falha ao obter token: ' + JSON.stringify(r.body));
  return r.body.access_token;
}

// ── Firestore REST ───────────────────────────────────────────────────────────
const FS_HOST  = 'firestore.googleapis.com';
const FS_BASE  = `/v1/projects/${PROJECT_ID}/databases/default/documents`;
const COLL     = 'tickets_global';
const PAGE_SIZE = 300;

/**
 * Executa um runQuery com filtro `escopo == value` e retorna os nomes dos docs.
 * Faz paginação automática via startAfter (offset via pageToken não existe no runQuery —
 * usamos `offset` numérico do StructuredQuery).
 */
async function queryDocsByEscopo(token, escopoValue) {
  const docNames = [];
  let offset = 0;

  while (true) {
    const queryBody = {
      structuredQuery: {
        from: [{ collectionId: COLL }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'escopo' },
            op: 'EQUAL',
            value: { stringValue: escopoValue },
          },
        },
        select: { fields: [
          { fieldPath: 'escopo' },
          { fieldPath: 'issueKey' },
          { fieldPath: 'issueType' },
          { fieldPath: 'summary' },
        ]},
        limit: PAGE_SIZE,
        offset,
      },
    };

    const r = await httpReq('POST', FS_HOST, `${FS_BASE}:runQuery`, queryBody, {
      Authorization: `Bearer ${token}`,
    });

    if (r.status !== 200) {
      throw new Error(`runQuery HTTP ${r.status}: ${JSON.stringify(r.body).slice(0, 300)}`);
    }

    const results = Array.isArray(r.body) ? r.body : [];
    // Filtra resultados sem documento (último item pode ser só { readTime })
    const docs = results.filter(row => row.document?.name);

    if (docs.length === 0) break;

    for (const row of docs) {
      docNames.push({
        name: row.document.name,
        issueKey: row.document.fields?.issueKey?.stringValue ?? '—',
        issueType: row.document.fields?.issueType?.stringValue ?? '—',
        summary:  (row.document.fields?.summary?.stringValue ?? '').slice(0, 60),
      });
    }

    if (docs.length < PAGE_SIZE) break;
    offset += docs.length;
    console.log(`    … paginando (offset=${offset})`);
  }

  return docNames;
}

/**
 * Deleta uma lista de nomes de documentos em lotes de 500 (limite da batchWrite).
 */
async function batchDelete(token, docNames) {
  const CHUNK = 500;
  let deleted = 0;
  for (let i = 0; i < docNames.length; i += CHUNK) {
    const chunk = docNames.slice(i, i + CHUNK);
    const writes = chunk.map(n => ({ delete: n }));
    const r = await httpReq('POST', FS_HOST,
      `/v1/projects/${PROJECT_ID}/databases/default/documents:batchWrite`,
      { writes },
      { Authorization: `Bearer ${token}` });

    if (r.status !== 200) {
      throw new Error(`batchWrite HTTP ${r.status}: ${JSON.stringify(r.body).slice(0, 300)}`);
    }
    deleted += chunk.length;
    console.log(`    ✅ Lote ${Math.ceil(i / CHUNK) + 1}: ${chunk.length} deletados (total=${deleted})`);
  }
  return deleted;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  const modeLabel = DRY_RUN ? '🔍 DRY-RUN' : '🗑️  DESTRUTIVO';
  console.log(`\n${'═'.repeat(60)}`);
  console.log(` delete_incidentes.mjs — modo: ${modeLabel}`);
  console.log(` Escopos alvo: ${Object.keys(TARGET_ESCOPOS).join(', ')}`);
  console.log(`${'═'.repeat(60)}`);
  console.log(DRY_RUN
    ? '\n⚠️  MODO DRY-RUN — nenhum documento será deletado.\n   Use --confirm para deletar de verdade.\n'
    : '\n⚠️  MODO DESTRUTIVO — deletando!\n');

  const token = await getToken();

  let grandTotal = 0;
  let grandDeleted = 0;

  for (const [label, variants] of Object.entries(TARGET_ESCOPOS)) {
    console.log(`\n📋 Escopo: "${label}"`);

    let allDocs = [];
    for (const v of variants) {
      console.log(`   Buscando escopo="${v}"…`);
      const docs = await queryDocsByEscopo(token, v);
      allDocs = allDocs.concat(docs);
      if (docs.length > 0) console.log(`   → ${docs.length} encontrados`);
    }

    // Dedup por nome (caso o mesmo doc apareça em múltiplas variantes)
    const unique = [...new Map(allDocs.map(d => [d.name, d])).values()];
    grandTotal += unique.length;
    console.log(`   Total únicos: ${unique.length}`);

    if (unique.length > 0) {
      // Mostra exemplos
      unique.slice(0, 8).forEach(d => {
        console.log(`   → ${d.issueKey.padEnd(22)} | issueType: ${d.issueType.slice(0, 35).padEnd(36)} | ${d.summary}`);
      });
      if (unique.length > 8) console.log(`   … e mais ${unique.length - 8} docs`);

      if (!DRY_RUN) {
        const deleted = await batchDelete(token, unique.map(d => d.name));
        grandDeleted += deleted;
      }
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  if (DRY_RUN) {
    console.log(`📊 Total encontrado: ${grandTotal} tickets`);
    console.log('ℹ️  Para deletar tudo:');
    console.log('   node scripts/delete_incidentes.mjs --confirm');
    console.log('ℹ️  Para deletar só um escopo:');
    console.log('   node scripts/delete_incidentes.mjs --confirm --escopo INCIDENTE');
    console.log('   node scripts/delete_incidentes.mjs --confirm --escopo DEMANDA_FAST');
  } else {
    console.log(`🗑️  Total deletado: ${grandDeleted} de ${grandTotal} tickets`);
  }
  console.log(`${'─'.repeat(60)}\n`);
}

run().catch(e => { console.error('Erro:', e.message || e); process.exit(1); });
