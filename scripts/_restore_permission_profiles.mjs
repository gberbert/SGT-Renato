/**
 * Restores permissionProfiles collection via Firestore REST API using service account JWT.
 * Self-contained - uses only Node.js built-in modules.
 */
import { readFileSync } from 'fs';
import { request } from 'https';
import { createSign } from 'crypto';

const SA_PATH = 'Arquivos_Gerais/sgt-renato-firebase-adminsdk-fbsvc-2c3d1c9c2c.json';
const PROJECT = 'sgt-renato';
const DATABASE = 'default';

const ALL_KEYS = [
  'RADAR_VIEW', 'RADAR_REFRESH',
  'RADAR_GERAL_VIEW', 'RADAR_PROBLEMAS_VIEW',
  'RADAR_DEMANDAS_TAB_VIEW', 'RADAR_DEMANDA_FAST_TAB_VIEW',
  'RADAR_INCIDENTES_VIEW', 'RADAR_SOLICITACOES_VIEW',
  'RADAR_CATALOGO_VIEW', 'RADAR_PRECIFICACAO_DEMANDAS_VIEW',
  'RADAR_EFICIENCIA_VIEW', 'RADAR_OBSERVABILIDADE_VIEW',
  'ROADMAP_GERAL_VIEW',
  'DEMANDAS_VIEW', 'MINHAS_ATIVIDADES_VIEW',
  'TEAM_VIEW', 'TEAM_EDIT',
  'USER_CSR_VIEW', 'USER_RATECARD_VIEW',
  'SETTINGS_VIEW', 'PLANEJAMENTO_VIEW', 'CONFIGURACOES_VIEW',
  'ADMIN_ALL',
];

const PROFILES = [
  {
    id: 'admin',
    displayName: 'Administrador',
    description: 'Acesso completo a todas as funcionalidades.',
    allowedFunctions: ALL_KEYS,
  },
  {
    id: 'gerente',
    displayName: 'Gerente',
    description: 'Acesso gerencial.',
    allowedFunctions: ALL_KEYS.filter(k => k !== 'ADMIN_ALL'),
  },
  {
    id: 'analista',
    displayName: 'Analista',
    description: 'Acesso operacional padrão.',
    allowedFunctions: [
      'RADAR_VIEW', 'RADAR_GERAL_VIEW', 'RADAR_PROBLEMAS_VIEW',
      'RADAR_DEMANDAS_TAB_VIEW', 'RADAR_DEMANDA_FAST_TAB_VIEW',
      'RADAR_INCIDENTES_VIEW', 'RADAR_SOLICITACOES_VIEW',
      'RADAR_CATALOGO_VIEW', 'RADAR_EFICIENCIA_VIEW',
      'DEMANDAS_VIEW', 'MINHAS_ATIVIDADES_VIEW',
      'TEAM_VIEW', 'PLANEJAMENTO_VIEW',
    ],
  },
  {
    id: 'viewer',
    displayName: 'Visualizador',
    description: 'Somente leitura.',
    allowedFunctions: [
      'RADAR_VIEW', 'RADAR_GERAL_VIEW',
      'RADAR_DEMANDAS_TAB_VIEW',
      'DEMANDAS_VIEW', 'MINHAS_ATIVIDADES_VIEW', 'TEAM_VIEW',
    ],
  },
  {
    id: 'squad_leader',
    displayName: 'Squad Leader',
    description: 'Líder de equipe.',
    allowedFunctions: [
      'RADAR_VIEW', 'RADAR_GERAL_VIEW', 'RADAR_PROBLEMAS_VIEW',
      'RADAR_DEMANDAS_TAB_VIEW', 'RADAR_DEMANDA_FAST_TAB_VIEW',
      'RADAR_INCIDENTES_VIEW', 'RADAR_SOLICITACOES_VIEW',
      'RADAR_CATALOGO_VIEW', 'RADAR_EFICIENCIA_VIEW',
      'DEMANDAS_VIEW', 'MINHAS_ATIVIDADES_VIEW',
      'TEAM_VIEW', 'TEAM_EDIT', 'PLANEJAMENTO_VIEW',
    ],
  },
  {
    id: 'user',
    displayName: 'Usuário',
    description: 'Acesso básico.',
    allowedFunctions: [
      'DEMANDAS_VIEW', 'MINHAS_ATIVIDADES_VIEW', 'TEAM_VIEW',
    ],
  },
];

