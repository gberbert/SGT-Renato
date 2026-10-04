/**
 * Seeds permissionProfiles via Firestore REST API using the Firebase CLI OAuth token.
 * No gcloud / service account needed.
 */
import { readFileSync } from 'fs';
import { request } from 'https';

// ── Auth ─────────────────────────────────────────────────────────────────────
const cfg = JSON.parse(readFileSync('/Users/rhonorin/.config/configstore/firebase-tools.json', 'utf8'));
const refreshToken = cfg?.tokens?.refresh_token;
if (!refreshToken) { console.error('No refresh_token found in firebase-tools.json'); process.exit(1); }

async function post(hostname, path, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const body = typeof data === 'string' ? data : JSON.stringify(data);
    const req = request({ hostname, path, method: 'POST', headers: { 'Content-Length': Buffer.byteLength(body), ...headers } }, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function get(hostname, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname, path, method: 'GET', headers }, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function getToken() {
  // Use the stored access_token directly; if expired (401) we'll get a clear error.
  const accessToken = cfg?.tokens?.access_token;
  if (!accessToken) throw new Error('No access_token in firebase-tools.json');
  return accessToken;
}

// ── Firestore REST helpers ───────────────────────────────────────────────────
const PROJECT = 'sgt-renato';
const DATABASE = 'default';
const BASE = `firestore.googleapis.com`;
const BASE_PATH = `/v1/projects/${PROJECT}/databases/${DATABASE}/documents`;

function toFirestoreDoc(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      fields[k] = { arrayValue: { values: v.map(s => ({ stringValue: s })) } };
    } else if (typeof v === 'string') {
      fields[k] = { stringValue: v };
    }
  }
  return { fields };
}

async function patchDoc(token, collection, docId, data) {
  const doc = toFirestoreDoc(data);
  const fieldMask = Object.keys(data).join(',');
  const path = `${BASE_PATH}/${collection}/${docId}?updateMask.fieldPaths=${encodeURIComponent(fieldMask)}`;
  return post(BASE, path, doc, {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  });
}

async function listDocs(token, collection) {
  const res = await get(BASE, `${BASE_PATH}/${collection}?pageSize=20`, {
    Authorization: `Bearer ${token}`,
  });
  const parsed = JSON.parse(res.body);
  return (parsed.documents || []).map(d => d.name.split('/').pop());
}

// ── Permission keys ───────────────────────────────────────────────────────────
const ALL_KEYS = [
  'RADAR_VIEW','RADAR_REFRESH','RADAR_GERAL_VIEW','RADAR_PROBLEMAS_VIEW',
  'RADAR_DEMANDAS_TAB_VIEW','RADAR_DEMANDA_FAST_TAB_VIEW','RADAR_INCIDENTES_VIEW',
  'RADAR_SOLICITACOES_VIEW','RADAR_CATALOGO_VIEW','RADAR_PRECIFICACAO_DEMANDAS_VIEW',
  'RADAR_EFICIENCIA_VIEW','RADAR_OBSERVABILIDADE_VIEW','ROADMAP_GERAL_VIEW',
  'DEMANDAS_VIEW','MINHAS_ATIVIDADES_VIEW','TEAM_VIEW','TEAM_EDIT',
  'USER_CSR_VIEW','USER_RATECARD_VIEW','SETTINGS_VIEW','PLANEJAMENTO_VIEW',
  'CONFIGURACOES_VIEW','ADMIN_ALL',
];

const profiles = [
  { id: 'admin',    label: 'Administrador', description: 'Acesso completo.',           allowedFunctions: ALL_KEYS },
  { id: 'gerente',  label: 'Gerente',        description: 'Acesso gerencial.',          allowedFunctions: ALL_KEYS.filter(k => k !== 'ADMIN_ALL') },
  { id: 'analista', label: 'Analista',        description: 'Acesso operacional padrão.',allowedFunctions: ['RADAR_VIEW','RADAR_GERAL_VIEW','RADAR_PROBLEMAS_VIEW','RADAR_DEMANDAS_TAB_VIEW','RADAR_DEMANDA_FAST_TAB_VIEW','RADAR_INCIDENTES_VIEW','RADAR_SOLICITACOES_VIEW','RADAR_CATALOGO_VIEW','RADAR_EFICIENCIA_VIEW','DEMANDAS_VIEW','MINHAS_ATIVIDADES_VIEW','TEAM_VIEW','PLANEJAMENTO_VIEW'] },
  { id: 'viewer',   label: 'Visualizador',   description: 'Somente leitura.',           allowedFunctions: ['RADAR_VIEW','RADAR_GERAL_VIEW','RADAR_DEMANDAS_TAB_VIEW','DEMANDAS_VIEW','MINHAS_ATIVIDADES_VIEW','TEAM_VIEW'] },
];

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('[seed_via_rest] Obtaining OAuth token...');
  const token = await getToken();
  console.log('[seed_via_rest] Token obtained.');

  console.log('[seed_via_rest] Checking existing permissionProfiles...');
  const existing = await listDocs(token, 'permissionProfiles');
  console.log('[seed_via_rest] Existing docs:', existing.length ? existing.join(', ') : '(none)');

  for (const { id, ...data } of profiles) {
    const res = await patchDoc(token, 'permissionProfiles', id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
    if (res.status >= 200 && res.status < 300) {
      console.log(`[seed_via_rest] ✔ Upserted: ${id} (${data.allowedFunctions.length} keys)`);
    } else {
      console.error(`[seed_via_rest] ✗ Failed ${id}: HTTP ${res.status}`, res.body.slice(0, 200));
    }
  }

  console.log('[seed_via_rest] Verifying final state...');
  const final = await listDocs(token, 'permissionProfiles');
  console.log('[seed_via_rest] Final permissionProfiles:', final.join(', '));
  console.log('[seed_via_rest] Done.');
}

main().catch(err => { console.error('[seed_via_rest] FATAL:', err.message); process.exit(1); });
