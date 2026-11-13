import React, { useEffect, useState, useMemo, useRef } from "react";
import { db } from "../firebase";
import { collection, query, where, onSnapshot, orderBy, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getStatusColor } from "./PlanejamentoCicloHelpers";
import { stripNumericPrefix } from "../utils/stripNumericPrefix";
import { subscribeToSystems } from "../services/settingsService";
import { subscribeToCiclos } from "../services/cicloService";

const ESCOPOS = ["DEMANDA", "DEMANDA FAST", "CATALOGO"];
const ESCOPO_META = {
  "DEMANDA":      { color: "#3b82f6", bg: "rgba(59,130,246,0.2)", short: "DEM" },
  "DEMANDA FAST": { color: "#f59e0b", bg: "rgba(245,158,11,0.2)",  short: "FAST" },
  "CATALOGO":     { color: "#a855f7", bg: "rgba(168,85,247,0.2)",  short: "CAT" },
};

function getEscopoMeta(escopo) {
  if (!escopo) return { color: "#6b7280", bg: "rgba(107,114,128,0.15)", short: "?" };
  const key = String(escopo).trim().toUpperCase().replace(/_/g, " ");
  return ESCOPO_META[key] || { color: "#6b7280", bg: "rgba(107,114,128,0.15)", short: key.slice(0,4) };
}

