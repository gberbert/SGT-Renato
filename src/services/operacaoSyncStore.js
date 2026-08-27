/**
 * operacaoSyncStore.js
 *
 * Store singleton para o estado da carga Jira Global.
 * Por ser um módulo ES, persiste enquanto o bundle JS estiver carregado —
 * ou seja, a carga continua mesmo que o usuário navegue para outra tela
 * e volte depois para Configurações > Jira Operação > Carga Jira.
 *
 * Em caso de refresh de página, o estado salvo no sessionStorage é
 * restaurado com status "interrupted" para que o usuário saiba que
 * precisa reiniciar.
 */

const STORAGE_KEY = 'operacao_sync_state_v1';

const _listeners = new Set();

// Estado inicial: tenta restaurar do sessionStorage
function loadInitialState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { syncRun: null, syncLoading: false, syncError: '' };
    const saved = JSON.parse(raw);
    // Se estava em andamento no momento do refresh, marca como interrompido
    if (saved.syncLoading || saved.syncRun?.status === 'running') {
      return {
        syncRun: saved.syncRun
          ? {
              ...saved.syncRun,
              status: 'error',
              message: 'Carga interrompida pelo reload da página. Reinicie a carga.',
            }
          : null,
        syncLoading: false,
        syncError: '',
      };
    }
    return {
      syncRun: saved.syncRun ?? null,
      syncLoading: false,
      syncError: saved.syncError ?? '',
    };
  } catch {
    return { syncRun: null, syncLoading: false, syncError: '' };
  }
}

let _state = loadInitialState();

function persist(state) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      syncRun: state.syncRun,
      syncLoading: state.syncLoading,
      syncError: state.syncError,
    }));
  } catch { /* ignora se sessionStorage estiver cheio */ }
}

function setState(patch) {
  _state = { ..._state, ...patch };
  persist(_state);
  _listeners.forEach((fn) => fn(_state));
}

/** Retorna o estado atual do sync */
export function getSyncState() {
  return _state;
}

/**
 * Inscreve um listener que é chamado sempre que o estado mudar.
 * Retorna uma função de unsubscribe.
 */
export function subscribeSyncState(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/** Atualiza o syncRun (usado pelo onProgress da carga) */
export function setSyncRun(syncRun) {
  setState({ syncRun });
}

/** Marca início da carga */
export function startSyncLoading(initialRun) {
  setState({ syncLoading: true, syncError: '', syncRun: initialRun });
}

/** Marca fim da carga (sucesso ou erro) */
export function finishSyncLoading(syncRun, error = '') {
  setState({ syncLoading: false, syncRun, syncError: error });
}

/** Limpa o estado da carga */
export function clearSyncState() {
  setState({ syncRun: null, syncLoading: false, syncError: '' });
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
