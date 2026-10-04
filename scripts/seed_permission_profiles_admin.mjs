/**
 * Standalone seed for permissionProfiles in the "default" Enterprise Firestore database.
 * Uses Firebase Admin SDK with Application Default Credentials.
 * Run: node scripts/seed_permission_profiles_admin.mjs
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ── Init ────────────────────────────────────────────────────────────────────
const appInstance = getApps().length ? getApps()[0] : initializeApp({ projectId: 'sgt-renato' });

// Named database "default" (Enterprise edition, not the legacy "(default)")
const db = getFirestore(appInstance, 'default');

// ── Permission keys ──────────────────────────────────────────────────────────
const ALL_KEYS = [
  'RADAR_VIEW',
  'RADAR_REFRESH',
  'RADAR_GERAL_VIEW',
  'RADAR_PROBLEMAS_VIEW',
  'RADAR_DEMANDAS_TAB_VIEW',
  'RADAR_DEMANDA_FAST_TAB_VIEW',
  'RADAR_INCIDENTES_VIEW',
  'RADAR_SOLICITACOES_VIEW',
  'RADAR_CATALOGO_VIEW',
  'RADAR_PRECIFICACAO_DEMANDAS_VIEW',
  'RADAR_EFICIENCIA_VIEW',
  'RADAR_OBSERVABILIDADE_VIEW',
  'ROADMAP_GERAL_VIEW',
  'DEMANDAS_VIEW',
  'MINHAS_ATIVIDADES_VIEW',
  'TEAM_VIEW',
  'TEAM_EDIT',
  'USER_CSR_VIEW',
  'USER_RATECARD_VIEW',
  'SETTINGS_VIEW',
  'PLANEJAMENTO_VIEW',
  'CONFIGURACOES_VIEW',
  'ADMIN_ALL',
];

// ── Profiles ─────────────────────────────────────────────────────────────────
const profiles = [
  {
    id: 'admin',
    label: 'Administrador',
    description: 'Acesso completo a todas as funcionalidades.',
    allowedFunctions: [...ALL_KEYS],
  },
  {
    id: 'gerente',
    label: 'Gerente',
    description: 'Acesso gerencial sem administração.',
    allowedFunctions: ALL_KEYS.filter(k => k !== 'ADMIN_ALL'),
  },
  {
    id: 'analista',
    label: 'Analista',
    description: 'Acesso operacional padrão.',
    allowedFunctions: [
      'RADAR_VIEW',
      'RADAR_GERAL_VIEW',
      'RADAR_PROBLEMAS_VIEW',
      'RADAR_DEMANDAS_TAB_VIEW',
      'RADAR_DEMANDA_FAST_TAB_VIEW',
      'RADAR_INCIDENTES_VIEW',
      'RADAR_SOLICITACOES_VIEW',
      'RADAR_CATALOGO_VIEW',
      'RADAR_EFICIENCIA_VIEW',
      'DEMANDAS_VIEW',
      'MINHAS_ATIVIDADES_VIEW',
      'TEAM_VIEW',
      'PLANEJAMENTO_VIEW',
    ],
  },
  {
    id: 'viewer',
    label: 'Visualizador',
    description: 'Apenas leitura, sem edição.',
    allowedFunctions: [
      'RADAR_VIEW',
      'RADAR_GERAL_VIEW',
      'RADAR_DEMANDAS_TAB_VIEW',
      'DEMANDAS_VIEW',
      'MINHAS_ATIVIDADES_VIEW',
      'TEAM_VIEW',
    ],
  },
];

// ── Seed ─────────────────────────────────────────────────────────────────────
async function seed() {
  console.log('[seed_permission_profiles_admin] Starting...');

  // First list what already exists
  const existingSnap = await db.collection('permissionProfiles').get();
  const existingIds = existingSnap.docs.map(d => d.id);
  console.log('[seed] Existing permissionProfiles:', existingIds.length ? existingIds.join(', ') : '(none)');

  const batch = db.batch();
  for (const profile of profiles) {
    const { id, ...data } = profile;
    const ref = db.collection('permissionProfiles').doc(id);
    batch.set(ref, { ...data, updatedAt: new Date().toISOString() }, { merge: true });
    console.log(`[seed] Queued upsert: ${id} (${data.allowedFunctions.length} keys)`);
  }

  await batch.commit();
  console.log('[seed_permission_profiles_admin] Done. All profiles upserted successfully.');
}

seed().catch(err => {
  console.error('[seed_permission_profiles_admin] FATAL:', err);
  process.exit(1);
});