function AvancoBar({ pctDev, pctTeste, escopo }) {
  const isFast = String(escopo||"").toUpperCase().includes("FAST");
  const dev = pctDev != null ? Math.min(100, Math.max(0, Number(pctDev))) : null;
  const teste = pctTeste != null ? Math.min(100, Math.max(0, Number(pctTeste))) : null;
  if (dev == null && teste == null) return <span style={{ fontSize: 11, color: "var(--gray-7)" }}>—</span>;
  const avg = isFast
    ? Math.round((dev ?? 0) * 10) / 10
    : Math.round(((dev ?? 0) * 0.7 + (teste ?? 0) * 0.3) * 10) / 10;
  const color = avg >= 100 ? "#4ade80" : avg >= 75 ? "#22d3ee" : avg >= 40 ? "#fbbf24" : "#f87171";
  return (
    <div style={{ minWidth: 120 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <div style={{ flex: 1, height: 7, borderRadius: 99, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(100, avg)}%`, borderRadius: 99, background: color, transition: "width 0.3s ease" }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, color, minWidth: 42, textAlign: "right" }}>{avg}%</span>
      </div>
      <div style={{ fontSize: 9, color: "var(--gray-8)", marginTop: 2 }}>
        {isFast ? `${dev ?? "—"}` : `${dev ?? "—"} × 0,7 + ${teste ?? "—"} × 0,3`}
      </div>
    </div>
  );
}

function fmtDate(v) {
  if (!v) return "—";
  const s = String(v).slice(0, 10);
  if (s.length < 10) return v;
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

function TermoPicker({ ticketId, escopo, currentValue, termos }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);
  const isDemanda = String(escopo || "").toUpperCase().replace(/_/g, " ") === "DEMANDA";
  const selected = Array.isArray(currentValue) ? currentValue : (currentValue ? [currentValue] : []);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const MILESTONE_LABELS = ["30%", "60%", "10%"];
  const MILESTONE_COLORS = ["#fb923c", "#38bdf8", "#4ade80"];
  const MAX_TERMOS = isDemanda ? 3 : 1;
  const toggle = async (termoId) => {
    if (saving) return;
    const next = isDemanda
      ? (selected.includes(termoId) ? selected.filter(id => id !== termoId) : selected.length < MAX_TERMOS ? [...selected, termoId] : selected)
      : (selected.includes(termoId) ? [] : [termoId]);
    setSaving(true);
    try {
      await setDoc(doc(db, "tickets_global", ticketId), {
        termoFaturamento: next, termoFaturamentoUpdatedAt: serverTimestamp(),
      }, { merge: true });
    } catch { } finally { setSaving(false); }
    if (!isDemanda) setOpen(false);
  };
  const labels = selected.map(id => {
    const t = termos.find(x => x.id === id);
    if (!t) return id;
    const mes = t.mesReferencia ? (() => { const [y,m] = t.mesReferencia.split("-").map(Number); return new Date(y, m-1, 1).toLocaleString("pt-BR", { month: "short", year: "2-digit" }).replace(".", ""); })() : "";
    const short = (t.contratoNome || t.id || "").split("-").slice(-1)[0].trim() || (t.contratoNome || t.id);
    return mes ? `${mes} · ${short}` : short;
  });
  return (
    <div ref={ref} style={{ position: "relative", minWidth: 140 }}>
      <button type="button" onClick={() => setOpen(v => !v)}
        style={{ width: "100%", padding: "4px 8px", borderRadius: 6, border: `1px solid ${selected.length > 0 ? "var(--indigo-7)" : "var(--gray-6)"}`, background: selected.length > 0 ? "var(--indigo-2)" : "var(--gray-2)", color: selected.length > 0 ? "var(--indigo-11)" : "var(--gray-9)", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4, outline: "none" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "left" }}>
          {selected.length === 0 ? "— Selecionar —"
            : isDemanda && selected.length > 0
              ? selected.map((id, i) => {
                  const tFound = termos.find(x => x.id === id);
                  const mes = tFound?.mesReferencia ? (() => { const [y,m] = tFound.mesReferencia.split("-").map(Number); return new Date(y, m-1, 1).toLocaleString("pt-BR", { month: "short", year: "2-digit" }).replace(".", ""); })() : "";
                  const short = ((tFound?.contratoNome || id || "").split("-").slice(-1)[0].trim() || (tFound?.contratoNome || id));
                  return `${MILESTONE_LABELS[i] || ""}·${mes ? mes + "·" : ""}${short}`;
                }).join(" | ")
              : labels.length === 1 ? labels[0] : `${labels.length} termos`}
        </span>
        <span style={{ fontSize: 9, opacity: 0.6, flexShrink: 0 }}>▼</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "105%", left: 0, zIndex: 300, background: "var(--color-panel-solid)", border: "1px solid var(--gray-5)", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.35)", minWidth: 200, maxHeight: 240, overflowY: "auto" }}>
          <div style={{ padding: "6px 10px", fontSize: 9, fontWeight: 700, color: "var(--gray-9)", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid var(--gray-4)" }}>
            {isDemanda ? `Multi-seleção (máx. ${MAX_TERMOS})` : "Seleção única"}
          </div>
          <button type="button" onClick={() => { setDoc(doc(db, "tickets_global", ticketId), { termoFaturamento: [] }, { merge: true }); setOpen(false); }}
            style={{ width: "100%", padding: "7px 10px", textAlign: "left", fontSize: 11, border: "none", background: "none", cursor: "pointer", color: "var(--gray-9)", borderBottom: "1px solid var(--gray-4)" }}>
            — Nenhum —
          </button>
          {termos.map(t => {
            const isSel = selected.includes(t.id);
            const selIdx = selected.indexOf(t.id);
            const nextSlot = selected.length < MAX_TERMOS ? selected.length : -1;
            const mes = t.mesReferencia ? (() => { const [y,m] = t.mesReferencia.split("-").map(Number); return new Date(y, m-1, 1).toLocaleString("pt-BR", { month: "short", year: "2-digit" }).replace(".", ""); })() : "";
            const short = (t.contratoNome || t.id || "").split("-").slice(-1)[0].trim() || (t.contratoNome || t.id);
            const milestoneIdx = isSel ? selIdx : nextSlot;
            const milestonePct = isDemanda && milestoneIdx >= 0 ? MILESTONE_LABELS[milestoneIdx] : null;
            const milestoneColor = isDemanda && milestoneIdx >= 0 ? MILESTONE_COLORS[milestoneIdx] : "var(--indigo-9)";
            const disabled = isDemanda && !isSel && selected.length >= MAX_TERMOS;
            return (
              <button key={t.id} type="button" onClick={() => !disabled && toggle(t.id)}
                style={{ width: "100%", padding: "7px 10px", textAlign: "left", fontSize: 12, border: "none", background: isSel ? "var(--indigo-2)" : "none", cursor: disabled ? "not-allowed" : "pointer", color: disabled ? "var(--gray-7)" : "var(--gray-12)", borderBottom: "1px solid var(--gray-3)", display: "flex", alignItems: "center", gap: 7, opacity: disabled ? 0.5 : 1 }}>
                <span style={{ width: 14, height: 14, borderRadius: isDemanda ? 3 : 999, border: `2px solid ${isSel ? milestoneColor : "var(--gray-6)"}`, background: isSel ? milestoneColor : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {isSel && <span style={{ fontSize: 8, color: "#fff", fontWeight: 900 }}>✓</span>}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    {milestonePct && <span style={{ fontSize: 9, fontWeight: 900, color: milestoneColor, padding: "1px 5px", borderRadius: 4, background: `${milestoneColor}18`, border: `1px solid ${milestoneColor}44`, flexShrink: 0 }}>{milestonePct}</span>}
                    {mes && <span style={{ fontSize: 10, fontWeight: 800, color: "var(--indigo-11)" }}>{mes}</span>}
                    <span style={{ fontWeight: 600, fontSize: 11 }}>{short}</span>
                  </div>
                  {t.codigoProjeto && <div style={{ fontSize: 9, color: "var(--gray-9)", marginTop: 1 }}>{t.codigoProjeto}</div>}
                </div>
              </button>
            );
          })}
          {termos.length === 0 && <div style={{ padding: "10px", fontSize: 11, color: "var(--gray-8)" }}>Nenhum termo emitido.</div>}
        </div>
      )}
    </div>
  );
}

// Column definitions for reordering
const STATUS_30PCT = new Set(["Aprovação de Planejamento", "Execução", "Em Execução"]);
const STATUS_60PCT = new Set(["Em Teste", "Em homologação", "Revisão de homologação", "Etapa de KT", "Aguardando Mudança"]);
const STATUS_10PCT = new Set(["Concluída"]);

function getEstTotal(t) {
  const v = t.estimativaTotal != null ? Number(t.estimativaTotal) : (t.estimativaMacroJira != null ? Number(t.estimativaMacroJira) : null);
  return (v != null && Number.isFinite(v)) ? v : null;
}

function getFaturadas(t) {
  const est = getEstTotal(t);
  if (est == null) return null;
  if (STATUS_10PCT.has(t.status)) return Math.round(est * 1.0 * 10) / 10;
  if (STATUS_60PCT.has(t.status)) return Math.round(est * 0.9 * 10) / 10;
  if (STATUS_30PCT.has(t.status)) return Math.round(est * 0.3 * 10) / 10;
  return 0;
}

const COL_DEFS = {
  status:            { header: "STATUS",             align: "left",  maxWidth: 110 },
  squad:             { header: "SQUAD",              align: "left" },
  avanco:            { header: "AVANÇO",             align: "center", maxWidth: 90 },
  demandaFast:       { header: "DM FAST",            align: "center", maxWidth: 80 },
  estimativaTotal:   { header: "EST. TOTAL",         align: "right" },
  fatPct:            { header: "FATURADO (%)",        align: "right", maxWidth: 90 },
  fatFaturadas:      { header: "FATURADAS (H)",       align: "right" },
  fatAFaturar:       { header: "A FATURAR (H)",       align: "right" },
  plHrsFast:         { header: "PL. HRS FAST",       align: "right" },
  tempoEsforco:      { header: "TEMPO ESFORÇO (H)",  align: "right" },
  sistemaImpactado:  { header: "SISTEMA",            align: "left" },
  grupoSolucionador: { header: "GRUPO SOLUCIONADOR", align: "left" },
  contrato:          { header: "CONTRATO",           align: "left" },
  reporter:          { header: "RELATOR",            align: "left" },
  termoFaturamento:  { header: "TERMO FATURAMENTO",  align: "left" },
  dataAtividade:     { header: "DATA ATIVIDADE",     align: "left" },
  dataEncerramento:  { header: "DATA ENCERRAMENTO",  align: "left" },
  resolution:        { header: "RESOLUTION",         align: "left",  maxWidth: 110 },
};
const DEFAULT_COL_ORDER = ["status","squad","avanco","estimativaTotal","plHrsFast","tempoEsforco","termoFaturamento","dataAtividade","dataEncerramento","resolution"];

function prevMonthRange() {
  const now = new Date();
  const m = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const pad = n => String(n).padStart(2, "0");
  return {
    first: `${y}-${pad(m + 1)}-01`,
    last:  `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`,
  };
}

export default function FinanceiroHorasEvolutivos({ escopoFilter, hideCols = [], colOrder = null, hideIssueType = false, hideFilters = [], showContratoFilter = false, showStatusFilter = false, showGrupoAprovFilter = false, showCicloFilter = false, compactAvanco = false, excludeIssueTypes = [], defaultFilters = {} } = {}) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [termos, setTermos] = useState([]);
  const [search, setSearch] = useState("");
  const [selEscopo, setSelEscopo] = useState(escopoFilter ? new Set([String(escopoFilter).trim().toUpperCase()]) : new Set());
  const [ativDe, setAtivDe] = useState(() => defaultFilters.ativDe || "");
  const [ativAte, setAtivAte] = useState(() => defaultFilters.ativAte || "");
  const [encerrDe, setEncerrDe] = useState(() => defaultFilters.encerrDe || "");
  const [encerrAte, setEncerrAte] = useState(() => defaultFilters.encerrAte || "");
  const [selResolutions, setSelResolutions] = useState(new Set());
  const [resDropOpen, setResDropOpen] = useState(false);
  const resDropRef = useRef(null);
  const [selStatusFilter, setSelStatusFilter] = useState(() => new Set(defaultFilters.statusFilter || []));
  const [statusDropOpen, setStatusDropOpen] = useState(false);
  const statusDropRef = useRef(null);
  const [termoFilter, setTermoFilter] = useState("");
  const [sistemas, setSistemas] = useState([]);
  const [contratoFilter, setContratoFilter] = useState("");
  const [selGrupoAprov, setSelGrupoAprov] = useState(() => new Set(defaultFilters.grupoAprovFilter || []));
  const [grupoAprovDropOpen, setGrupoAprovDropOpen] = useState(false);
  const grupoAprovDropRef = useRef(null);
  const [ciclos, setCiclos] = useState([]);
  const [selCiclo, setSelCiclo] = useState(new Set());
  const [cicloDropOpen, setCicloDropOpen] = useState(false);
  const cicloDropRef = useRef(null);
  const [faturamentoFilter, setFaturamentoFilter] = useState(""); // "" | "faturadas" | "afaturar"
  const [showLegend, setShowLegend] = useState(false);
  const legendRef = useRef(null);
  // Track if resolution has been initialized from defaultFilters
  const resInitialized = useRef(false);

  useEffect(() => {
    if (!showLegend) return;
    const h = (e) => { if (legendRef.current && !legendRef.current.contains(e.target)) setShowLegend(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showLegend]);

  useEffect(() => {
    if (!resDropOpen) return;
    const h = (e) => { if (resDropRef.current && !resDropRef.current.contains(e.target)) setResDropOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [resDropOpen]);

  useEffect(() => {
    if (!statusDropOpen) return;
    const h = (e) => { if (statusDropRef.current && !statusDropRef.current.contains(e.target)) setStatusDropOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [statusDropOpen]);

  useEffect(() => {
    if (!grupoAprovDropOpen) return;
    const h = (e) => { if (grupoAprovDropRef.current && !grupoAprovDropRef.current.contains(e.target)) setGrupoAprovDropOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [grupoAprovDropOpen]);

  useEffect(() => {
    if (!cicloDropOpen) return;
    const h = (e) => { if (cicloDropRef.current && !cicloDropRef.current.contains(e.target)) setCicloDropOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [cicloDropOpen]);

  useEffect(() => {
    if (!showCicloFilter) return;
    return subscribeToCiclos(d => setCiclos(d || []));
  }, [showCicloFilter]);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "tickets_global"), where("escopo", "in", ESCOPOS), orderBy("issueKey", "asc"));
    const unsub = onSnapshot(q, (snap) => { setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); }, () => setLoading(false));
    return unsub;
  }, []);

  useEffect(() => {
    // No orderBy to avoid excluding docs without createdAt field
    return onSnapshot(collection(db, "financeiro_emissao_termos"), snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      all.sort((a, b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return tb - ta;
      });
      setTermos(all);
    }, () => {});
  }, []);

  useEffect(() => {
    const needsSistemas = showContratoFilter || (colOrder || []).includes("contrato");
    if (!needsSistemas) return;
    return subscribeToSystems(d => setSistemas(d || []));
  }, [showContratoFilter, (colOrder || []).join(",")]);

  const resolutionOptions = useMemo(() => {
    const s = new Set();
    tickets.forEach(t => { if (t.resolution) s.add(t.resolution); });
    return [...s].sort();
  }, [tickets]);

  // Auto-initialize selResolutions: select all EXCEPT excludeResolutions, once tickets load
  useEffect(() => {
    if (resInitialized.current) return;
    if (!defaultFilters.excludeResolutions?.length) return;
    if (resolutionOptions.length === 0) return;
    const excluded = new Set(defaultFilters.excludeResolutions.map(s => String(s).trim().toLowerCase()));
    const initial = new Set(resolutionOptions.filter(r => !excluded.has(String(r).trim().toLowerCase())));
    if (initial.size > 0) {
      setSelResolutions(initial);
      resInitialized.current = true;
    }
  }, [resolutionOptions]);

  const statusFilterOptions = useMemo(() => {
    const s = new Set();
    tickets.forEach(t => { if (t.status) s.add(t.status); });
    return [...s].sort();
  }, [tickets]);

  const filtered = useMemo(() => {
    let list = tickets;
    if (selEscopo.size > 0) { list = list.filter(t => { const key = String(t.escopo || "").trim().toUpperCase().replace(/_/g, " "); return selEscopo.has(key); }); }
    if (search.trim()) { const q = search.trim().toLowerCase(); list = list.filter(t => (t.issueKey || "").toLowerCase().includes(q) || (t.summary || "").toLowerCase().includes(q)); }
    if (ativDe) list = list.filter(t => t.dataAtividade && t.dataAtividade.slice(0,10) >= ativDe);
    if (ativAte) list = list.filter(t => t.dataAtividade && t.dataAtividade.slice(0,10) <= ativAte);
    if (encerrDe) list = list.filter(t => { const v = t.dataEncerramento || t.resolvedAt; return v && v.slice(0,10) >= encerrDe; });
    if (encerrAte) list = list.filter(t => { const v = t.dataEncerramento || t.resolvedAt; return v && v.slice(0,10) <= encerrAte; });
    if (selResolutions.size > 0) list = list.filter(t => selResolutions.has(t.resolution || ""));
    if (excludeIssueTypes.length > 0) {
      const excluded = new Set(excludeIssueTypes.map(s => String(s).trim().toLowerCase()));
      list = list.filter(t => !excluded.has(String(t.issueType || "").trim().toLowerCase()));
    }
    if (selGrupoAprov.size > 0) list = list.filter(t => selGrupoAprov.has(t.grupoAprovadorHoras || ""));
    if (selStatusFilter.size > 0) list = list.filter(t => selStatusFilter.has(t.status || ""));
    if (faturamentoFilter === "faturadas") {
      list = list.filter(t => { const f = getFaturadas(t); return f != null && f > 0; });
    } else if (faturamentoFilter === "afaturar") {
      list = list.filter(t => { const est = getEstTotal(t); const fat = getFaturadas(t); return est != null && fat != null && est - fat > 0; });
    }
    if (selCiclo.size > 0) {
      const cicloKeysMap = new Map();
      ciclos.forEach(c => { if (c.nome) cicloKeysMap.set(c.nome, new Set((c.ticketKeys || []).map(k => String(k).trim().toUpperCase()))); });
      const allCicloKeys = new Set();
      ciclos.forEach(c => (c.ticketKeys || []).forEach(k => allCicloKeys.add(String(k).trim().toUpperCase())));
      list = list.filter(t => {
        const key = String(t.issueKey || t.id || "").trim().toUpperCase();
        if (selCiclo.has("__SEM_CICLO__") && !allCicloKeys.has(key)) return true;
        return [...selCiclo].filter(n => n !== "__SEM_CICLO__").some(nome => {
          const ks = cicloKeysMap.get(nome);
          return ks && ks.has(key);
        });
      });
    }
    if (termoFilter) {
      list = list.filter(t => {
        const tf = t.termoFaturamento;
        if (!tf) return false;
        if (Array.isArray(tf)) return tf.includes(termoFilter);
        return tf === termoFilter;
      });
    }
    if (contratoFilter) {
      list = list.filter(t => {
        const grp = t.grupoSolucionador || t.grupoSuporte || "";
        const sys = sistemas.find(s => s.grupoSuporte === grp);
        return (sys?.contratoNome || "") === contratoFilter;
      });
    }
    return list;
  }, [tickets, selEscopo, search, ativDe, ativAte, encerrDe, encerrAte, selResolutions, selGrupoAprov, selStatusFilter, faturamentoFilter, selCiclo, ciclos, termoFilter, contratoFilter, sistemas]);

  // Compute visible columns in order
  const visibleCols = useMemo(() => {
    const order = colOrder || DEFAULT_COL_ORDER;
    return order.filter(id => !hideCols.includes(id));
  }, [colOrder, hideCols]);

  const B = { padding: "6px 10px", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "var(--gray-9)", borderBottom: "2px solid var(--gray-4)", whiteSpace: "nowrap", background: "var(--gray-2)", position: "sticky", top: 0, zIndex: 2, textAlign: "left" };
  const D = { padding: "8px 10px", fontSize: 12, borderBottom: "1px solid var(--gray-3)", whiteSpace: "nowrap", verticalAlign: "middle" };

  if (loading) return (<div style={{ padding: "48px 0", textAlign: "center", color: "var(--gray-7)" }}><div className="spinner" style={{ margin: "0 auto 12px" }} />Carregando tickets evolutivos…</div>);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "var(--gray-2)", borderRadius: 8, padding: "10px 14px", border: "1px solid var(--gray-5)" }}>
        {/* Search */}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Buscar por chave ou título…" style={{ flex: 1, minWidth: 220, padding: "5px 10px", borderRadius: 6, border: "1px solid var(--gray-6)", background: "var(--gray-1)", color: "var(--gray-12)", fontSize: 12, outline: "none" }} />
        {/* Termo filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--gray-9)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>Termo</span>
          <select value={termoFilter} onChange={e => setTermoFilter(e.target.value)}
            style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${termoFilter ? "var(--indigo-6)" : "var(--gray-6)"}`, background: termoFilter ? "var(--indigo-2)" : "var(--gray-1)", color: termoFilter ? "var(--indigo-11)" : "var(--gray-12)", fontSize: 11, cursor: "pointer", outline: "none", maxWidth: 160 }}>
            <option value="">— Todos —</option>
            {termos.map(t => {
              const mes = t.mesReferencia ? (() => { const [y,m] = t.mesReferencia.split("-").map(Number); return new Date(y, m-1, 1).toLocaleString("pt-BR", { month: "short", year: "2-digit" }).replace(".", ""); })() : "";
              const short = (t.contratoNome || t.id || "").split("-").slice(-1)[0].trim() || (t.contratoNome || t.id);
              return <option key={t.id} value={t.id}>{mes ? `${mes} · ${short}` : short}</option>;
            })}
          </select>
          {termoFilter && <button type="button" onClick={() => setTermoFilter("")} style={{ fontSize: 10, color: "var(--red-10)", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>✕</button>}
        </div>
        <div style={{ width: 1, height: 20, background: "var(--gray-5)", flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: "var(--gray-9)", flexShrink: 0, marginLeft: "auto" }}>{filtered.length} ticket{filtered.length !== 1 ? "s" : ""}</span>
        <div style={{ width: 1, height: 20, background: "var(--gray-5)", flexShrink: 0 }} />
        {!hideFilters.includes("dataAtividade") && <>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--gray-9)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>Data Atividade</span>
          <input type="date" value={ativDe} onChange={e => setAtivDe(e.target.value)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--gray-6)", background: "var(--gray-1)", color: "var(--gray-12)", fontSize: 12, cursor: "pointer", outline: "none" }} />
          <span style={{ fontSize: 11, color: "var(--gray-8)" }}>→</span>
          <input type="date" value={ativAte} onChange={e => setAtivAte(e.target.value)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--gray-6)", background: "var(--gray-1)", color: "var(--gray-12)", fontSize: 12, cursor: "pointer", outline: "none" }} />
          {(ativDe || ativAte) && <button type="button" onClick={() => { setAtivDe(""); setAtivAte(""); }} style={{ fontSize: 10, color: "var(--red-10)", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>✕</button>}
        </div>
        <div style={{ width: 1, height: 20, background: "var(--gray-5)", flexShrink: 0 }} />
        </>}
        {!hideFilters.includes("dataEncerramento") && <>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--gray-9)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>Data Encerramento</span>
          <input type="date" value={encerrDe} onChange={e => setEncerrDe(e.target.value)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--gray-6)", background: "var(--gray-1)", color: "var(--gray-12)", fontSize: 12, cursor: "pointer", outline: "none" }} />
          <span style={{ fontSize: 11, color: "var(--gray-8)" }}>→</span>
          <input type="date" value={encerrAte} onChange={e => setEncerrAte(e.target.value)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--gray-6)", background: "var(--gray-1)", color: "var(--gray-12)", fontSize: 12, cursor: "pointer", outline: "none" }} />
          {(encerrDe || encerrAte) && <button type="button" onClick={() => { setEncerrDe(""); setEncerrAte(""); }} style={{ fontSize: 10, color: "var(--red-10)", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>✕</button>}
        </div>
        <div style={{ width: 1, height: 20, background: "var(--gray-5)", flexShrink: 0 }} />
        </>}
        {!hideFilters.includes("resolution") && <div ref={resDropRef} style={{ display: "flex", alignItems: "center", gap: 6, position: "relative", flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--gray-9)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>Resolution</span>
          <button type="button" onClick={() => setResDropOpen(v => !v)}
            style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${selResolutions.size > 0 ? "var(--indigo-7)" : "var(--gray-6)"}`, background: selResolutions.size > 0 ? "var(--indigo-2)" : "var(--gray-1)", color: selResolutions.size > 0 ? "var(--indigo-11)" : "var(--gray-12)", fontSize: 12, cursor: "pointer", outline: "none", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
            <span style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>
              {selResolutions.size === 0 ? "— Todos —" : selResolutions.size === 1 ? [...selResolutions][0] : `${selResolutions.size} selecionados`}
            </span>
            <span style={{ fontSize: 9, opacity: 0.6, flexShrink: 0 }}>▼</span>
          </button>
          {resDropOpen && (
            <div style={{ position: "fixed", zIndex: 9000, background: "var(--color-panel-solid)", border: "1px solid var(--gray-5)", borderRadius: 8, boxShadow: "0 8px 32px rgba(0,0,0,.45)", minWidth: 240, maxHeight: 320, overflowY: "auto", marginTop: 4 }}
              ref={el => { if (el && resDropRef.current) { const r = resDropRef.current.getBoundingClientRect(); el.style.top = (r.bottom + 4) + "px"; el.style.left = Math.max(8, r.right - 240) + "px"; } }}>
              <div style={{ padding: "8px 12px", fontSize: 10, fontWeight: 700, color: "var(--gray-9)", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid var(--gray-4)", background: "var(--gray-3)" }}>Resolution — multi-seleção</div>
              <button type="button" onClick={() => { setSelResolutions(new Set()); setResDropOpen(false); }}
                style={{ width: "100%", padding: "8px 12px", textAlign: "left", fontSize: 12, border: "none", background: selResolutions.size === 0 ? "var(--indigo-2)" : "none", cursor: "pointer", color: "var(--gray-12)", borderBottom: "1px solid var(--gray-4)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 15, height: 15, borderRadius: 3, border: `2px solid ${selResolutions.size === 0 ? "var(--indigo-9)" : "var(--gray-6)"}`, background: selResolutions.size === 0 ? "var(--indigo-9)" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {selResolutions.size === 0 && <span style={{ fontSize: 9, color: "#fff", fontWeight: 900 }}>✓</span>}
                </span>
                — Todos —
              </button>
              {resolutionOptions.map(r => {
                const on = selResolutions.has(r);
                return (
                  <button key={r} type="button" onClick={() => setSelResolutions(p => { const n = new Set(p); on ? n.delete(r) : n.add(r); return n; })}
                    style={{ width: "100%", padding: "8px 12px", textAlign: "left", fontSize: 12, border: "none", background: on ? "var(--indigo-2)" : "none", cursor: "pointer", color: "var(--gray-12)", borderBottom: "1px solid var(--gray-3)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 15, height: 15, borderRadius: 3, border: `2px solid ${on ? "var(--indigo-9)" : "var(--gray-6)"}`, background: on ? "var(--indigo-9)" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {on && <span style={{ fontSize: 9, color: "#fff", fontWeight: 900 }}>✓</span>}
                    </span>
                    {r}
                  </button>
                );
              })}
            </div>
          )}
          {selResolutions.size > 0 && <button type="button" onClick={() => setSelResolutions(new Set())} style={{ fontSize: 10, color: "var(--red-10)", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>✕</button>}
        </div>}
        {showStatusFilter && statusFilterOptions.length > 0 && (
          <>
            <div style={{ width: 1, height: 20, background: "var(--gray-5)", flexShrink: 0 }} />
            <div ref={statusDropRef} style={{ display: "flex", alignItems: "center", gap: 6, position: "relative", flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--gray-9)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>Status</span>
              <button type="button" onClick={() => setStatusDropOpen(v => !v)}
                style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${selStatusFilter.size > 0 ? "var(--amber-7)" : "var(--gray-6)"}`, background: selStatusFilter.size > 0 ? "var(--amber-2)" : "var(--gray-1)", color: selStatusFilter.size > 0 ? "var(--amber-11)" : "var(--gray-12)", fontSize: 12, cursor: "pointer", outline: "none", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                <span style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {selStatusFilter.size === 0 ? "— Todos —" : selStatusFilter.size === 1 ? [...selStatusFilter][0] : `${selStatusFilter.size} selecionados`}
                </span>
                <span style={{ fontSize: 9, opacity: 0.6, flexShrink: 0 }}>▼</span>
              </button>
              {statusDropOpen && (
                <div style={{ position: "fixed", zIndex: 9000, background: "var(--color-panel-solid)", border: "1px solid var(--gray-5)", borderRadius: 8, boxShadow: "0 8px 32px rgba(0,0,0,.45)", minWidth: 260, maxHeight: 320, overflowY: "auto", marginTop: 4 }}
                  ref={el => { if (el && statusDropRef.current) { const r = statusDropRef.current.getBoundingClientRect(); el.style.top = (r.bottom + 4) + "px"; el.style.left = Math.max(8, r.right - 260) + "px"; } }}>
                  <div style={{ padding: "8px 12px", fontSize: 10, fontWeight: 700, color: "var(--gray-9)", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid var(--gray-4)", background: "var(--gray-3)" }}>Status — multi-seleção</div>
                  <button type="button" onClick={() => { setSelStatusFilter(new Set()); setStatusDropOpen(false); }}
                    style={{ width: "100%", padding: "8px 12px", textAlign: "left", fontSize: 12, border: "none", background: selStatusFilter.size === 0 ? "var(--amber-2)" : "none", cursor: "pointer", color: "var(--gray-12)", borderBottom: "1px solid var(--gray-4)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 15, height: 15, borderRadius: 3, border: `2px solid ${selStatusFilter.size === 0 ? "var(--amber-9)" : "var(--gray-6)"}`, background: selStatusFilter.size === 0 ? "var(--amber-9)" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {selStatusFilter.size === 0 && <span style={{ fontSize: 9, color: "#fff", fontWeight: 900 }}>✓</span>}
                    </span>
                    — Todos —
                  </button>
                  {statusFilterOptions.map(s => {
                    const on = selStatusFilter.has(s);
                    return (
                      <button key={s} type="button" onClick={() => setSelStatusFilter(p => { const n = new Set(p); on ? n.delete(s) : n.add(s); return n; })}
                        style={{ width: "100%", padding: "8px 12px", textAlign: "left", fontSize: 12, border: "none", background: on ? "var(--amber-2)" : "none", cursor: "pointer", color: "var(--gray-12)", borderBottom: "1px solid var(--gray-3)", display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 15, height: 15, borderRadius: 3, border: `2px solid ${on ? "var(--amber-9)" : "var(--gray-6)"}`, background: on ? "var(--amber-9)" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {on && <span style={{ fontSize: 9, color: "#fff", fontWeight: 900 }}>✓</span>}
                        </span>
                        {s}
                      </button>
                    );
                  })}
                </div>
              )}
              {selStatusFilter.size > 0 && <button type="button" onClick={() => setSelStatusFilter(new Set())} style={{ fontSize: 10, color: "var(--red-10)", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>✕</button>}
            </div>
          </>
        )}
        {showGrupoAprovFilter && (
          <>
            <div style={{ width: 1, height: 20, background: "var(--gray-5)", flexShrink: 0 }} />
            <div ref={grupoAprovDropRef} style={{ display: "flex", alignItems: "center", gap: 6, position: "relative", flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--gray-9)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>Grupo Aprov.</span>
              <button type="button" onClick={() => setGrupoAprovDropOpen(v => !v)}
                style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${selGrupoAprov.size > 0 ? "var(--violet-7)" : "var(--gray-6)"}`, background: selGrupoAprov.size > 0 ? "var(--violet-2)" : "var(--gray-1)", color: selGrupoAprov.size > 0 ? "var(--violet-11)" : "var(--gray-12)", fontSize: 12, cursor: "pointer", outline: "none", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                <span style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {selGrupoAprov.size === 0 ? "— Todos —" : selGrupoAprov.size === 1 ? [...selGrupoAprov][0].replace("Aprovador Horas - ", "") : `${selGrupoAprov.size} selecionados`}
                </span>
                <span style={{ fontSize: 9, opacity: 0.6, flexShrink: 0 }}>▼</span>
              </button>
              {grupoAprovDropOpen && (
                <div style={{ position: "fixed", zIndex: 9000, background: "var(--color-panel-solid)", border: "1px solid var(--gray-5)", borderRadius: 8, boxShadow: "0 8px 32px rgba(0,0,0,.45)", minWidth: 280, maxHeight: 320, overflowY: "auto", marginTop: 4 }}
                  ref={el => { if (el && grupoAprovDropRef.current) { const r = grupoAprovDropRef.current.getBoundingClientRect(); el.style.top = (r.bottom + 4) + "px"; el.style.left = Math.max(8, r.right - 280) + "px"; } }}>
                  <div style={{ padding: "8px 12px", fontSize: 10, fontWeight: 700, color: "var(--gray-9)", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid var(--gray-4)", background: "var(--gray-3)" }}>Grupo Aprovador Horas</div>
                  <button type="button" onClick={() => { setSelGrupoAprov(new Set()); setGrupoAprovDropOpen(false); }}
                    style={{ width: "100%", padding: "8px 12px", textAlign: "left", fontSize: 12, border: "none", background: selGrupoAprov.size === 0 ? "var(--violet-2)" : "none", cursor: "pointer", color: "var(--gray-12)", borderBottom: "1px solid var(--gray-4)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 15, height: 15, borderRadius: 3, border: `2px solid ${selGrupoAprov.size === 0 ? "var(--violet-9)" : "var(--gray-6)"}`, background: selGrupoAprov.size === 0 ? "var(--violet-9)" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {selGrupoAprov.size === 0 && <span style={{ fontSize: 9, color: "#fff", fontWeight: 900 }}>✓</span>}
                    </span>
                    — Todos —
                  </button>
                  {(defaultFilters.grupoAprovFilter?.length ? defaultFilters.grupoAprovFilter : [...selGrupoAprov]).map(g => {
                    const on = selGrupoAprov.has(g);
                    return (
                      <button key={g} type="button" onClick={() => setSelGrupoAprov(p => { const n = new Set(p); on ? n.delete(g) : n.add(g); return n; })}
                        style={{ width: "100%", padding: "8px 12px", textAlign: "left", fontSize: 12, border: "none", background: on ? "var(--violet-2)" : "none", cursor: "pointer", color: "var(--gray-12)", borderBottom: "1px solid var(--gray-3)", display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 15, height: 15, borderRadius: 3, border: `2px solid ${on ? "var(--violet-9)" : "var(--gray-6)"}`, background: on ? "var(--violet-9)" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {on && <span style={{ fontSize: 9, color: "#fff", fontWeight: 900 }}>✓</span>}
                        </span>
                        {g}
                      </button>
                    );
                  })}
                </div>
              )}
              {selGrupoAprov.size > 0 && <button type="button" onClick={() => setSelGrupoAprov(new Set())} style={{ fontSize: 10, color: "var(--red-10)", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>✕</button>}
            </div>
          </>
        )}
        {(visibleCols.includes("fatFaturadas") || visibleCols.includes("fatAFaturar")) && (
          <>
            <div style={{ width: 1, height: 20, background: "var(--gray-5)", flexShrink: 0 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--gray-9)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>Faturamento</span>
              {[{ val: "", label: "Todos" }, { val: "faturadas", label: "Faturadas" }, { val: "afaturar", label: "A Faturar" }].map(opt => (
                <button key={opt.val} type="button" onClick={() => setFaturamentoFilter(opt.val)}
                  style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: "pointer", border: `1px solid ${faturamentoFilter === opt.val ? "var(--violet-7)" : "var(--gray-6)"}`, background: faturamentoFilter === opt.val ? "var(--violet-2)" : "transparent", color: faturamentoFilter === opt.val ? "var(--violet-11)" : "var(--gray-11)", whiteSpace: "nowrap" }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
        {showCicloFilter && ciclos.length > 0 && (
          <>
            <div style={{ width: 1, height: 20, background: "var(--gray-5)", flexShrink: 0 }} />
            <div ref={cicloDropRef} style={{ display: "flex", alignItems: "center", gap: 6, position: "relative", flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--gray-9)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>Ciclo</span>
              <button type="button" onClick={() => setCicloDropOpen(v => !v)}
                style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${selCiclo.size > 0 ? "var(--cyan-7)" : "var(--gray-6)"}`, background: selCiclo.size > 0 ? "var(--cyan-2)" : "var(--gray-1)", color: selCiclo.size > 0 ? "var(--cyan-11)" : "var(--gray-12)", fontSize: 12, cursor: "pointer", outline: "none", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                <span style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {selCiclo.size === 0 ? "— Todos —" : `${selCiclo.size} selecionados`}
                </span>
                <span style={{ fontSize: 9, opacity: 0.6, flexShrink: 0 }}>▼</span>
              </button>
              {cicloDropOpen && (
                <div style={{ position: "fixed", zIndex: 9000, background: "var(--color-panel-solid)", border: "1px solid var(--gray-5)", borderRadius: 8, boxShadow: "0 8px 32px rgba(0,0,0,.45)", minWidth: 260, maxHeight: 320, overflowY: "auto", marginTop: 4 }}
                  ref={el => { if (el && cicloDropRef.current) { const r = cicloDropRef.current.getBoundingClientRect(); el.style.top = (r.bottom + 4) + "px"; el.style.left = Math.max(8, r.right - 260) + "px"; } }}>
                  <div style={{ padding: "8px 12px", fontSize: 10, fontWeight: 700, color: "var(--gray-9)", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid var(--gray-4)", background: "var(--gray-3)" }}>Ciclo — multi-seleção</div>
                  <button type="button" onClick={() => { setSelCiclo(new Set()); setCicloDropOpen(false); }}
                    style={{ width: "100%", padding: "8px 12px", textAlign: "left", fontSize: 12, border: "none", background: selCiclo.size === 0 ? "var(--cyan-2)" : "none", cursor: "pointer", color: "var(--gray-12)", borderBottom: "1px solid var(--gray-4)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 15, height: 15, borderRadius: 3, border: `2px solid ${selCiclo.size === 0 ? "var(--cyan-9)" : "var(--gray-6)"}`, background: selCiclo.size === 0 ? "var(--cyan-9)" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {selCiclo.size === 0 && <span style={{ fontSize: 9, color: "#fff", fontWeight: 900 }}>✓</span>}
                    </span>
                    — Todos —
                  </button>
                  {/* Sem ciclo option */}
                  {(() => { const on = selCiclo.has("__SEM_CICLO__"); return (
                    <button type="button" onClick={() => setSelCiclo(p => { const n = new Set(p); on ? n.delete("__SEM_CICLO__") : n.add("__SEM_CICLO__"); return n; })}
                      style={{ width: "100%", padding: "8px 12px", textAlign: "left", fontSize: 12, border: "none", background: on ? "var(--cyan-2)" : "none", cursor: "pointer", color: on ? "var(--cyan-11)" : "var(--gray-11)", borderBottom: "1px solid var(--gray-4)", display: "flex", alignItems: "center", gap: 8, fontStyle: "italic" }}>
                      <span style={{ width: 15, height: 15, borderRadius: 3, border: `2px solid ${on ? "var(--cyan-9)" : "var(--gray-6)"}`, background: on ? "var(--cyan-9)" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {on && <span style={{ fontSize: 9, color: "#fff", fontWeight: 900 }}>✓</span>}
                      </span>
                      — Sem ciclo —
                    </button>
                  ); })()}
                  {ciclos.map(c => { const on = selCiclo.has(c.nome); return (
                    <button key={c.id} type="button" onClick={() => setSelCiclo(p => { const n = new Set(p); on ? n.delete(c.nome) : n.add(c.nome); return n; })}
                      style={{ width: "100%", padding: "8px 12px", textAlign: "left", fontSize: 12, border: "none", background: on ? "var(--cyan-2)" : "none", cursor: "pointer", color: "var(--gray-12)", borderBottom: "1px solid var(--gray-3)", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 15, height: 15, borderRadius: 3, border: `2px solid ${on ? "var(--cyan-9)" : "var(--gray-6)"}`, background: on ? "var(--cyan-9)" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {on && <span style={{ fontSize: 9, color: "#fff", fontWeight: 900 }}>✓</span>}
                      </span>
                      {c.nome}
                    </button>
                  ); })}
                </div>
              )}
              {selCiclo.size > 0 && <button type="button" onClick={() => setSelCiclo(new Set())} style={{ fontSize: 10, color: "var(--red-10)", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>✕</button>}
            </div>
          </>
        )}
        {showContratoFilter && (() => {
          const contratos = [...new Set(sistemas.map(s => s.contratoNome).filter(Boolean))].sort();
          return contratos.length > 0 ? (
            <>
              <div style={{ width: 1, height: 20, background: "var(--gray-5)", flexShrink: 0 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--gray-9)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>Contrato</span>
                {contratos.map(c => (
                  <button key={c} type="button" onClick={() => setContratoFilter(contratoFilter === c ? "" : c)}
                    style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: "pointer", border: `1px solid ${contratoFilter === c ? "var(--indigo-7)" : "var(--gray-6)"}`, background: contratoFilter === c ? "var(--indigo-2)" : "transparent", color: contratoFilter === c ? "var(--indigo-11)" : "var(--gray-11)", whiteSpace: "nowrap" }}>
                    {c}
                  </button>
                ))}
                {contratoFilter && <button type="button" onClick={() => setContratoFilter("")} style={{ fontSize: 10, color: "var(--red-10)", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>✕</button>}
              </div>
            </>
          ) : null;
        })()}
      </div>

      {(() => {
        const totalEst = filtered.reduce((s, t) => { const v = getEstTotal(t); return s + (v != null ? v : 0); }, 0);
        const showTempoEsforco = visibleCols.includes("tempoEsforco");
        const totalHoras = showTempoEsforco ? filtered.reduce((s, t) => s + (Number(t.tempoEsforcoHoras) || 0), 0) : 0;
        const showFast = visibleCols.includes("plHrsFast");
        const totalFaturadas = filtered.reduce((s, t) => { const f = getFaturadas(t); return s + (f != null ? f : 0); }, 0);
        const totalAFaturar = filtered.reduce((s, t) => { const est = getEstTotal(t); const fat = getFaturadas(t); return s + (est != null && fat != null ? Math.max(0, est - fat) : 0); }, 0);
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 14px", background: "var(--gray-3)", borderRadius: 8, border: "1px solid var(--gray-4)", fontSize: 12, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, color: "var(--gray-12)" }}>{filtered.length} <span style={{ fontWeight: 400, color: "var(--gray-9)" }}>tickets</span></span>
            {/* Legend icon in summary row */}
            {(visibleCols.includes("fatFaturadas") || visibleCols.includes("fatAFaturar")) && (
              <div ref={legendRef} style={{ position: "relative", flexShrink: 0 }}>
                <button type="button" onClick={() => setShowLegend(v => !v)}
                  title="Lógica de cálculo de horas faturadas"
                  style={{ width: 24, height: 24, borderRadius: 999, border: `1px solid ${showLegend ? "var(--indigo-7)" : "var(--gray-5)"}`, background: showLegend ? "var(--indigo-2)" : "transparent", color: showLegend ? "var(--indigo-11)" : "var(--gray-8)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", outline: "none" }}>
                  ℹ️
                </button>
                {showLegend && (
                  <div style={{ position: "fixed", zIndex: 9500, background: "var(--color-panel-solid)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,.45)", padding: "14px 16px", width: 420, maxWidth: "95vw" }}
                    ref={el => { if (el && legendRef.current) { const r = legendRef.current.getBoundingClientRect(); el.style.top = (r.bottom + 6) + "px"; el.style.left = Math.max(8, r.left - 200) + "px"; } }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--indigo-11)", letterSpacing: "0.04em", marginBottom: 10 }}>Lógica de Cálculo — Horas Faturadas (cumulativo)</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {[
                        { pct: "30%", color: "#fb923c", statuses: "Aprovação de Planejamento · Execução · Em Execução" },
                        { pct: "90%", color: "#38bdf8", statuses: "Em Teste · Em homologação · Revisão de homologação · Etapa de KT · Aguardando Mudança" },
                        { pct: "100%", color: "#4ade80", statuses: "Concluída" },
                      ].map(item => (
                        <div key={item.pct} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                          <span style={{ fontSize: 13, fontWeight: 900, color: item.color, flexShrink: 0, minWidth: 42 }}>{item.pct}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--gray-9)", flexShrink: 0 }}>= EST.TOTAL ×</span>
                          <span style={{ fontSize: 10, color: "var(--gray-10)", lineHeight: 1.4 }}>{item.statuses}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--gray-4)", fontSize: 9, color: "var(--gray-8)" }}>
                      Demandas com múltiplos termos: 1º→30% · 2º→60% · 3º→10%
                    </div>
                  </div>
                )}
              </div>
            )}
            {showTempoEsforco && totalHoras > 0 && <><span style={{ width: 1, height: 16, background: "var(--gray-5)", flexShrink: 0 }} /><span style={{ fontWeight: 700, color: "#34d399" }}>{Math.round(totalHoras * 10) / 10}h <span style={{ fontWeight: 400, color: "var(--gray-9)", fontSize: 11 }}>Tempo Esforço</span></span></>}
            {visibleCols.includes("estimativaTotal") && totalEst > 0 && <><span style={{ width: 1, height: 16, background: "var(--gray-5)", flexShrink: 0 }} /><span style={{ fontWeight: 700, color: "var(--gray-11)" }}>{Math.round(totalEst * 10) / 10}h <span style={{ fontWeight: 400, color: "var(--gray-9)", fontSize: 11 }}>Est. Total</span></span></>}
            {visibleCols.includes("fatFaturadas") && totalFaturadas > 0 && <><span style={{ width: 1, height: 16, background: "var(--gray-5)", flexShrink: 0 }} /><span style={{ fontWeight: 700, color: "#a78bfa" }}>{Math.round(totalFaturadas * 10) / 10}h <span style={{ fontWeight: 400, color: "var(--gray-9)", fontSize: 11 }}>Faturadas</span></span></>}
            {visibleCols.includes("fatAFaturar") && totalAFaturar > 0 && <><span style={{ width: 1, height: 16, background: "var(--gray-5)", flexShrink: 0 }} /><span style={{ fontWeight: 700, color: "#fb923c" }}>{Math.round(totalAFaturar * 10) / 10}h <span style={{ fontWeight: 400, color: "var(--gray-9)", fontSize: 11 }}>A Faturar</span></span></>}
            {showFast && (() => {
              const totalFast = filtered.reduce((s, t) => {
                const h = t.planejamentoHorasDemandaFast != null ? Number(t.planejamentoHorasDemandaFast) : (t.tempoEsforcoHoras != null ? Number(t.tempoEsforcoHoras) : 0);
                return s + (Number.isFinite(h) ? h : 0);
              }, 0);
              return <><span style={{ width: 1, height: 16, background: "var(--gray-5)", flexShrink: 0 }} /><span style={{ fontWeight: 700, color: "#fbbf24" }}>{Math.round(totalFast * 10) / 10}h <span style={{ fontWeight: 400, color: "var(--gray-9)", fontSize: 11 }}>Pl. Hrs Fast</span></span></>;
            })()}
          </div>
        );
      })()}

      <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--gray-4)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
          <thead>
            <tr>
              <th style={B}>ESCOPO / TIPO / CHAVE</th>
              <th style={B}>RESUMO</th>
              {visibleCols.map(id => {
                const def = COL_DEFS[id];
                return <th key={id} style={{ ...B, textAlign: def.align, ...(def.maxWidth ? { maxWidth: def.maxWidth, width: def.maxWidth } : {}) }}>{def.header}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={2 + visibleCols.length} style={{ ...D, padding: 32, textAlign: "center", color: "var(--gray-8)" }}>Nenhum ticket encontrado.</td></tr>
            )}
            {filtered.map((t, idx) => {
              const em = getEscopoMeta(t.escopo);
              const sc = getStatusColor(t.status);
              const squad = t.squadPrincipal || stripNumericPrefix(t.grupoSolucionador || t.grupoSuporte || "") || t.squad || "—";
              const isFast = String(t.escopo||"").toUpperCase().includes("FAST");
              return (
                <tr key={t.id} style={{ background: idx % 2 === 0 ? undefined : "var(--gray-1)" }}>
                  <td style={{ ...D, maxWidth: 180 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: em.color, color: "#fff", flexShrink: 0 }}>{em.short}</span>
                      {!hideIssueType && t.issueType && <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: "rgba(107,114,128,0.2)", color: "var(--gray-11)", flexShrink: 0 }}>{t.issueType}</span>}
                      <span style={{ fontSize: 11, fontWeight: 800, color: "var(--indigo-11)", fontFamily: "monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 100 }}>{t.issueKey || t.id}</span>
                    </div>
                  </td>
                  <td style={{ ...D, maxWidth: 180, overflow: "hidden" }}>
                    <span style={{ fontSize: 12, color: "var(--gray-12)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 170 }} title={t.summary}>{t.summary || "—"}</span>
                  </td>
                  {visibleCols.map(id => {
                    switch (id) {
                      case "status": return (
                        <td key={id} style={{ ...D, maxWidth: 110, overflow: "hidden" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: sc + "22", color: sc, border: `1px solid ${sc}55`, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }} title={t.status || ""}>{t.status || "—"}</span>
                        </td>
                      );
                      case "demandaFast": return (
                        <td key={id} style={{ ...D, textAlign: "center", maxWidth: 80 }}>
                          {t.demandaFast && String(t.demandaFast).toLowerCase() === "sim"
                            ? <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.5)", color: "#f59e0b", whiteSpace: "nowrap" }}>Sim</span>
                            : t.demandaFast
                              ? <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "rgba(107,114,128,0.12)", border: "1px solid rgba(107,114,128,0.3)", color: "var(--gray-10)", whiteSpace: "nowrap" }}>{t.demandaFast}</span>
                              : <span style={{ color: "var(--gray-7)", fontSize: 11 }}>—</span>}
                        </td>
                      );
                      case "squad": return (
                        <td key={id} style={D}>
                          {squad !== "—" ? <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.35)", color: "#6ee7b7", whiteSpace: "nowrap" }}>{squad}</span> : <span style={{ color: "var(--gray-7)", fontSize: 11 }}>—</span>}
                        </td>
                      );
                      case "avanco": {
                        const isFastT = String(t.escopo||"").toUpperCase().includes("FAST");
                        const devP = t.percentualConclusao != null ? Math.min(100, Math.max(0, Number(t.percentualConclusao))) : null;
                        const testeP = t.percentualConclusaoTesteInterno != null ? Math.min(100, Math.max(0, Number(t.percentualConclusaoTesteInterno))) : null;
                        const avgP = devP == null && testeP == null ? null
                          : isFastT ? Math.round((devP ?? 0) * 10) / 10
                          : Math.round(((devP ?? 0) * 0.7 + (testeP ?? 0) * 0.3) * 10) / 10;
                        const colP = avgP == null ? "var(--gray-7)" : avgP >= 100 ? "#4ade80" : avgP >= 75 ? "#22d3ee" : avgP >= 40 ? "#fbbf24" : "#f87171";
                        return (
                          <td key={id} style={{ ...D, textAlign: "center" }}>
                            {compactAvanco
                              ? <span style={{ fontSize: 12, fontWeight: 800, color: colP }}>{avgP != null ? `${avgP}%` : "—"}</span>
                              : <AvancoBar pctDev={t.percentualConclusao} pctTeste={t.percentualConclusaoTesteInterno} escopo={t.escopo} />}
                          </td>
                        );
                      }
                      case "fatPct": {
                        const fatV = getFaturadas(t);
                        const estV = getEstTotal(t);
                        const pctV = STATUS_10PCT.has(t.status) ? 100
                          : STATUS_60PCT.has(t.status) ? 90
                          : STATUS_30PCT.has(t.status) ? 30
                          : null;
                        return (
                          <td key={id} style={{ ...D, textAlign: "right", maxWidth: 90 }}>
                            {pctV != null
                              ? <span style={{ fontSize: 12, fontWeight: 800, color: pctV >= 100 ? "#4ade80" : pctV >= 90 ? "#38bdf8" : "#fb923c", fontVariantNumeric: "tabular-nums" }}>{pctV}%</span>
                              : <span style={{ color: "var(--gray-6)", fontSize: 11 }}>—</span>}
                          </td>
                        );
                      }
                      case "sistemaImpactado": {
                        const sis = t.sistemaImpactado || t.sistemasImpactados || t.sistema || "";
                        const sisArr = Array.isArray(sis) ? sis : (sis ? [sis] : []);
                        return (
                          <td key={id} style={{ ...D, maxWidth: 140, overflow: "hidden" }}>
                            {sisArr.length > 0
                              ? <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                                  {sisArr.slice(0,2).map((s, i) => <span key={i} style={{ fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 4, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)", color: "#a5b4fc", whiteSpace: "nowrap" }}>{String(s)}</span>)}
                                  {sisArr.length > 2 && <span style={{ fontSize: 9, color: "var(--gray-8)" }}>+{sisArr.length - 2}</span>}
                                </div>
                              : <span style={{ color: "var(--gray-7)", fontSize: 11 }}>—</span>}
                          </td>
                        );
                      }
                      case "estimativaTotal": return (
                        <td key={id} style={{ ...D, textAlign: "right" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-11)", fontVariantNumeric: "tabular-nums" }}>
                            {t.estimativaTotal != null ? t.estimativaTotal : (t.estimativaMacroJira != null ? t.estimativaMacroJira : "—")}
                          </span>
                        </td>
                      );
                      case "fatFaturadas": {
                        const fat = getFaturadas(t);
                        const isAny = STATUS_30PCT.has(t.status) || STATUS_60PCT.has(t.status) || STATUS_10PCT.has(t.status);
                        const pctLabel = STATUS_10PCT.has(t.status) ? "100%" : STATUS_60PCT.has(t.status) ? "90%" : STATUS_30PCT.has(t.status) ? "30%" : null;
                        return (
                          <td key={id} style={{ ...D, textAlign: "right", background: isAny ? "rgba(167,139,250,0.08)" : undefined }}>
                            {fat != null && fat > 0
                              ? <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
                                  {pctLabel && <span style={{ fontSize: 9, fontWeight: 800, color: "#a78bfa", opacity: 0.75, letterSpacing: "0.04em", flexShrink: 0 }}>{pctLabel}</span>}
                                  <span style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", fontVariantNumeric: "tabular-nums" }}>{fat}</span>
                                </div>
                              : fat === 0 && getEstTotal(t) != null
                                ? <span style={{ fontSize: 11, color: "var(--gray-6)" }}>0</span>
                                : <span style={{ color: "var(--gray-6)", fontSize: 11 }}>—</span>}
                          </td>
                        );
                      }
                      case "fatAFaturar": {
                        const est = getEstTotal(t);
                        const fat = getFaturadas(t);
                        const aFaturar = est != null && fat != null ? Math.round(Math.max(0, est - fat) * 10) / 10 : null;
                        const aFaturarPct = STATUS_10PCT.has(t.status) ? null
                          : STATUS_60PCT.has(t.status) ? "10%"
                          : STATUS_30PCT.has(t.status) ? "70%"
                          : est != null ? "100%" : null;
                        return (
                          <td key={id} style={{ ...D, textAlign: "right", background: aFaturar != null && aFaturar > 0 ? "rgba(251,146,60,0.08)" : undefined }}>
                            {aFaturar != null
                              ? aFaturar > 0
                                ? <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
                                    {aFaturarPct && <span style={{ fontSize: 9, fontWeight: 800, color: "#fb923c", opacity: 0.75, letterSpacing: "0.04em", flexShrink: 0 }}>{aFaturarPct}</span>}
                                    <span style={{ fontSize: 12, fontWeight: 700, color: "#fb923c", fontVariantNumeric: "tabular-nums" }}>{aFaturar}</span>
                                  </div>
                                : <span style={{ fontSize: 11, color: "var(--gray-6)" }}>0</span>
                              : <span style={{ color: "var(--gray-6)", fontSize: 11 }}>—</span>}
                          </td>
                        );
                      }
                      case "plHrsFast": return (
                        <td key={id} style={{ ...D, textAlign: "right" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: isFast ? "#fbbf24" : "var(--gray-9)", fontVariantNumeric: "tabular-nums" }}>
                            {t.planejamentoHorasDemandaFast != null ? t.planejamentoHorasDemandaFast : "—"}
                          </span>
                        </td>
                      );
                      case "tempoEsforco": return (
                        <td key={id} style={{ ...D, textAlign: "right" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: t.tempoEsforcoHoras != null ? "#34d399" : "var(--gray-7)", fontVariantNumeric: "tabular-nums" }}>
                            {t.tempoEsforcoHoras != null ? t.tempoEsforcoHoras : "—"}
                          </span>
                        </td>
                      );
                      case "reporter": return (
                        <td key={id} style={{ ...D, maxWidth: 140, overflow: "hidden" }}>
                          <span style={{ fontSize: 11, color: "var(--gray-11)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 }} title={t.reporter || ""}>
                            {t.reporter || <span style={{ color: "var(--gray-7)" }}>—</span>}
                          </span>
                        </td>
                      );
                      case "grupoSolucionador": return (
                        <td key={id} style={{ ...D, maxWidth: 160, overflow: "hidden" }}>
                          <span style={{ fontSize: 11, color: "var(--gray-11)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }} title={t.grupoSolucionador || t.grupoSuporte || ""}>
                            {t.grupoSolucionador || t.grupoSuporte || <span style={{ color: "var(--gray-7)" }}>—</span>}
                          </span>
                        </td>
                      );
                      case "contrato": return (
                        <td key={id} style={D}>
                          {(() => {
                            const grp = t.grupoSolucionador || t.grupoSuporte || "";
                            const sys = sistemas.find(s => s.grupoSuporte === grp);
                            return sys?.contratoNome
                              ? <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 6, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)", color: "#a5b4fc", whiteSpace: "nowrap" }}>{sys.contratoNome}</span>
                              : <span style={{ color: "var(--gray-7)", fontSize: 11 }}>—</span>;
                          })()}
                        </td>
                      );
                      case "termoFaturamento": return (
                        <td key={id} style={D}>
                          <TermoPicker ticketId={t.id || t.issueKey} escopo={t.escopo} currentValue={t.termoFaturamento} termos={termos} />
                        </td>
                      );
                      case "dataAtividade": return (
                        <td key={id} style={D}>
                          <span style={{ fontSize: 11, color: t.dataAtividade ? "var(--gray-12)" : "var(--gray-7)" }}>{fmtDate(t.dataAtividade)}</span>
                        </td>
                      );
                      case "dataEncerramento": return (
                        <td key={id} style={D}>
                          <span style={{ fontSize: 11, color: (t.dataEncerramento || t.resolvedAt) ? "var(--gray-12)" : "var(--gray-7)" }}>{fmtDate(t.dataEncerramento || t.resolvedAt)}</span>
                        </td>
                      );
                      case "resolution": return (
                        <td key={id} style={{ ...D, maxWidth: 110, overflow: "hidden" }}>
                          {t.resolution
                            ? <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 6, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }} title={t.resolution}>{t.resolution}</span>
                            : <span style={{ color: "var(--gray-7)", fontSize: 11 }}>—</span>}
                        </td>
                      );
                      default: return null;
                    }
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
