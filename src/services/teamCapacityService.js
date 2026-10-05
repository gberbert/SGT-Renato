/**
 * teamCapacityService.js
 *
 * Firestore collection: `team_capacity`
 * Document ID format: `{periodStart}_{periodEnd}` e.g. "2026-10-01_2026-10-31"
 *
 * Document shape:
 * {
 *   periodStart: "YYYY-MM-DD",
 *   periodEnd:   "YYYY-MM-DD",
 *   workingDays: number,
 *   capacityBruto: number,   // workingDays * 8
 *   baseParams: {
 *     alocacao:     number,  // %
 *     planejamento: number,  // h (0 = use computed)
 *     daily:        number,  // h/day
 *     apoio:        number,  // %
 *   },
 *   memberOverrides: {
 *     [userId]: {
 *       alocacao:     number,
 *       planejamento: number,
 *       daily:        number,
 *       apoio:        number,
 *     }
 *   },
 *   updatedAt: Timestamp,
 *   updatedBy: string,  // uid
 * }
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";

const COL = "team_capacity";

/** Build deterministic doc ID from a period. */
export function buildCapacityId(periodStart, periodEnd) {
  return `${periodStart}_${periodEnd}`;
}

/** Save (upsert) a capacity config document. */
export async function saveCapacityConfig({
  periodStart,
  periodEnd,
  workingDays,
  capacityBruto,
  baseParams,
  memberOverrides = {},
  updatedBy = "",
}) {
  const id = buildCapacityId(periodStart, periodEnd);
  const ref = doc(db, COL, id);
  await setDoc(
    ref,
    {
      periodStart,
      periodEnd,
      workingDays,
      capacityBruto,
      baseParams,
      memberOverrides,
      updatedAt: serverTimestamp(),
      updatedBy,
    },
    { merge: true }
  );
  return id;
}

/** Load a single capacity config by period. Returns null if not found. */
export async function loadCapacityConfig(periodStart, periodEnd) {
  const id = buildCapacityId(periodStart, periodEnd);
  const snap = await getDoc(doc(db, COL, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/** Subscribe to all capacity configs (ordered by periodStart desc). */
export function subscribeToCapacityConfigs(callback) {
  const q = query(collection(db, COL), orderBy("periodStart", "desc"));
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(docs);
  });
}

/** Subscribe to a single capacity config for a period. */
export function subscribeToCapacityConfig(periodStart, periodEnd, callback) {
  const id = buildCapacityId(periodStart, periodEnd);
  const ref = doc(db, COL, id);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) { callback(null); return; }
    callback({ id: snap.id, ...snap.data() });
  });
}

/** Default base params.
 *
 * NOTE: apoio / sustentacao / catalogo are in TOTAL HOURS (not %).
 * daily is in h/dia (hours per working day).
 */
export const DEFAULT_BASE_PARAMS = {
  alocacao:     100, // %
  planejamento: 0,   // h total (0 = auto-computed)
  daily:        1,   // h/dia
  apoio:        0,   // h total
  sustentacao:  0,   // h total
  catalogo:     0,   // h total
};

/**
 * Compute derived capacity values for a single member.
 *
 * apoio / sustentacao / catalogo are DIRECT HOURS (not %).
 * daily is h/dia, multiplied by workingDays internally.
 *
 * @param {number} workingDays
 * @param {object} params - { alocacao, planejamento, daily, apoio, sustentacao, catalogo }
 * @returns {{
 *   capacityBruto, capacityBrutoAlocacao,
 *   dailyH, apoioH, sustentacaoH, catalogoH,
 *   planejamentoH, capacityLiquido
 * }}
 */
export function computeCapacity(workingDays, params) {
  const wd           = Number(workingDays)        || 0;
  const alocacao     = Number(params?.alocacao     ?? 100);
  const daily        = Number(params?.daily        ?? 1);
  const apoio        = Number(params?.apoio        ?? 0);
  const sustentacao  = Number(params?.sustentacao  ?? 0);
  const catalogo     = Number(params?.catalogo     ?? 0);
  const planejamento = Number(params?.planejamento ?? 0);

  const capacityBruto         = round1(wd * 8);
  const capacityBrutoAlocacao = round1(capacityBruto * (alocacao / 100));
  const dailyH                = round1(daily * wd);
  const apoioH                = round1(apoio);
  const sustentacaoH          = round1(sustentacao);
  const catalogoH             = round1(catalogo);
  const autoLiquido           = round1(
    Math.max(0, capacityBrutoAlocacao - dailyH - apoioH - sustentacaoH - catalogoH)
  );
  const planejamentoH   = planejamento > 0 ? round1(planejamento) : autoLiquido;
  const capacityLiquido = planejamentoH;

  return {
    capacityBruto,
    capacityBrutoAlocacao,
    // kept for backward compat
    capacityDisponivel:  capacityBrutoAlocacao,
    dailyH,
    dailyTotal:          dailyH,
    apoioH,
    sustentacaoH,
    catalogoH,
    planejamentoH,
    planejamentoLiquido: planejamentoH,
    capacityLiquido,
  };
}

function round1(n) {
  return Math.round((Number(n) || 0) * 10) / 10;
}
