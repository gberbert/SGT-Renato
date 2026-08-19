const DB_NAME = 'sgt_operacao_radar';
const DB_VERSION = 1;
const STORE_NAME = 'ticket_cache';
const SESSION_META_KEY = 'sgt_operacao_radar_meta';

export function buildStatsFingerprint(stats) {
  if (!stats) return 'empty';
  const total =
    Number(stats.totalTicketsExact) ||
    Number(stats.totalTickets) ||
    0;
  const syncMarker =
    stats.lastSyncAt?.seconds ??
    (typeof stats.lastSyncAt?.toDate === 'function'
      ? stats.lastSyncAt.toDate().getTime()
      : null) ??
    '0';
  return `${total}:${syncMarker}`;
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Falha ao abrir cache local'));
  });
}

function runStore(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        let request;
        try {
          request = fn(store);
        } catch (error) {
          reject(error);
          return;
        }
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Falha no cache local'));
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error || new Error('Falha na transação do cache'));
      })
  );
}

export function readSessionMeta() {
  try {
    const raw = sessionStorage.getItem(SESSION_META_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeSessionMeta(meta) {
  try {
    sessionStorage.setItem(SESSION_META_KEY, JSON.stringify(meta));
  } catch {
    // sessionStorage indisponível ou cheio — cache em memória/IDB ainda funciona
  }
}

export function clearSessionMeta() {
  try {
    sessionStorage.removeItem(SESSION_META_KEY);
  } catch {
    // noop
  }
}

export async function readTicketsCache(uid) {
  if (!uid) return null;
  try {
    return await runStore('readonly', (store) => store.get(uid));
  } catch {
    return null;
  }
}

export async function writeTicketsCache(uid, payload) {
  if (!uid) return;
  try {
    await runStore('readwrite', (store) => store.put(payload, uid));
  } catch {
    // cache local opcional
  }
}

export async function clearTicketsCache(uid) {
  if (!uid) return;
  try {
    await runStore('readwrite', (store) => store.delete(uid));
  } catch {
    // noop
  }
}

export function isSessionMetaValid(meta, uid, statsFingerprint) {
  return (
    Boolean(meta) &&
    meta.uid === uid &&
    meta.statsFingerprint === statsFingerprint &&
    Number(meta.ticketCount) > 0
  );
}
