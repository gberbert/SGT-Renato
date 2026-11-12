import React, { useEffect, useMemo, useState, useRef } from "react";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { subscribeToUsers } from "../services/settingsService";
import { Card, Flex, Text, TextField } from "@radix-ui/themes";
import { Filter, ChevronDown, Download, SlidersHorizontal, ChevronRight } from "lucide-react";
import * as XLSX from "xlsx";
import { loadCapacityConfig, DEFAULT_BASE_PARAMS } from "../services/teamCapacityService";
import { STATUS_OPTIONS, CONTRATO_OPTIONS, FOUNDATION_OPTIONS } from "../utils/userFieldOptions";
import FinanceiroExpenses from "./FinanceiroExpenses";
import FinanceiroReceita from "./FinanceiroReceita";
import FinanceiroResumo from "./FinanceiroResumo";
import FinanceiroTermos from "./FinanceiroTermos";
import FinanceiroHorasEvolutivos from "./FinanceiroHorasEvolutivos";
import FinanceiroAlocacoes from "./FinanceiroAlocacoes";
import UserDetailsModal from "./UserDetailsModal";
import { loadExpenses, mergeWithDefaults, DEFAULT_CATEGORIES, REVENUE_FIELDS, subscribeToRevenue, mergeRevenueWithDefaults } from "../services/financeiroExpensesService";
import { ensureControlDoc, subscribeToControl, validatePassword, closeControl, openControl } from "../services/financeiroControlService";

/* ─── date helpers ─────────────────────────────────── */
function r1(n) { return Math.round((Number(n) || 0) * 10) / 10; }

function toDate(v) {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  if (v?.seconds) return new Date(v.seconds * 1000);
  if (v instanceof Date) return v;
  if (typeof v === "string") return new Date(v.length === 10 ? v + "T00:00:00" : v);
  return null;
}

const NATIONAL_FIXED = new Set([
  "01-01","04-21","05-01","09-07","10-12","11-02","11-15","11-20","12-25",
]);

