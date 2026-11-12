import { db } from "../firebase";
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";

export const DEFAULT_CATEGORIES = [
  {
    name: "Internal Charges Cost",
    key: "icc",
    color: "indigo",
    fields: [
      { key: "icc_1", defaultLabel: "Internal Imputations (puestos, licencias)" },
      { key: "icc_2", defaultLabel: "TGS + Adquira" },
      { key: "icc_3", defaultLabel: "Desvio de Delivery" },
      { key: "icc_4", defaultLabel: "Horas Adicionais" },
      { key: "icc_5", defaultLabel: "Encargos de Horas Adicionais" },
      { key: "icc_6", defaultLabel: "Penalidade" },
    ],
  },
  {
    name: "Purchases and Others Cost",
    key: "poc",
    color: "orange",
    fields: [
      { key: "poc_1", defaultLabel: "Goods and Services" },
      { key: "poc_2", defaultLabel: "Other Expenses" },
      { key: "poc_3", defaultLabel: "Cost 3" },
      { key: "poc_4", defaultLabel: "Cost 4" },
      { key: "poc_5", defaultLabel: "Cost 5" },
      { key: "poc_6", defaultLabel: "Cost 6" },
    ],
  },
  {
    name: "Travel Expenses Cost",
    key: "tec",
    color: "teal",
    fields: [
      { key: "tec_1", defaultLabel: "Client lunch" },
      { key: "tec_2", defaultLabel: "Mileage" },
      { key: "tec_3", defaultLabel: "Taxi" },
      { key: "tec_4", defaultLabel: "Cost 4" },
      { key: "tec_5", defaultLabel: "Cost 5" },
      { key: "tec_6", defaultLabel: "Cost 6" },
      { key: "tec_7", defaultLabel: "Cost 7" },
      { key: "tec_8", defaultLabel: "Cost 8" },
    ],
  },
];

/** Encode project code as a valid Firestore doc ID (replace / and spaces) */
function encodeId(projectCode) {
  return projectCode.replace(/\//g, "_").replace(/\s+/g, "-");
}

/** Load expenses for a project code (one-time) */
export async function loadExpenses(projectCode) {
  if (!projectCode) return null;
  try {
    const ref = doc(db, "financeiro_expenses", encodeId(projectCode));
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}

/** Subscribe to expenses for a project code */
export function subscribeToExpenses(projectCode, callback) {
  if (!projectCode) return () => {};
  const ref = doc(db, "financeiro_expenses", encodeId(projectCode));
  return onSnapshot(ref, (snap) => callback(snap.exists() ? snap.data() : null), () => callback(null));
}

/** Save expenses for a project code */
export async function saveExpenses(projectCode, data) {
  if (!projectCode) return;
  const ref = doc(db, "financeiro_expenses", encodeId(projectCode));
  await setDoc(ref, { ...data, projectCode, updatedAt: serverTimestamp() }, { merge: true });
}

/** Build empty expenses structure for a project code */
export function buildEmptyExpenses(projectCode, months) {
  const categories = {};
  for (const cat of DEFAULT_CATEGORIES) {
    categories[cat.name] = {};
    for (const f of cat.fields) {
      const values = {};
      for (const mo of months) values[mo.ps.slice(0, 7)] = 0;
      categories[cat.name][f.key] = { label: f.defaultLabel, values };
    }
  }
  return { projectCode, categories };
}

/* ─── REVENUE ─────────────────────────────────────── */
export const REVENUE_FIELDS = [
  { key: "rev_1", defaultLabel: "Fee mensal Corretivo" },
  { key: "rev_2", defaultLabel: "Novo Escopo ARC" },
  { key: "rev_3", defaultLabel: "Horas Evolutivos" },
  { key: "rev_4", defaultLabel: "Multa" },
  { key: "rev_5", defaultLabel: "Adicional 1" },
  { key: "rev_6", defaultLabel: "Adicional 2" },
  { key: "rev_8", defaultLabel: "Receita Adicional 3" },
  { key: "rev_9", defaultLabel: "Receita Adicional 4" },
  { key: "rev_10", defaultLabel: "Receita Adicional 5" },
  { key: "rev_7", defaultLabel: "Plano de Recuperação" },
];

export function buildEmptyRevenue(projectCode, months) {
  const fields = {};
  for (const f of REVENUE_FIELDS) {
    const values = {};
    for (const mo of months) values[mo.ps.slice(0, 7)] = 0;
    fields[f.key] = { label: f.defaultLabel, values };
  }
  return { projectCode, taxRate: 5.65, fields };
}

export function mergeRevenueWithDefaults(saved, projectCode, months) {
  const base = buildEmptyRevenue(projectCode, months);
  if (!saved?.fields) return base;
  if (saved.taxRate !== undefined) base.taxRate = saved.taxRate;
  for (const f of REVENUE_FIELDS) {
    const sf = saved.fields?.[f.key];
    if (sf) {
      base.fields[f.key].label = sf.label ?? f.defaultLabel;
      for (const mo of months) {
        const mk = mo.ps.slice(0, 7);
        base.fields[f.key].values[mk] = sf.values?.[mk] ?? 0;
      }
    }
  }
  return base;
}

export function subscribeToRevenue(projectCode, callback) {
  if (!projectCode) return () => {};
  const ref = doc(db, "financeiro_receita", encodeId(projectCode));
  return onSnapshot(ref, (snap) => callback(snap.exists() ? snap.data() : null), () => callback(null));
}

export async function saveRevenue(projectCode, data) {
  if (!projectCode) return;
  const ref = doc(db, "financeiro_receita", encodeId(projectCode));
  await setDoc(ref, { ...data, projectCode, updatedAt: serverTimestamp() }, { merge: true });
}

/** Merge saved data with defaults (ensures new fields get defaults) */
export function mergeWithDefaults(saved, projectCode, months) {
  const base = buildEmptyExpenses(projectCode, months);
  if (!saved?.categories) return base;
  for (const cat of DEFAULT_CATEGORIES) {
    const catData = saved.categories?.[cat.name] || {};
    for (const f of cat.fields) {
      const saved_field = catData[f.key];
      if (saved_field) {
        base.categories[cat.name][f.key].label = saved_field.label ?? f.defaultLabel;
        for (const mo of months) {
          const mk = mo.ps.slice(0, 7);
          base.categories[cat.name][f.key].values[mk] = saved_field.values?.[mk] ?? 0;
        }
      }
    }
  }
  return base;
}
