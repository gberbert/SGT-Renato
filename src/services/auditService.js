/**
 * Serviço de Auditoria e Monitoramento do SGT.
 *
 * Collections:
 *  - system_access_logs  → registra acessos/navegação por usuário
 *  - jira_sync_audit     → registra execuções de carga Jira (total, por escopo, tempo)
 */
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const ACCESS_LOGS = 'system_access_logs';
const SYNC_AUDIT = 'jira_sync_audit';

/** Mapeamento de pathname → label legível */
function resolvePageLabel(pathname) {
  if (!pathname || pathname === '/') return 'Início / Radar';
  if (pathname.startsWith('/radar')) return `Radar — ${pathname.replace('/radar/', '').replace('/', '')}`;
  if (pathname.startsWith('/roadmap')) return 'Roadmap Geral';
  if (pathname.startsWith('/kanban')) return 'Kanban';
  if (pathname.startsWith('/projetos')) return 'Projetos';
  if (pathname.startsWith('/estimativas')) return 'Estimativas';
  if (pathname.startsWith('/especificacoes')) return 'Especificações';
  if (pathname.startsWith('/tech-specs')) return 'Espec. Técnicas';
  if (pathname.startsWith('/t-shirts')) return 'T-Shirts';
  if (pathname.startsWith('/planejamento')) return 'Planejamento de Capacidade';
  if (pathname.startsWith('/roadmap-geral')) return 'Roadmap Geral';
  if (pathname.startsWith('/configuracoes')) return 'Configurações';
  if (pathname.startsWith('/organograma')) return 'Organograma';
  if (pathname.startsWith('/ajuda')) return 'Ajuda';
  return pathname;
}

/**
 * Registra um acesso/navegação de página.
 * @param {{ uid: string, email: string, displayName: string }} user
 * @param {string} pathname - window.location.pathname
 * @param {string} userRole
 * @param {string} [sessionId] - identificador de sessão opcional
 */
export async function logUserAccess(user, pathname, userRole, sessionId = null) {
  if (!user?.uid) return;
  try {
    await addDoc(collection(db, ACCESS_LOGS), {
      userId: user.uid,
      userEmail: user.email || '',
      userName: user.displayName || user.email?.split('@')[0] || user.uid,
      userRole: userRole || 'user',
      page: resolvePageLabel(pathname),
      pagePath: pathname,
      sessionId,
      timestamp: serverTimestamp(),
    });
  } catch (e) {
    // Auditoria não deve bloquear o fluxo normal
    console.warn('[audit] logUserAccess falhou:', e?.message);
  }
}

/**
 * Formata duração em ms para string legível. Ex: "2m 34s"
 */
function formatDuration(ms) {
  if (!ms || ms < 0) return '—';
  const totalSec = Math.round(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

/**
 * Registra a conclusão de uma carga Jira.
 * @param {{ uid: string, email: string, displayName: string }} user
 * @param {object} syncRun - estado final da carga (do operacaoSyncStore)
 * @param {number} startTimeMs - Date.now() no início da carga
 */
export async function logSyncAction(user, syncRun, startTimeMs) {
  if (!user?.uid || !syncRun) return;
  try {
    const finishedAt = Date.now();
    const durationMs = startTimeMs ? finishedAt - startTimeMs : null;

    // Extrai totais por escopo a partir de syncRun.batches
    const ticketsByEscopo = {};
    for (const batch of syncRun.batches || []) {
      if (batch.escopo) {
        ticketsByEscopo[batch.escopo] = batch.upserted || 0;
      }
    }

    await addDoc(collection(db, SYNC_AUDIT), {
      runId: syncRun.runId || null,
      userId: user.uid,
      userEmail: user.email || '',
      userName: user.displayName || user.email?.split('@')[0] || user.uid,
      status: syncRun.status || 'unknown',
      ticketsTotal: syncRun.ticketsUpserted || 0,
      ticketsFetched: syncRun.ticketsFetched || 0,
      ticketsByEscopo,
      batchCount: (syncRun.batches || []).length,
      durationMs: durationMs ?? null,
      durationFormatted: formatDuration(durationMs),
      startedAt: syncRun.startedAt || null,
      finishedAt: serverTimestamp(),
      errorMessage: syncRun.status === 'error' ? (syncRun.message || null) : null,
      message: syncRun.message || null,
    });
  } catch (e) {
    console.warn('[audit] logSyncAction falhou:', e?.message);
  }
}
