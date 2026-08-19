import { formatCallableError } from '../utils/callableError';
import { fetchRadarBootstrap } from './operacaoRadarService';

const EMPTY_FILTER_OPTIONS = { grupos: [], squads: [], statuses: [] };

let state = {
  uid: null,
  bootLoading: false,
  error: '',
  statsRadar: null,
  statsFingerprint: null,
  filterOptions: EMPTY_FILTER_OPTIONS,
  squadGrupoMap: new Map(),
  squads: [],
};

let loadToken = 0;
let activeBootstrapPromise = null;
const listeners = new Set();

function cloneFilterOptions(options = EMPTY_FILTER_OPTIONS) {
  return {
    grupos: options.grupos || [],
    squads: options.squads || [],
    statuses: options.statuses || [],
  };
}

function cloneSquadGrupoMap(map) {
  return map instanceof Map ? new Map(map) : new Map();
}

function buildStatsFingerprint(stats) {
  if (!stats) return 'empty';
  return [
    stats.totalTicketsExact ?? stats.totalTickets ?? 0,
    stats.lastSyncAt?.seconds ?? stats.lastSyncAt ?? '',
  ].join('|');
}

export function getOperacaoRadarSnapshot() {
  return {
    ...state,
    filterOptions: cloneFilterOptions(state.filterOptions),
    squadGrupoMap: cloneSquadGrupoMap(state.squadGrupoMap),
  };
}

function emit() {
  const snapshot = getOperacaoRadarSnapshot();
  listeners.forEach((listener) => listener(snapshot));
}

function patchState(partial) {
  state = { ...state, ...partial };
  emit();
}

async function runBootstrapLoad(uid, { force = false } = {}) {
  if (!uid) return;

  if (!force && state.uid === uid && state.statsRadar && !state.bootLoading) {
    return;
  }

  loadToken += 1;
  const token = loadToken;

  patchState({
    uid,
    bootLoading: true,
    error: '',
    ...(force
      ? {
          statsRadar: null,
          statsFingerprint: null,
          filterOptions: EMPTY_FILTER_OPTIONS,
          squadGrupoMap: new Map(),
          squads: [],
        }
      : {}),
  });

  try {
    const bootstrap = await fetchRadarBootstrap();
    if (loadToken !== token) return;

    patchState({
      statsRadar: bootstrap.statsRadar,
      statsFingerprint: buildStatsFingerprint(bootstrap.stats),
      filterOptions: bootstrap.filterOptions,
      squadGrupoMap: bootstrap.squadGrupoMap,
      squads: bootstrap.squads,
      bootLoading: false,
      error: '',
    });
  } catch (error) {
    if (loadToken !== token) return;
    patchState({
      error: formatCallableError(error),
      bootLoading: false,
    });
  }
}

export function subscribeOperacaoRadar(listener) {
  listeners.add(listener);
  listener(getOperacaoRadarSnapshot());
  return () => listeners.delete(listener);
}

export function ensureOperacaoRadarBootstrap(uid, options = {}) {
  if (!uid) {
    return Promise.resolve();
  }

  if (!options.force && state.uid === uid && state.statsRadar && !state.bootLoading) {
    return Promise.resolve();
  }

  if (!options.force && activeBootstrapPromise && state.uid === uid) {
    return activeBootstrapPromise;
  }

  activeBootstrapPromise = runBootstrapLoad(uid, options).finally(() => {
    activeBootstrapPromise = null;
  });

  return activeBootstrapPromise;
}

export function refreshOperacaoRadar(uid) {
  return ensureOperacaoRadarBootstrap(uid, { force: true });
}

export function resetOperacaoRadarStore() {
  loadToken += 1;
  activeBootstrapPromise = null;
  state = {
    uid: null,
    bootLoading: false,
    error: '',
    statsRadar: null,
    statsFingerprint: null,
    filterOptions: EMPTY_FILTER_OPTIONS,
    squadGrupoMap: new Map(),
    squads: [],
  };
  emit();
}
