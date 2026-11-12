import React, { useEffect, useState, useMemo, useRef } from "react";
import { db } from "../firebase";
import { collection, query, where, onSnapshot, orderBy, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getStatusColor } from "./PlanejamentoCicloHelpers";
import { stripNumericPrefix } from "../utils/stripNumericPrefix";
import { subscribeToSystems } from "../services/settingsService";

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
  const toggle = async (termoId) => {
    if (saving) return;
    const next = isDemanda
      ? (selected.includes(termoId) ? selected.filter(id => id !== termoId) : [...selected, termoId])
      : (selected.includes(termoId) ? [] : [termoId]);
    setSaving(true);
    try {
      await setDoc(doc(db, "tickets_global", ticketId), {
        termoFaturamento: next, termoFaturamentoUpdatedAt: serverTimestamp(),
      }, { merge: true });
    } catch { } finally { setSaving(false); }
    if (!isDemanda) setOpen(false);
  };
  const labels = selected.map(id => { const t = termos.find(x => x.id === id); return t ? (t.contratoNome || t.id) : id; });
  return (
    <div ref={ref} style={{ position: "relative", minWidth: 140 }}>
      <button type="button" onClick={() => setOpen(v => !v)}
        style={{ width: "100%", padding: "4px 8px", borderRadius: 6, border: `1px solid ${selected.length > 0 ? "var(--indigo-7)" : "var(--gray-6)"}`, background: selected.length > 0 ? "var(--indigo-2)" : "var(--gray-2)", color: selected.length > 0 ? "var(--indigo-11)" : "var(--gray-9)", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4, outline: "none" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "left" }}>
          {selected.length === 0 ? "— Selecionar —" : labels.length === 1 ? labels[0] : `${labels.length} termos`}
        </span>
        <span style={{ fontSize: 9, opacity: 0.6, flexShrink: 0 }}>▼</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "105%", left: 0, zIndex: 300, background: "var(--color-panel-solid)", border: "1px solid var(--gray-5)", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.35)", minWidth: 200, maxHeight: 240, overflowY: "auto" }}>
          <div style={{ padding: "6px 10px", fontSize: 9, fontWeight: 700, color: "var(--gray-9)", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid var(--gray-4)" }}>
            {isDemanda ? "Multi-seleção (DEMANDA)" : "Seleção única"}
          </div>
          <button type="button" onClick={() => { setDoc(doc(db, "tickets_global", ticketId), { termoFaturamento: [] }, { merge: true }); setOpen(false); }}
            style={{ width: "100%", padding: "7px 10px", textAlign: "left", fontSize: 11, border: "none", background: "none", cursor: "pointer", color: "var(--gray-9)", borderBottom: "1px solid var(--gray-4)" }}>
            — Nenhum —
          </button>
          {termos.map(t => {
            const isSel = selected.includes(t.id);
            return (
              <button key={t.id} type="button" onClick={() => toggle(t.id)}
                style={{ width: "100%", padding: "7px 10px", textAlign: "left", fontSize: 12, border: "none", background: isSel ? "var(--indigo-2)" : "none", cursor: "pointer", color: "var(--gray-12)", borderBottom: "1px solid var(--gray-3)", display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 14, height: 14, borderRadius: isDemanda ? 3 : 999, border: `2px solid ${isSel ? "var(--indigo-9)" : "var(--gray-6)"}`, background: isSel ? "var(--indigo-9)" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {isSel && <span style={{ fontSize: 8, color: "#fff", fontWeight: 900 }}>✓</span>}
                </span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 11 }}>{t.contratoNome || "—"}</div>
                  <div style={{ fontSize: 9, color: "var(--gray-9)" }}>{t.codigoProjeto ? `${t.codigoProjeto} · ` : ""}{t.mesReferencia ? new Date(t.mesReferencia + "-01").toLocaleString("pt-BR", { month: "short", year: "numeric" }) : ""}</div>
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
const COL_DEFS = {
  status:            { header: "STATUS",             align: "left",  maxWidth: 110 },
  squad:             { header: "SQUAD",              align: "left" },
  avanco:            { header: "AVANÇO",             align: "center" },
  demandaFast:       { header: "DM FAST",            align: "center", maxWidth: 80 },
  estimativaTotal:   { header: "EST. TOTAL",         align: "right" },
  plHrsFast:         { header: "PL. HRS FAST",       align: "right" },
  tempoEsforco:      { header: "TEMPO ESFORÇO (H)",  align: "right" },
  grupoSolucionador: { header: "GRUPO SOLUCIONADOR", align: "left" },
  contrato:          { header: "CONTRATO",           align: "left" },
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

export default function FinanceiroHorasEvolutivos({ escopoFilter, hideCols = [], colOrder = null, hideIssueType = false, hideFilters = [], showContratoFilter = false, showStatusFilter = false, excludeIssueTypes = [], defaultFilters = {} } = {}) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [termos, setTermos] = useState([]);
  const [search, setSearch] = useState("");
  const [selEscopo, setSelEscopo] = useState(escopoFilter ? new Set([String(escopoFilter).trim().toUpperCase()]) : new Set());
  const [ativDe, setAtivDe] = useState("");
  const [ativAte, setAtivAte] = useState("");
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
  // Track if resolution has been initialized from defaultFilters
  const resInitialized = useRef(false);

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
    setLoading(true);
    const q = query(collection(db, "tickets_global"), where("escopo", "in", ESCOPOS), orderBy("issueKey", "asc"));
    const unsub = onSnapshot(q, (snap) => { setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); }, () => setLoading(false));
    return unsub;
  }, []);

  useEffect(() => {
    const q = query(collection(db, "financeiro_emissao_termos"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => setTermos(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
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
    if (selStatusFilter.size > 0) list = list.filter(t => selStatusFilter.has(t.status || ""));
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
  }, [tickets, selEscopo, search, ativDe, ativAte, encerrDe, encerrAte, selResolutions, selStatusFilter, termoFilter, contratoFilter, sistemas]);

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
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Buscar por chave ou título…" style={{ flex: 1, minWidth: 220, padding: "7px 12px", borderRadius: 7, border: "1px solid var(--gray-6)", background: "var(--gray-2)", color: "var(--gray-12)", fontSize: 13, outline: "none" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--gray-9)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>Termo</span>
          <select value={termoFilter} onChange={e => setTermoFilter(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${termoFilter ? "var(--indigo-6)" : "var(--gray-6)"}`, background: termoFilter ? "var(--indigo-2)" : "var(--gray-2)", color: termoFilter ? "var(--indigo-11)" : "var(--gray-12)", fontSize: 12, cursor: "pointer", outline: "none", maxWidth: 200 }}>
            <option value="">— Todos —</option>
            {termos.map(t => <option key={t.id} value={t.id}>{t.contratoNome || t.id}{t.mesReferencia ? ` · ${new Date(t.mesReferencia + "-01").toLocaleString("pt-BR", { month: "short", year: "2-digit" })}` : ""}</option>)}
          </select>
          {termoFilter && <button type="button" onClick={() => setTermoFilter("")} style={{ fontSize: 10, color: "var(--red-10)", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>✕</button>}
        </div>
        {!escopoFilter && (
          <div style={{ display: "flex", gap: 6 }}>
            {ESCOPOS.map(e => {
              const m = getEscopoMeta(e);
              const on = selEscopo.has(e);
              return (
                <button key={e} type="button"
                  onClick={() => { const n = new Set(selEscopo); on ? n.delete(e) : n.add(e); setSelEscopo(n); }}
                  style={{ padding: "5px 12px", borderRadius: 999, border: `1px solid ${on ? m.color : "var(--gray-6)"}`, background: on ? m.bg : "transparent", color: on ? m.color : "var(--gray-11)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  {m.short}
                </button>
              );
            })}
          </div>
        )}
        <span style={{ fontSize: 11, color: "var(--gray-9)", flexShrink: 0 }}>{filtered.length} ticket{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "var(--gray-2)", borderRadius: 8, padding: "10px 14px", border: "1px solid var(--gray-5)" }}>
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
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--gray-9)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>Data Encerramento</span>
          <input type="date" value={encerrDe} onChange={e => setEncerrDe(e.target.value)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--gray-6)", background: "var(--gray-1)", color: "var(--gray-12)", fontSize: 12, cursor: "pointer", outline: "none" }} />
          <span style={{ fontSize: 11, color: "var(--gray-8)" }}>→</span>
          <input type="date" value={encerrAte} onChange={e => setEncerrAte(e.target.value)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--gray-6)", background: "var(--gray-1)", color: "var(--gray-12)", fontSize: 12, cursor: "pointer", outline: "none" }} />
          {(encerrDe || encerrAte) && <button type="button" onClick={() => { setEncerrDe(""); setEncerrAte(""); }} style={{ fontSize: 10, color: "var(--red-10)", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>✕</button>}
        </div>
        <div style={{ width: 1, height: 20, background: "var(--gray-5)", flexShrink: 0 }} />
        <div ref={resDropRef} style={{ display: "flex", alignItems: "center", gap: 6, position: "relative", flexShrink: 0 }}>
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
        </div>
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
                      case "avanco": return (
                        <td key={id} style={{ ...D, textAlign: "center" }}>
                          <AvancoBar pctDev={t.percentualConclusao} pctTeste={t.percentualConclusaoTesteInterno} escopo={t.escopo} />
                        </td>
                      );
                      case "estimativaTotal": return (
                        <td key={id} style={{ ...D, textAlign: "right" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-11)", fontVariantNumeric: "tabular-nums" }}>
                            {t.estimativaTotal != null ? t.estimativaTotal : (t.estimativaMacroJira != null ? t.estimativaMacroJira : "—")}
                          </span>
                        </td>
                      );
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