function countWeekdays(year, month) {
  const last = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= last; d++) {
    const dow = new Date(year, month, d).getDay();
    if (dow === 0 || dow === 6) continue;
    const mmdd = `${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (NATIONAL_FIXED.has(mmdd)) continue;
    count++;
  }
  return count;
}

function wdBetween(s, e) {
  const sD = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const eD = new Date(e.getFullYear(), e.getMonth(), e.getDate());
  if (eD < sD) return 0;
  const total = Math.round((eD - sD) / 86400000) + 1;
  let count = 0;
  const dow0 = sD.getDay();
  for (let i = 0; i < total; i++) { const d = (dow0 + i) % 7; if (d !== 0 && d !== 6) count++; }
  return count;
}

function journeyBreakdown(periods, ps, pe) {
  const pss = ps ? toDate(ps) : null;
  const pee = pe ? toDate(pe) : null;
  let ferias = 0, folga = 0, atestado = 0, horaExtra = 0;
  for (const p of (periods || [])) {
    if (!p?.dataInicio || !p?.dataFim) continue;
    const s = toDate(p.dataInicio), e = toDate(p.dataFim);
    if (!s || !e) continue;
    const start = pss ? new Date(Math.max(s.getTime(), pss.getTime())) : s;
    const end = pee ? new Date(Math.min(e.getTime(), pee.getTime())) : e;
    if (start > end) continue;
    const h = r1(wdBetween(start, end) * 8);
    const t = (p.tipo || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, "");
    if (t.includes("feria")) ferias = r1(ferias + h);
    else if (t.includes("folga")) folga = r1(folga + h);
    else if (t.includes("atest")) atestado = r1(atestado + h);
    else if (t.includes("hora")) horaExtra = r1(horaExtra + h);
  }
  return { ferias, folga, atestado, horaExtra };
}

/* ─── classification ───────────────────────────────── */
function classificacao(contract) {
  if (!contract) return "—";
  const lc = contract.toLowerCase();
  if (lc.includes("consultoria")) return "Service Rendered Cost";
  if (lc.includes("gdne")) return "Centers Cost";
  if (lc.includes("sub")) return "External Subcontracting Cost";
  return "—";
}
function classStyle(cl) {
  if (cl === "Service Rendered Cost") return { background: "var(--indigo-3)", border: "1px solid var(--indigo-7)", color: "var(--indigo-11)" };
  if (cl === "Centers Cost") return { background: "var(--green-3)", border: "1px solid var(--green-7)", color: "var(--green-11)" };
  if (cl === "External Subcontracting Cost") return { background: "var(--orange-3)", border: "1px solid var(--orange-7)", color: "var(--orange-11)" };
  return { background: "var(--gray-3)", border: "1px solid var(--gray-6)", color: "var(--gray-9)" };
}

function fmtCurrency(v) {
  if (!v && v !== 0) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}
/* ─── misc helpers ─────────────────────────────────── */
function getUserLabel(u) { return u?.displayName || u?.shortName || u?.name || u?.email || u?.id || "Sem nome"; }
function safe(v) { if (v == null) return ""; if (Array.isArray(v)) return v.join(", "); if (typeof v === "object") return JSON.stringify(v); return String(v); }
function uidFrom(m) { if (!m) return ""; if (typeof m === "string") return m; return m?.id || ""; }
function tagStyle(active, color) {
  const c = color || "accent";
  return { padding: "2px 10px", borderRadius: 999, border: active ? `1px solid var(--${c}-9)` : "1px solid var(--gray-6)", background: active ? `var(--${c}-3)` : "transparent", color: active ? `var(--${c}-11)` : "var(--gray-11)", fontSize: 12, fontWeight: active ? 700 : 400, cursor: "pointer", transition: "all 0.15s", letterSpacing: "0.04em" };
}
const clearStyle = { padding: "2px 8px", borderRadius: 999, border: "1px solid var(--red-6)", background: "transparent", color: "var(--red-10)", fontSize: 11, cursor: "pointer" };

/* ─── table styles ─────────────────────────────────── */
const B = { padding: "6px 8px", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "var(--gray-9)", borderBottom: "2px solid var(--gray-4)", whiteSpace: "nowrap", background: "var(--gray-2)", position: "sticky", top: 0, zIndex: 2 };
const THL = { ...B, textAlign: "left" };
const THR = { ...B, textAlign: "right" };
const D = { padding: "6px 8px", fontSize: 12, borderBottom: "1px solid var(--gray-3)", whiteSpace: "nowrap", verticalAlign: "middle" };
const TDL = { ...D, textAlign: "left" };
const TDR = { ...D, textAlign: "right" };
const F = { padding: "6px 8px", fontSize: 12, fontWeight: 700, background: "var(--gray-3)", whiteSpace: "nowrap", verticalAlign: "middle", borderTop: "2px solid var(--gray-5)", color: "var(--gray-11)" };
const TFL = { ...F, textAlign: "left" };
const TFR = { ...F, textAlign: "right" };

/* ─── month helpers ────────────────────────────────── */
function getMonthsFrom(startYM, count) {
  const [y, m] = startYM.split("-").map(Number);
  const result = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(y, m - 1 + i, 1);
    const year = d.getFullYear();
    const month = d.getMonth(); // 0-based
    const pad = (n) => String(n).padStart(2, "0");
    const ps = `${year}-${pad(month + 1)}-01`;
    const pe = `${year}-${pad(month + 1)}-${pad(new Date(year, month + 1, 0).getDate())}`;
    const raw = d.toLocaleString("pt-BR", { month: "short", year: "2-digit" });
    const label = raw.replace(".", "").replace(/^(\w)/, (c) => c.toUpperCase());
    result.push({ year, month, ps, pe, label });
  }
  return result;
}

function todayYM() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
}

/* ─── component ─────────────────────────────────────── */
export default function Financeiro() {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [squads, setSquads] = useState([]);
  const [monthConfigs, setMonthConfigs] = useState([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [selSquads, setSelSquads] = useState(new Set());
  const [selStatuses, setSelStatuses] = useState(new Set());
  const [selContracts, setSelContracts] = useState(new Set());
  const [selFoundations, setSelFoundations] = useState(new Set());
  const [selProjectCodes, setSelProjectCodes] = useState(new Set());
  const [filtersCollapsed, setFiltersCollapsed] = useState(true);

  const [startMonth, setStartMonth] = useState(todayYM);
  const [viewMode, setViewMode] = useState("horas"); // "horas" | "valor"
  const [activeTab, setActiveTab] = useState("custo");
  const [termosSubTab, setTermosSubTab] = useState("gerenciar");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterRef = useRef(null);
  const [exportExpenses, setExportExpenses] = useState({});
  const [exportRevenue, setExportRevenue] = useState({});
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isClosed, setIsClosed] = useState(false);
  const [closedMeta, setClosedMeta] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordAction, setPasswordAction] = useState(null); // "close" | "open"
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const months = useMemo(() => getMonthsFrom(startMonth, 6), [startMonth]);

  /* load data */
  useEffect(() => { const u = subscribeToUsers((d) => { setUsers(d || []); setLoadingUsers(false); }); return () => u(); }, []);
  useEffect(() => { return onSnapshot(query(collection(db, "squads")), (s) => setSquads(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {}); }, []);

  /* subscribe to financial control state */
  useEffect(() => {
    ensureControlDoc().catch(() => {});
    return subscribeToControl((data) => {
      setIsClosed(data.isClosed ?? false);
      setClosedMeta(data.isClosed ? { closedBy: data.closedBy, closedAt: data.closedAt } : null);
    });
  }, []);

  /* load capacity configs for all 6 months */
  useEffect(() => {
    setLoadingConfigs(true);
    Promise.all(months.map(({ ps, pe }) => loadCapacityConfig(ps, pe)))
      .then((configs) => setMonthConfigs(configs))
      .catch(() => setMonthConfigs(months.map(() => null)))
      .finally(() => setLoadingConfigs(false));
  }, [startMonth]);

  /* membership maps */
  const membership = useMemo(() => {
    const map = new Map();
    for (const sq of squads) {
      if (!sq?.id) continue;
      for (const m of (Array.isArray(sq.users) ? sq.users : [])) {
        const id = uidFrom(m); if (!id) continue;
        if (!map.has(id)) map.set(id, new Set());
        map.get(id).add(sq.id);
      }
    }
    return map;
  }, [squads]);

  const squadById = useMemo(() => { const m = {}; for (const s of squads) m[s.id] = s; return m; }, [squads]);
  const squadsSorted = useMemo(() => [...squads].sort((a, b) => (a?.name || a?.key || "").toString().toUpperCase().localeCompare((b?.name || b?.key || "").toString().toUpperCase(), "pt-BR")), [squads]);
  const usersSorted = useMemo(() => [...users].sort((a, b) => getUserLabel(a).toUpperCase().localeCompare(getUserLabel(b).toUpperCase(), "pt-BR")), [users]);
  const projectCodeOptions = useMemo(() => { const c = new Set(); for (const u of usersSorted) { if (u?.projectCode) c.add(u.projectCode); } return [...c].sort(); }, [usersSorted]);

  /* load expenses + revenue for export — must come after projectCodeOptions useMemo */
  useEffect(() => {
    if (!projectCodeOptions?.length) return;
    Promise.all(projectCodeOptions.map(async (code) => {
      const saved = await loadExpenses(code).catch(() => null);
      return [code, mergeWithDefaults(saved, code, months)];
    })).then((entries) => setExportExpenses(Object.fromEntries(entries)));
  }, [projectCodeOptions.join(","), months.map(m => m.ps).join(",")]);

  useEffect(() => {
    if (!projectCodeOptions?.length) return;
    const unsubs = projectCodeOptions.map((code) =>
      subscribeToRevenue(code, (saved) => {
        setExportRevenue((prev) => ({ ...prev, [code]: mergeRevenueWithDefaults(saved, code, months) }));
      })
    );
    return () => unsubs.forEach((u) => u && u());
  }, [projectCodeOptions.join(","), months.map(m => m.ps).join(",")]);

  const handlePasswordConfirm = async () => {
    if (!passwordInput.trim()) { setPasswordError("Informe a senha."); return; }
    setPasswordLoading(true);
    setPasswordError("");
    try {
      const valid = await validatePassword(passwordInput);
      if (!valid) { setPasswordError("Senha incorreta."); return; }
      if (passwordAction === "close") {
        await closeControl(months, rows, projectCodeOptions, exportExpenses, exportRevenue);
      } else {
        await openControl();
      }
      setShowPasswordModal(false);
      setPasswordInput("");
    } catch (err) {
      setPasswordError("Erro ao processar. Tente novamente.");
      console.error(err);
    } finally {
      setPasswordLoading(false);
    }
  };

  const makeToggle = (setter) => (val) => setter((p) => { const n = new Set(p); n.has(val) ? n.delete(val) : n.add(val); return n; });

  const usersFiltered = useMemo(() => usersSorted.filter((u) => {
    const term = searchTerm.trim().toLowerCase();
    if (term && !getUserLabel(u).toLowerCase().includes(term) && !(u?.id || "").toLowerCase().includes(term)) return false;
    if (selSquads.size > 0) { const sq = membership.get(u.id) || new Set(); if (![...selSquads].some((sid) => sq.has(sid))) return false; }
    if (selStatuses.size > 0 && !selStatuses.has(u?.status || "")) return false;
    if (selContracts.size > 0 && !selContracts.has(u?.contract || "")) return false;
    if (selFoundations.size > 0 && !selFoundations.has(u?.foundation || "")) return false;
    if (selProjectCodes.size > 0) {
      const code = u?.projectCode || "";
      if (!((selProjectCodes.has("__SEM_CODIGO__") && !code) || (code && selProjectCodes.has(code)))) return false;
    }
    return true;
  }), [searchTerm, usersSorted, selSquads, membership, selStatuses, selContracts, selFoundations, selProjectCodes]);

  /* compute rows with per-month hours */
  const rows = useMemo(() => {
    if (monthConfigs.length < 6) return [];
    return usersFiltered.map((u) => {
      const id = u.id || u.uid;
      const userSquads = [...(membership.get(id) || new Set())].map((sid) => ({ id: sid, label: squadById[sid]?.name || squadById[sid]?.key || sid }));
      const cl = classificacao(u?.contract);
      const csrRate = parseFloat(String(u?.csr || "0").replace(",", ".")) || 0;
      const monthHours = months.map(({ year, month, ps, pe }, i) => {
        const cfg = monthConfigs[i];
        const defAloc = cfg?.baseParams?.alocacao ?? DEFAULT_BASE_PARAMS?.alocacao ?? 100;
        const ov = cfg?.memberOverrides?.[id] || {};
        const aloc = ov.alocacao !== undefined ? ov.alocacao : defAloc;
        const wd = cfg?.workingDays ?? countWeekdays(year, month);
        const capBruto = r1(wd * 8 * aloc / 100);
        const jb = journeyBreakdown(u.journeyPeriods, ps, pe);
        return r1(capBruto - jb.ferias - jb.folga - jb.atestado + jb.horaExtra);
      });
      const monthValues = monthHours.map((h) => r1(h * csrRate));
      const total = r1(monthHours.reduce((a, v) => a + v, 0));
      const totalValue = r1(monthValues.reduce((a, v) => a + v, 0));
      return { user: u, id, userSquads, classificacao: cl, monthHours, monthValues, total, totalValue, csrRate };
    });
  }, [usersFiltered, monthConfigs, months, membership, squadById]);

  /* column totals */
  const colTotals = useMemo(() => {
    const tots = months.map((_, i) => r1(rows.reduce((a, r) => a + (r.monthHours[i] || 0), 0)));
    const grand = r1(tots.reduce((a, v) => a + v, 0));
    const totVals = months.map((_, i) => r1(rows.reduce((a, r) => a + (r.monthValues[i] || 0), 0)));
    const grandVal = r1(totVals.reduce((a, v) => a + v, 0));
    return { tots, grand, totVals, grandVal };
  }, [rows, months]);

  // Grouped rows: group by projectCode + classificação
  const groupedRows = useMemo(() => {
    const groups = new Map();
    for (const r of rows) {
      const pc = r.user?.projectCode || "";
      const cl = r.classificacao;
      const key = `${pc}|||${cl}`;
      if (!groups.has(key)) groups.set(key, { projectCode: pc, classificacao: cl, rows: [], monthHourTotals: months.map(() => 0), monthValTotals: months.map(() => 0) });
      const g = groups.get(key);
      g.rows.push(r);
      r.monthHours.forEach((h, i) => { g.monthHourTotals[i] = r1(g.monthHourTotals[i] + h); });
      r.monthValues.forEach((v, i) => { g.monthValTotals[i] = r1(g.monthValTotals[i] + v); });
    }
    return [...groups.values()].sort((a, b) => {
      const pa = a.projectCode || "\uffff", pb = b.projectCode || "\uffff";
      if (pa !== pb) return pa.localeCompare(pb, "pt-BR");
      return a.classificacao.localeCompare(b.classificacao, "pt-BR");
    });
  }, [rows, months]);

  const hasFilters = searchTerm || selSquads.size > 0 || selStatuses.size > 0 || selContracts.size > 0 || selFoundations.size > 0 || selProjectCodes.size > 0;
  function clearAll() { setSearchTerm(""); setSelSquads(new Set()); setSelStatuses(new Set()); setSelContracts(new Set()); setSelFoundations(new Set()); setSelProjectCodes(new Set()); }

  function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function calcNetLine(gross, taxRate) { return gross < 0 ? gross : Math.round(gross * (1 - taxRate / 100) * 100) / 100; }
  function numVal(s) { return parseFloat(String(s || "0").replace(",", ".")) || 0; }

  function exportXlsx() {
    const dateStr = new Date().toISOString().slice(0, 10);
    const dataRows = rows.map((r) => {
      const row = {
        "Membro": getUserLabel(r.user),
        "Cód. SAP": r.user?.sapId || "—",
        "Cód. Projeto": r.user?.projectCode || "—",
        "Squad(s)": r.userSquads.map((s) => s.label).join("; ") || "—",
        "Contrato": r.user?.contract || "—",
        "Classificação": r.classificacao,
      };
      months.forEach(({ label }, i) => { row[label] = r.monthHours[i]; });
      row["TOTAL"] = r.total;
      return row;
    });
    const totRow = { "Membro": `TOTAL (${rows.length} membros)`, "Cód. Projeto": "", "Squad(s)": "", "Contrato": "", "Classificação": "" };
    months.forEach(({ label }, i) => { totRow[label] = colTotals.tots[i]; });
    totRow["TOTAL"] = colTotals.grand;
    dataRows.push(totRow);
    const ws = XLSX.utils.json_to_sheet(dataRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Custo");
    ws["!cols"] = Object.keys(dataRows[0] || {}).map((k) => ({ wch: Math.max(k.length, ...dataRows.map((r) => String(r[k] ?? "").length), 8) }));
    XLSX.writeFile(wb, `financeiro_custo_${dateStr}.xlsx`);
  }

  function exportFullXlsx() {
    setExportLoading(true);
    try {
      const wb = XLSX.utils.book_new();
      const dateStr = new Date().toISOString().slice(0, 10);

      // ── Sheet 1: HORA ──
      const horaRows = rows.map((r) => {
        const row = {
          "Membro": getUserLabel(r.user),
          "Cód. SAP": r.user?.sapId || "",
          "Status": r.user?.status || "",
          "Cód. Projeto": r.user?.projectCode || "",
          "Squad(s)": r.userSquads.map((s) => s.label).join("; "),
          "Contrato": r.user?.contract || "",
          "Classificação": r.classificacao,
          "CSR (R$/h)": r.csrRate,
        };
        months.forEach(({ label }, i) => {
          row[`${label} (h)`] = r.monthHours[i];
          row[`${label} (R$)`] = r.monthValues[i];
        });
        row["TOTAL (h)"] = r.total;
        row["TOTAL (R$)"] = r.totalValue;
        return row;
      });
      // Totals row
      const horaTot = { "Membro": "TOTAL", "Cód. SAP": "", "Status": "", "Cód. Projeto": "", "Squad(s)": "", "Contrato": "", "Classificação": "", "CSR (R$/h)": "" };
      months.forEach(({ label }, i) => {
        horaTot[`${label} (h)`] = colTotals.tots[i];
        horaTot[`${label} (R$)`] = colTotals.totVals[i];
      });
      horaTot["TOTAL (h)"] = colTotals.grand;
      horaTot["TOTAL (R$)"] = colTotals.grandVal;
      horaRows.push(horaTot);
      const wsHora = XLSX.utils.json_to_sheet(horaRows);
      wsHora["!cols"] = Object.keys(horaRows[0] || {}).map((k) => ({ wch: Math.max(k.length, 10) }));
      XLSX.utils.book_append_sheet(wb, wsHora, "HORA");

      // ── Sheet 2: EXPENSES ──
      const expRows = [];
      for (const code of projectCodeOptions) {
        const expData = exportExpenses[code];
        for (const cat of DEFAULT_CATEGORIES) {
          const fields = expData?.categories?.[cat.name] || {};
          for (const [, f] of Object.entries(fields)) {
            const row = { "Cód. Projeto": code, "Categoria": cat.name, "Descrição": f.label || "" };
            let total = 0;
            months.forEach(({ ps, label }) => {
              const mk = ps.slice(0, 7);
              const v = numVal(f?.values?.[mk]);
              row[label] = v;
              total += v;
            });
            row["TOTAL"] = r2(total);
            expRows.push(row);
          }
        }
      }
      if (expRows.length > 0) {
        const wsExp = XLSX.utils.json_to_sheet(expRows);
        wsExp["!cols"] = Object.keys(expRows[0] || {}).map((k) => ({ wch: Math.max(k.length, 12) }));
        XLSX.utils.book_append_sheet(wb, wsExp, "EXPENSES");
      }

      // ── Sheet 3: RECEITA ──
      const recRows = [];
      for (const code of projectCodeOptions) {
        const revData = exportRevenue[code];
        const taxRate = revData?.taxRate ?? 5.65;
        for (const f of REVENUE_FIELDS) {
          const fieldData = revData?.fields?.[f.key];
          const row = { "Cód. Projeto": code, "Imposto%": taxRate, "Descrição": fieldData?.label || f.key };
          let totalGross = 0, totalNet = 0;
          months.forEach(({ ps, label }) => {
            const mk = ps.slice(0, 7);
            const gross = numVal(fieldData?.values?.[mk]);
            const net = calcNetLine(gross, taxRate);
            row[`${label} Gross`] = gross;
            row[`${label} Net`] = net;
            totalGross += gross;
            totalNet += net;
          });
          row["TOTAL Gross"] = r2(totalGross);
          row["TOTAL Net"] = r2(totalNet);
          recRows.push(row);
        }
      }
      if (recRows.length > 0) {
        const wsRec = XLSX.utils.json_to_sheet(recRows);
        wsRec["!cols"] = Object.keys(recRows[0] || {}).map((k) => ({ wch: Math.max(k.length, 12) }));
        XLSX.utils.book_append_sheet(wb, wsRec, "RECEITA");
      }

      // ── Sheet 4: RESUMO ──
      const resRows = [];
      const fmtPctXlsx = (v) => v !== null && v !== "" ? `${parseFloat(v).toFixed(2)}%` : "";

      // Per project: custo + receita net + margem
      const allCostByMonth = months.map(() => 0);
      const allRevByMonth = months.map(() => 0);

      for (const code of projectCodeOptions) {
        const expData = exportExpenses[code];
        const revData = exportRevenue[code];
        const taxRate = revData?.taxRate ?? 5.65;
        const peopleCost = months.map((_, i) => r2(rows.filter(r => r.user?.projectCode === code).reduce((s, r) => s + (r.monthValues[i] || 0), 0)));
        const expCost = months.map(({ ps }) => {
          const mk = ps.slice(0, 7);
          if (!expData?.categories) return 0;
          return r2(DEFAULT_CATEGORIES.reduce((s, cat) => {
            const fields = expData.categories[cat.name] || {};
            return s + Object.values(fields).reduce((fs, f) => fs + numVal(f?.values?.[mk]), 0);
          }, 0));
        });
        const totalCost = months.map((_, i) => r2(peopleCost[i] + expCost[i]));
        const revNet = months.map(({ ps }) => {
          const mk = ps.slice(0, 7);
          if (!revData?.fields) return 0;
          return r2(REVENUE_FIELDS.reduce((s, f) => s + calcNetLine(numVal(revData.fields[f.key]?.values?.[mk]), taxRate), 0));
        });
        const costRow = { "Cód. Projeto": code, "Linha": "Custo" };
        const revRow = { "Cód. Projeto": code, "Linha": "Receita Net" };
        const marRow = { "Cód. Projeto": code, "Linha": "% Margem" };
        let sumC = 0, sumR = 0;
        months.forEach(({ label }, i) => {
          costRow[label] = totalCost[i]; sumC += totalCost[i];
          revRow[label] = revNet[i]; sumR += revNet[i];
          allCostByMonth[i] = r2(allCostByMonth[i] + totalCost[i]);
          allRevByMonth[i] = r2(allRevByMonth[i] + revNet[i]);
          const m = revNet[i] !== 0 ? ((revNet[i] - totalCost[i]) / revNet[i]) * 100 : null;
          marRow[label] = fmtPctXlsx(m);
        });
        costRow["TOTAL"] = r2(sumC);
        revRow["TOTAL"] = r2(sumR);
        const totalMar = sumR !== 0 ? ((sumR - sumC) / sumR * 100) : null;
        marRow["TOTAL"] = fmtPctXlsx(totalMar);
        resRows.push(costRow, revRow, marRow);
      }

      // Consolidated section
      const grandCostC = r2(allCostByMonth.reduce((s, v) => s + v, 0));
      const grandRevC = r2(allRevByMonth.reduce((s, v) => s + v, 0));
      resRows.push({ "Cód. Projeto": "", "Linha": "" }); // blank separator
      const consCostRow = { "Cód. Projeto": "CONSOLIDADO", "Linha": "Custo Total" };
      const consRevRow = { "Cód. Projeto": "CONSOLIDADO", "Linha": "Receita Net Total" };
      const consMarRow = { "Cód. Projeto": "CONSOLIDADO", "Linha": "% Margem Consolidada" };
      months.forEach(({ label }, i) => {
        consCostRow[label] = allCostByMonth[i];
        consRevRow[label] = allRevByMonth[i];
        const m = allRevByMonth[i] !== 0 ? ((allRevByMonth[i] - allCostByMonth[i]) / allRevByMonth[i]) * 100 : null;
        consMarRow[label] = fmtPctXlsx(m);
      });
      consCostRow["TOTAL"] = grandCostC;
      consRevRow["TOTAL"] = grandRevC;
      const grandMar = grandRevC !== 0 ? ((grandRevC - grandCostC) / grandRevC * 100) : null;
      consMarRow["TOTAL"] = fmtPctXlsx(grandMar);
      resRows.push(consCostRow, consRevRow, consMarRow);

      if (resRows.length > 0) {
        const wsRes = XLSX.utils.json_to_sheet(resRows);
        wsRes["!cols"] = Object.keys(resRows[0] || {}).map((k) => ({ wch: Math.max(k.length, 12) }));
        XLSX.utils.book_append_sheet(wb, wsRes, "RESUMO");
      }

      XLSX.writeFile(wb, `financeiro_completo_${dateStr}.xlsx`);
    } finally {
      setExportLoading(false);
    }
  }

  if (loadingUsers) return <div className="view-content" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}><div className="spinner" /></div>;

  return (
    <div className="view-content" style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── STICKY HEADER ── */}
      <div className="team-sticky-header">
        <div className="welcome-banner" style={{ marginBottom: 12 }}>
          <Text as="h1" size="6" weight="bold">Financeiro</Text>
          <Text size="1" style={{ color: "var(--gray-9)", marginTop: 4, display: "block" }}>
            {rows.length} membro{rows.length !== 1 ? "s" : ""} · projeção 6 meses
          </Text>
        </div>

        <Card size="2" style={{ borderBottom: "none", boxShadow: "none" }}>
          <Flex mb="3" align="center" gap="3" wrap="wrap">
            <TextField.Root placeholder="Pesquisar por nome ou id..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ flexGrow: 1, minWidth: 260 }} />
            <button type="button" onClick={() => setFiltersCollapsed((v) => !v)} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, border: filtersCollapsed ? "1px solid var(--indigo-7)" : "1px solid var(--gray-6)", background: filtersCollapsed ? "var(--indigo-3)" : "var(--gray-2)", color: filtersCollapsed ? "var(--indigo-11)" : "var(--gray-10)", cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s" }}>
              <ChevronDown size={14} style={{ transform: filtersCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
              {filtersCollapsed ? "Filtros" : "Recolher"}
            </button>
            {hasFilters && <button type="button" onClick={clearAll} style={{ padding: "5px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, border: "1px solid var(--red-7)", background: "var(--red-3)", color: "var(--red-11)", cursor: "pointer", whiteSpace: "nowrap", letterSpacing: "0.04em" }}>✕ Limpar filtros</button>}
          </Flex>

          <div style={{ overflow: "hidden", maxHeight: filtersCollapsed ? "0" : "600px", opacity: filtersCollapsed ? 0 : 1, transition: "max-height 0.25s ease, opacity 0.2s ease", pointerEvents: filtersCollapsed ? "none" : undefined }}>
            <Flex mb="2" align="center" gap="3" wrap="wrap">
              <Flex align="center" gap="2" wrap="wrap">
                <Text size="1" weight="bold" style={{ textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--gray-10)" }}>STATUS</Text>
                {(STATUS_OPTIONS || []).map((opt) => <button key={opt} type="button" onClick={() => makeToggle(setSelStatuses)(opt)} style={tagStyle(selStatuses.has(opt), "green")}>{opt.toUpperCase()}</button>)}
                {selStatuses.size > 0 && <button type="button" onClick={() => setSelStatuses(new Set())} style={clearStyle}>✕</button>}
              </Flex>
              <div style={{ width: 1, height: 20, background: "var(--gray-5)", flexShrink: 0 }} />
              <Flex align="center" gap="1" style={{ color: "var(--gray-10)" }}><Filter size={13} /><Text size="1" weight="bold" style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>SQUAD</Text></Flex>
              {squadsSorted.map((sq) => <button key={sq.id} type="button" onClick={() => makeToggle(setSelSquads)(sq.id)} style={tagStyle(selSquads.has(sq.id), "cyan")}>{(sq.name || sq.key || sq.sigla || "").toUpperCase()}</button>)}
              {selSquads.size > 0 && <button type="button" onClick={() => setSelSquads(new Set())} style={clearStyle}>✕</button>}
            </Flex>
            <Flex mb="1" align="center" gap="3" wrap="wrap">
              <Flex align="center" gap="2" wrap="wrap">
                <Text size="1" weight="bold" style={{ textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--gray-10)" }}>CONTRATO</Text>
                {(CONTRATO_OPTIONS || []).map((opt) => <button key={opt} type="button" onClick={() => makeToggle(setSelContracts)(opt)} style={tagStyle(selContracts.has(opt), "iris")}>{opt.toUpperCase()}</button>)}
                {selContracts.size > 0 && <button type="button" onClick={() => setSelContracts(new Set())} style={clearStyle}>✕</button>}
              </Flex>
              <div style={{ width: 1, height: 20, background: "var(--gray-5)", flexShrink: 0 }} />
              <Flex align="center" gap="1" style={{ color: "var(--gray-10)" }}><Filter size={13} /><Text size="1" weight="bold" style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>FOUNDATION</Text></Flex>
              {(FOUNDATION_OPTIONS || []).map((opt) => <button key={opt} type="button" onClick={() => makeToggle(setSelFoundations)(opt)} style={tagStyle(selFoundations.has(opt), "violet")}>{opt.toUpperCase()}</button>)}
              {selFoundations.size > 0 && <button type="button" onClick={() => setSelFoundations(new Set())} style={clearStyle}>✕</button>}
            </Flex>
            <Flex mb="1" align="center" gap="3" wrap="wrap">
              <Flex align="center" gap="2" wrap="wrap">
                <Text size="1" weight="bold" style={{ textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--gray-10)" }}>CÓD. PROJETO</Text>
                <button type="button" onClick={() => makeToggle(setSelProjectCodes)("__SEM_CODIGO__")} style={tagStyle(selProjectCodes.has("__SEM_CODIGO__"), "tomato")}>SEM CÓDIGO</button>
                {projectCodeOptions.map((code) => <button key={code} type="button" onClick={() => makeToggle(setSelProjectCodes)(code)} style={tagStyle(selProjectCodes.has(code), "amber")}>{code.toUpperCase()}</button>)}
                {selProjectCodes.size > 0 && <button type="button" onClick={() => setSelProjectCodes(new Set())} style={clearStyle}>✕</button>}
              </Flex>
            </Flex>
          </div>
        </Card>
      </div>

      {/* ── USER DETAILS MODAL ── */}
      {selectedUser && (
        <UserDetailsModal
          open={!!selectedUser}
          onOpenChange={(v) => { if (!v) setSelectedUser(null); }}
          user={selectedUser}
        />
      )}

      {/* ── PASSWORD MODAL ── */}
      {showPasswordModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--color-panel-solid)", border: "1px solid var(--gray-6)", borderRadius: 14, padding: 28, width: 360, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--gray-12)" }}>
              {passwordAction === "close" ? "🔒 Fechar Controle Financeiro" : "🔓 Abrir Controle Financeiro"}
            </div>
            <div style={{ fontSize: 12, color: "var(--gray-9)" }}>
              {passwordAction === "close"
                ? "Ao fechar, as horas projetadas serão salvas como snapshot e todas as abas ficarão em modo leitura."
                : "Informe a senha para reabrir o controle financeiro para edição."}
            </div>
            <input
              type="password"
              autoFocus
              value={passwordInput}
              onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handlePasswordConfirm()}
              placeholder="Senha..."
              style={{ padding: "8px 12px", borderRadius: 7, border: `1px solid ${passwordError ? "var(--red-7)" : "var(--gray-6)"}`, background: "var(--gray-2)", color: "var(--gray-12)", fontSize: 14, outline: "none" }}
            />
            {passwordError && <div style={{ fontSize: 12, color: "var(--red-11)", marginTop: -8 }}>{passwordError}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => { setShowPasswordModal(false); setPasswordInput(""); setPasswordError(""); }} style={{ padding: "7px 16px", borderRadius: 7, border: "1px solid var(--gray-6)", background: "var(--gray-3)", color: "var(--gray-11)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button type="button" onClick={handlePasswordConfirm} disabled={passwordLoading} style={{ padding: "7px 20px", borderRadius: 7, border: "none", background: passwordAction === "close" ? "var(--red-9)" : "var(--green-9)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: passwordLoading ? "not-allowed" : "pointer", opacity: passwordLoading ? 0.7 : 1 }}>
                {passwordLoading ? "Aguarde…" : passwordAction === "close" ? "Fechar" : "Abrir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── GLOBAL EXPORT + CONTROL ── */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {isClosed && closedMeta && (
            <span style={{ fontSize: 11, color: "var(--red-11)", fontWeight: 600 }}>
              🔒 Fechado por {closedMeta.closedBy || "—"}
            </span>
          )}
          <button type="button" onClick={() => { setPasswordAction(isClosed ? "open" : "close"); setPasswordInput(""); setPasswordError(""); setShowPasswordModal(true); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 700, border: `1px solid ${isClosed ? "var(--green-7)" : "var(--red-7)"}`, background: isClosed ? "var(--green-3)" : "var(--red-3)", color: isClosed ? "var(--green-11)" : "var(--red-11)", cursor: "pointer", letterSpacing: "0.04em", transition: "all 0.15s" }}>
            {isClosed ? "🔓 Abrir Controle" : "🔒 Fechar Controle"}
          </button>
          <button type="button" onClick={exportFullXlsx} disabled={exportLoading} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 16px", borderRadius: 7, fontSize: 12, fontWeight: 700, border: "1px solid var(--indigo-7)", background: exportLoading ? "var(--gray-3)" : "var(--indigo-3)", color: exportLoading ? "var(--gray-9)" : "var(--indigo-11)", cursor: exportLoading ? "not-allowed" : "pointer", letterSpacing: "0.04em", transition: "all 0.15s" }}>
            <Download size={14} />
            {exportLoading ? "Gerando…" : "⬇ Exportar Relatório Completo (XLSX)"}
          </button>
        </div>
      </div>

      {/* ── MONTH RANGE SELECTOR (global — applies to all tabs) ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-10)", whiteSpace: "nowrap" }}>Início do período (6 meses):</label>
        <input
          type="month"
          value={startMonth}
          onChange={(e) => setStartMonth(e.target.value)}
          style={{ padding: "5px 10px", fontSize: 13, borderRadius: 6, border: "1px solid var(--indigo-6)", background: "var(--indigo-2)", color: "var(--gray-12)", outline: "none", cursor: "pointer" }}
        />
        {loadingConfigs && <span style={{ fontSize: 11, color: "var(--amber-11)" }}>Carregando…</span>}
      </div>

      {/* ── TAB BAR ── */}
      <div style={{ display: "flex", gap: 8, padding: "12px 0 0 0", borderBottom: "1px solid var(--gray-5)" }}>
        {[
          { id: "resumo", label: "RESUMO", dot: null },
          { id: "custo", label: "HORA", dot: "var(--red-9)" },
          { id: "expenses", label: "EXPENSES", dot: "var(--red-9)" },
          { id: "receita", label: "RECEITA", dot: "var(--green-9)" },
          { id: "termos", label: "📄 TERMOS", dot: null },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", background: "transparent", color: activeTab === tab.id ? "var(--indigo-11)" : "var(--gray-10)", border: "none", borderBottom: activeTab === tab.id ? "2px solid var(--indigo-11)" : "2px solid transparent", cursor: "pointer", transition: "all 0.15s", display: "inline-flex", alignItems: "center", gap: 6 }}>
            {tab.dot && <span style={{ width: 7, height: 7, borderRadius: "50%", background: tab.dot, flexShrink: 0 }} />}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── RESUMO TAB ── */}
      {activeTab === "resumo" && (
        <FinanceiroResumo rows={rows} months={months} projectCodeOptions={projectCodeOptions} readOnly={isClosed} />
      )}

      {/* ── EXPENSES TAB ── */}
      {activeTab === "expenses" && (
        <FinanceiroExpenses projectCodes={projectCodeOptions} months={months} readOnly={isClosed} />
      )}

      {/* ── RECEITA TAB ── */}
      {activeTab === "receita" && (
        <FinanceiroReceita projectCodes={projectCodeOptions} months={months} readOnly={isClosed} />
      )}

      {/* ── TERMOS TAB ── */}
      {activeTab === "termos" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Sub-tab bar */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              { id: "gerenciar",  label: "📋 GERENCIAR TERMOS", color: "var(--indigo-9)" },
              { id: "demanda",    label: "DEMANDAS",             color: "#3b82f6" },
              { id: "fast",       label: "⚡ DEMANDAS FAST",      color: "#f59e0b" },
              { id: "catalogo",   label: "CATÁLOGO",             color: "#a855f7" },
              { id: "alocacoes",  label: "👥 ALOCAÇÕES",         color: "#10b981" },
            ].map(sub => {
              const active = termosSubTab === sub.id;
              return (
                <button key={sub.id} type="button" onClick={() => setTermosSubTab(sub.id)}
                  style={{
                    padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    letterSpacing: "0.05em", cursor: "pointer", transition: "all 0.15s",
                    border: active ? `1.5px solid ${sub.color}` : "1.5px solid var(--gray-5)",
                    background: active ? `${sub.color}22` : "var(--gray-2)",
                    color: active ? sub.color : "var(--gray-10)",
                    boxShadow: active ? `0 0 0 2px ${sub.color}33` : "none",
                  }}>
                  {sub.label}
                </button>
              );
            })}
          </div>

          {/* Sub-tab content */}
          {termosSubTab === "gerenciar"  && <FinanceiroTermos />}
          {termosSubTab === "demanda"    && <FinanceiroHorasEvolutivos escopoFilter="DEMANDA" colOrder={["status","resolution","avanco","dataEncerramento","estimativaTotal","termoFaturamento"]} />}
          {termosSubTab === "fast"       && (() => {
            const now = new Date();
            const pm = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
            const py = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
            const pad = n => String(n).padStart(2, "0");
            const pFirst = `${py}-${pad(pm + 1)}-01`;
            const pLast  = `${py}-${pad(pm + 1)}-${pad(new Date(py, pm + 1, 0).getDate())}`;
            return (
              <FinanceiroHorasEvolutivos
                escopoFilter="DEMANDA FAST"
                hideIssueType={true}
                hideFilters={["dataAtividade"]}
                showContratoFilter={true}
                showStatusFilter={true}
                excludeIssueTypes={["[System] Incidente", "Incidente", "[System] Incident"]}
                defaultFilters={{
                  encerrDe: pFirst,
                  encerrAte: pLast,
                  statusFilter: ["Fechada"],
                  excludeResolutions: ["Cancelado pelo Solicitante"],
                }}
                colOrder={["status","resolution","demandaFast","dataEncerramento","plHrsFast","grupoSolucionador","contrato","termoFaturamento"]}
              />
            );
          })()}
          {termosSubTab === "catalogo"   && <FinanceiroHorasEvolutivos escopoFilter="CATALOGO" hideIssueType={true} colOrder={["status","resolution","dataAtividade","tempoEsforco","reporter","termoFaturamento"]} />}
          {termosSubTab === "alocacoes"  && <FinanceiroAlocacoes />}
        </div>
      )}

      {/* ── CUSTO TAB content ── */}
      {activeTab !== "custo" ? null : <>

      {/* ── HORA TABLE CONTROLS (view mode + export) ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", borderRadius: 7, border: "1px solid var(--gray-6)", overflow: "hidden" }}>
            <button type="button" onClick={() => setViewMode("horas")} style={{ padding: "5px 14px", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", background: viewMode === "horas" ? "var(--indigo-9)" : "var(--gray-2)", color: viewMode === "horas" ? "white" : "var(--gray-10)", transition: "all 0.15s", letterSpacing: "0.04em" }}>Horas</button>
            <button type="button" onClick={() => setViewMode("valor")} style={{ padding: "5px 14px", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", background: viewMode === "valor" ? "var(--green-9)" : "var(--gray-2)", color: viewMode === "valor" ? "white" : "var(--gray-10)", transition: "all 0.15s", letterSpacing: "0.04em" }}>R$</button>
          </div>
          <button type="button" onClick={exportXlsx} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 700, border: "1px solid var(--green-7)", background: "var(--green-3)", color: "var(--green-11)", cursor: "pointer", letterSpacing: "0.04em", transition: "all 0.15s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "var(--green-4)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "var(--green-3)"; }}>
            <Download size={14} />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* ── TABLE (grouped) ── */}
      <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--gray-4)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
          <thead>
            <tr>
              <th style={THL}>MEMBRO</th>
              <th style={THL}>SAP</th>
              <th style={{ ...B, textAlign: "center" }}>STATUS</th>
              <th style={THL}>CÓD. PROJETO</th>
              <th style={THL}>SQUAD</th>
              <th style={THL}>CONTRATO</th>
              <th style={THR}>CSR</th>
              {months.map((mo, i) => (
                <th key={mo.ps} style={{ ...THR, lineHeight: 1.3 }}>
                  <div>{mo.label.toUpperCase()}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: viewMode === "horas" ? "var(--green-11)" : "var(--teal-11)", marginTop: 2 }}>
                    {viewMode === "horas" ? (colTotals.tots[i] > 0 ? `${colTotals.tots[i]}h` : "—") : fmtCurrency(colTotals.totVals[i])}
                  </div>
                </th>
              ))}
              <th style={{ ...THR, color: "var(--indigo-11)", lineHeight: 1.3 }}>
                <div>AÇÕES</div>
                <div style={{ fontSize: 10 }}>&nbsp;</div>
              </th>
              <th style={{ ...THR, color: "var(--indigo-11)", lineHeight: 1.3 }}>
                <div>TOTAL</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: viewMode === "horas" ? "var(--indigo-11)" : "var(--teal-11)", marginTop: 2 }}>
                  {viewMode === "horas" ? `${colTotals.grand}h` : fmtCurrency(colTotals.grandVal)}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8 + months.length + 1} style={{ ...TDL, padding: 32, textAlign: "center", color: "var(--gray-8)" }}>Nenhum membro encontrado.</td></tr>
            )}
            {rows.map((r, i) => {
              const name = getUserLabel(r.user);
              return (
                <tr key={r.id} style={{ background: i % 2 === 0 ? undefined : "var(--gray-1)" }}>
                  <td style={{ ...TDL, maxWidth: 160 }}>
                    <span style={{ fontWeight: 600, color: "var(--gray-12)", display: "block", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }} title={name}>{name}</span>
                  </td>
                  <td style={TDL}>
                    {r.user?.sapId
                      ? <span style={{ fontSize: 11, fontWeight: 700, color: "var(--violet-11)", background: "var(--violet-3)", border: "1px solid var(--violet-7)", borderRadius: 6, padding: "2px 7px", fontFamily: "monospace" }}>{r.user.sapId}</span>
                      : <span style={{ color: "var(--gray-7)", fontSize: 11 }}>—</span>}
                  </td>
                  <td style={{ ...D, textAlign: "center" }}>
                    {r.user?.status
                      ? <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: r.user.status.toLowerCase() === "inativo" ? "var(--gray-3)" : "var(--green-3)", border: `1px solid ${r.user.status.toLowerCase() === "inativo" ? "var(--gray-6)" : "var(--green-7)"}`, color: r.user.status.toLowerCase() === "inativo" ? "var(--gray-9)" : "var(--green-11)", whiteSpace: "nowrap" }}>{r.user.status}</span>
                      : <span style={{ color: "var(--gray-7)", fontSize: 10 }}>—</span>}
                  </td>
                  <td style={TDL}>
                    {r.user?.projectCode
                      ? <span style={{ fontSize: 11, fontWeight: 700, color: "var(--amber-11)", background: "var(--amber-3)", border: "1px solid var(--amber-7)", borderRadius: 6, padding: "2px 7px" }}>{r.user.projectCode}</span>
                      : <span style={{ color: "var(--gray-7)", fontSize: 11 }}>—</span>}
                  </td>
                  <td style={TDL}>
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                      {r.userSquads.length > 0 ? r.userSquads.map((sq) => <span key={sq.id} style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 999, background: "var(--cyan-3)", border: "1px solid var(--cyan-7)", color: "var(--cyan-11)", whiteSpace: "nowrap" }}>{sq.label.toUpperCase()}</span>) : <span style={{ color: "var(--gray-7)", fontSize: 11 }}>—</span>}
                    </div>
                  </td>
                  <td style={TDL}>
                    {r.user?.contract ? <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "var(--gray-3)", border: "1px solid var(--gray-6)", color: "var(--gray-11)" }}>{r.user.contract}</span> : <span style={{ color: "var(--gray-7)", fontSize: 11 }}>—</span>}
                  </td>
                  <td style={TDR}>
                    {r.csrRate > 0 ? <span style={{ fontSize: 11, fontWeight: 600, color: "var(--violet-11)", fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(r.csrRate)}</span> : <span style={{ color: "var(--gray-7)", fontSize: 11 }}>—</span>}
                  </td>
                  {r.monthHours.map((h, mi) => {
                    const val = r.monthValues[mi];
                    const display = viewMode === "horas" ? (h > 0 ? `${h}h` : "—") : (val > 0 ? fmtCurrency(val) : "—");
                    const color = viewMode === "horas" ? (h > 0 ? "var(--green-11)" : "var(--gray-7)") : (val > 0 ? "var(--teal-11)" : "var(--gray-7)");
                    return <td key={mi} style={TDR}><span style={{ fontVariantNumeric: "tabular-nums", color, fontWeight: (h > 0 || val > 0) ? 600 : 400 }}>{display}</span></td>;
                  })}
                  <td style={{ ...TDR }}>
                    <button
                      type="button"
                      title="Ver detalhes do membro"
                      onClick={() => setSelectedUser(r.user)}
                      style={{ padding: "2px 8px", borderRadius: 6, border: "1px solid var(--gray-6)", background: "var(--gray-2)", color: "var(--gray-10)", fontSize: 11, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}
                    >
                      👤
                    </button>
                  </td>
                  <td style={{ ...TDR, background: "var(--indigo-2)" }}>
                    <span style={{ fontWeight: 700, color: "var(--indigo-11)", fontVariantNumeric: "tabular-nums" }}>
                      {viewMode === "horas" ? `${r.total}h` : fmtCurrency(r.totalValue)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </>}
    </div>
  );
}