// ── JWT / OAuth2 ──────────────────────────────────────────────────────────────
function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeJwt(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const sign = createSign('RSA-SHA256');
  sign.update(unsigned);
  const sig = b64url(sign.sign(sa.private_key));
  return `${unsigned}.${sig}`;
}

function httpsPost(hostname, path, body, headers) {
  return new Promise((resolve, reject) => {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const req = request(
      { hostname, path, method: 'POST', headers: { 'Content-Length': Buffer.byteLength(bodyStr), ...headers } },
      res => { let buf = ''; res.on('data', d => buf += d); res.on('end', () => resolve({ status: res.statusCode, body: buf })); }
    );
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function httpsPatch(hostname, path, body, headers) {
  return new Promise((resolve, reject) => {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const req = request(
      { hostname, path, method: 'PATCH', headers: { 'Content-Length': Buffer.byteLength(bodyStr), ...headers } },
      res => { let buf = ''; res.on('data', d => buf += d); res.on('end', () => resolve({ status: res.statusCode, body: buf })); }
    );
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function httpsGet(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    const req = request(
      { hostname, path, method: 'GET', headers },
      res => { let buf = ''; res.on('data', d => buf += d); res.on('end', () => resolve({ status: res.statusCode, body: buf })); }
    );
    req.on('error', reject);
    req.end();
  });
}

async function getAccessToken(sa) {
  const jwt = makeJwt(sa);
  const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
  const res = await httpsPost('oauth2.googleapis.com', '/token', body, {
    'Content-Type': 'application/x-www-form-urlencoded',
  });
  if (res.status !== 200) throw new Error(`OAuth2 failed ${res.status}: ${res.body.slice(0, 200)}`);
  const data = JSON.parse(res.body);
  return data.access_token;
}

// ── Firestore helpers ─────────────────────────────────────────────────────────
const FS_HOST = 'firestore.googleapis.com';
const FS_BASE = `/v1/projects/${PROJECT}/databases/${DATABASE}/documents`;

function toFsDoc(profile) {
  const now = new Date().toISOString();
  return {
    fields: {
      profileId:        { stringValue: profile.id },
      displayName:      { stringValue: profile.displayName },
      description:      { stringValue: profile.description },
      allowedFunctions: { arrayValue: { values: profile.allowedFunctions.map(k => ({ stringValue: k })) } },
      createdAt:        { stringValue: now },
      updatedAt:        { stringValue: now },
    },
  };
}

async function upsertProfile(token, profile) {
  const path = `${FS_BASE}/permissionProfiles/${profile.id}`;
  const res = await httpsPatch(FS_HOST, path, toFsDoc(profile), {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  });
  return res;
}

async function listProfiles(token) {
  const res = await httpsGet(FS_HOST, `${FS_BASE}/permissionProfiles?pageSize=20`, {
    Authorization: `Bearer ${token}`,
  });
  const data = JSON.parse(res.body);
  return (data.documents || []).map(d => d.name.split('/').pop());
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('[restore_permission_profiles] Loading service account...');
  const sa = JSON.parse(readFileSync(SA_PATH, 'utf8'));
  console.log(`[restore_permission_profiles] Service account: ${sa.client_email}`);

  console.log('[restore_permission_profiles] Obtaining access token...');
  const token = await getAccessToken(sa);
  console.log('[restore_permission_profiles] Token obtained.');

  console.log('[restore_permission_profiles] Checking current state...');
  const existing = await listProfiles(token);
  console.log(`[restore_permission_profiles] Existing profiles: ${existing.length ? existing.join(', ') : '(none)'}`);

  console.log(`[restore_permission_profiles] Seeding ${PROFILES.length} profiles...`);
  for (const profile of PROFILES) {
    const res = await upsertProfile(token, profile);
    if (res.status >= 200 && res.status < 300) {
      console.log(`  ✔ ${profile.id} (${profile.allowedFunctions.length} keys)`);
    } else {
      console.error(`  ✗ FAILED ${profile.id}: HTTP ${res.status} - ${res.body.slice(0, 200)}`);
    }
  }

  console.log('[restore_permission_profiles] Verifying final state...');
  const final = await listProfiles(token);
  console.log(`[restore_permission_profiles] Final profiles: ${final.join(', ')}`);
  console.log('[restore_permission_profiles] Done.');
}

main().catch(err => {
  console.error('[restore_permission_profiles] FATAL:', err.message);
  process.exit(1);
});
