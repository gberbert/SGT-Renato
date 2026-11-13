import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { db } from "../firebase";
import {
  doc, onSnapshot, setDoc, getDocs, addDoc, updateDoc, deleteDoc,
  collection, query, orderBy, serverTimestamp, where,
} from "firebase/firestore";
import { Settings, Plus, Trash2, ChevronDown, X, Save, FileText, Pencil, Eye } from "lucide-react";
import { subscribeToUsers } from "../services/settingsService";
import { loadCapacityConfig, DEFAULT_BASE_PARAMS } from "../services/teamCapacityService";

const NATIONAL_FIXED_T = new Set(["01-01","04-21","05-01","09-07","10-12","11-02","11-15","11-20","12-25"]);
function countWDT(year, month) {
  const last = new Date(year, month + 1, 0).getDate();
  let n = 0;
  for (let d = 1; d <= last; d++) {
    const dow = new Date(year, month, d).getDay();
    if (dow === 0 || dow === 6) continue;
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    if (NATIONAL_FIXED_T.has(mm + "-" + dd)) continue;
    n++;
  }
  return n;
}
function r1t(n) { return Math.round((Number(n) || 0) * 10) / 10; }

const EMISSAO_COL = "financeiro_emissao_termos";

/* ── Status definitions ─────────────────────────────────────────── */
const STATUS_LIST = [
  { label: "Criado",                      color: "#4ade80",  bg: "rgba(74,222,128,0.12)",   border: "rgba(74,222,128,0.4)" },
  { label: "Termo enviado",               color: "#38bdf8",  bg: "rgba(56,189,248,0.12)",   border: "rgba(56,189,248,0.4)" },
  { label: "Aprovação Gestor",            color: "#fb923c",  bg: "rgba(251,146,60,0.12)",   border: "rgba(251,146,60,0.4)" },
  { label: "Aprovação Governança",        color: "#fb923c",  bg: "rgba(251,146,60,0.12)",   border: "rgba(251,146,60,0.4)" },
  { label: "Emissão POs",                 color: "#fb923c",  bg: "rgba(251,146,60,0.12)",   border: "rgba(251,146,60,0.4)" },
  { label: "Envio NF-e",                  color: "#38bdf8",  bg: "rgba(56,189,248,0.12)",   border: "rgba(56,189,248,0.4)" },
  { label: "Solicitação Emissão Notas",   color: "#38bdf8",  bg: "rgba(56,189,248,0.12)",   border: "rgba(56,189,248,0.4)" },
  { label: "Aprovações do Gestor",        color: "#38bdf8",  bg: "rgba(56,189,248,0.12)",   border: "rgba(56,189,248,0.4)" },
  { label: "Emissão das Invoices",        color: "#38bdf8",  bg: "rgba(56,189,248,0.12)",   border: "rgba(56,189,248,0.4)" },
];

function getStatusMeta(label) {
  return STATUS_LIST.find(s => s.label === label) || STATUS_LIST[0];
}

function fmtCurrency(v) {
  if (!v && v !== 0) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(v);
}
function numVal(s) { return parseFloat(String(s || "0").replace(",", ".")) || 0; }
function uid() { return Math.random().toString(36).slice(2, 10); }

function fmtMes(ym) {
  if (!ym) return "—";
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("pt-BR", { month: "long", year: "numeric" });
}

function todayYM() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
}

async function loadAllContratos() {
  const projectsSnap = await getDocs(collection(db, "projects"));
  const result = [];
  await Promise.all(projectsSnap.docs.map(async (pd) => {
    const snap = await getDocs(query(collection(db, "projects", pd.id, "contratos"), orderBy("createdAt", "asc"))).catch(() => null);
    if (snap) snap.docs.forEach((cd) => {
      const d = cd.data();
      result.push({ id: cd.id, projectId: pd.id, projectName: pd.data().name || pd.id, nome: d.nome || d.name || d.numero || cd.id });
    });
  }));
  return result.sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
}

async function loadProjectCodes() {
  const codes = new Set();
  // from users
  const usersSnap = await getDocs(collection(db, "users")).catch(() => null);
  usersSnap?.docs.forEach(d => { if (d.data().projectCode) codes.add(d.data().projectCode); });
  // from projects codigosProjeto
  const projectsSnap = await getDocs(collection(db, "projects")).catch(() => null);
  if (projectsSnap) {
    await Promise.all(projectsSnap.docs.map(async (pd) => {
      const snap = await getDocs(collection(db, "projects", pd.id, "codigosProjeto")).catch(() => null);
      snap?.docs.forEach(cd => { const v = cd.data().projeto; if (v) codes.add(v); });
    }));
  }
  return [...codes].sort();
}

/* ── Status Badge ─────────────────────────────────────────────────── */
function StatusBadge({ status, size = 12 }) {
  const sm = getStatusMeta(status || "Criado");
  return (
    <span style={{ display: "inline-flex", alignItems: "center", fontSize: size, fontWeight: 700, padding: "3px 10px", borderRadius: 6, background: sm.bg, border: `1px solid ${sm.border}`, color: sm.color, whiteSpace: "nowrap" }}>
      {status || "Criado"}
    </span>
  );
}

/* ── ContratoPicker ───────────────────────────────────────────────── */
function ContratoPicker({ value, contratos, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = contratos.find((c) => c.id === value);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(v => !v)}
        style={{ width: "100%", padding: "8px 12px", borderRadius: 7, border: "1px solid var(--gray-6)", background: "var(--gray-2)", color: selected ? "var(--gray-12)" : "var(--gray-9)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, outline: "none" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected ? `${selected.nome} · ${selected.projectName}` : "— Selecionar contrato —"}
        </span>
        <ChevronDown size={13} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "105%", left: 0, right: 0, zIndex: 200, background: "var(--color-panel-solid)", border: "1px solid var(--gray-5)", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.4)", maxHeight: 240, overflowY: "auto" }}>
          <button type="button" onClick={() => { onChange("", ""); setOpen(false); }}
            style={{ width: "100%", padding: "8px 12px", textAlign: "left", fontSize: 12, border: "none", background: "none", cursor: "pointer", color: "var(--gray-9)" }}>— Nenhum —</button>
          {contratos.map((c) => (
            <button key={c.id} type="button" onClick={() => { onChange(c.id, c.nome); setOpen(false); }}
              style={{ width: "100%", padding: "8px 12px", textAlign: "left", fontSize: 13, border: "none", background: c.id === value ? "var(--indigo-3)" : "none", cursor: "pointer", color: "var(--gray-12)", borderBottom: "1px solid var(--gray-3)" }}>
              <div style={{ fontWeight: 600 }}>{c.nome}</div>
              <div style={{ fontSize: 11, color: "var(--gray-9)" }}>{c.projectName}</div>
            </button>
          ))}
          {contratos.length === 0 && <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--gray-8)" }}>Nenhum contrato cadastrado.</div>}
        </div>
      )}
    </div>
  );
}

/* ── Criar Termo Modal ─────────────────────────────────────────── */
function CriarTermoModal({ contratos, projectCodes, onSave, onClose }) {
  const [contratoId, setContratoId] = useState("");
  const [contratoNome, setContratoNome] = useState("");
  const [mesReferencia, setMesReferencia] = useState(todayYM());
  const [codigoProjeto, setCodigoProjeto] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!contratoId) { setError("Selecione um contrato."); return; }
    setSaving(true);
    try {
      await onSave({ contratoId, contratoNome, mesReferencia, codigoProjeto, status: "Criado" });
      onClose();
    } catch { setError("Erro ao salvar."); } finally { setSaving(false); }
  };

  const lbl = { fontSize: 11, fontWeight: 700, color: "var(--gray-10)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 };
  const inp = { width: "100%", padding: "8px 12px", borderRadius: 7, border: "1px solid var(--gray-6)", background: "var(--gray-2)", color: "var(--gray-12)", fontSize: 13, outline: "none" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--color-panel-solid)", border: "1px solid var(--gray-6)", borderRadius: 14, padding: "28px 32px", width: "min(96vw, 520px)", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--gray-12)", display: "flex", alignItems: "center", gap: 8 }}>
            <FileText size={16} style={{ color: "var(--indigo-10)" }} /> Criar Termo
          </div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-10)" }}><X size={18} /></button>
        </div>
        <div><label style={lbl}>Contrato *</label>
          <ContratoPicker value={contratoId} contratos={contratos} onChange={(id, nome) => { setContratoId(id); setContratoNome(nome); }} />
        </div>
        <div><label style={lbl}>Mês Referência *</label>
          <input type="month" value={mesReferencia} onChange={e => setMesReferencia(e.target.value)} style={{ ...inp, cursor: "pointer" }} />
        </div>
        <div><label style={lbl}>Código Projeto</label>
          {projectCodes.length > 0 ? (
            <select value={codigoProjeto} onChange={e => setCodigoProjeto(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
              <option value="">— Selecionar —</option>
              {projectCodes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : (
            <input value={codigoProjeto} onChange={e => setCodigoProjeto(e.target.value)} placeholder="Ex: EAPPS-AM-CPFL..." style={inp} />
          )}
        </div>
        {error && <div style={{ fontSize: 12, color: "var(--red-11)", fontWeight: 600 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4, borderTop: "1px solid var(--gray-5)" }}>
          <button type="button" onClick={onClose} style={{ padding: "7px 20px", borderRadius: 7, border: "1px solid var(--gray-6)", background: "var(--gray-3)", color: "var(--gray-11)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          <button type="button" onClick={handleSave} disabled={saving}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 24px", borderRadius: 7, border: "none", background: "var(--indigo-9)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
            <Save size={14} /> {saving ? "Salvando…" : "Criar Termo"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── View/Edit Termo Modal ─────────────────────────────────────── */
function ViewTermoModal({ termo, contratos, projectCodes, config, onSave, onClose }) {
  const [editing, setEditing] = useState(false);
  const [contratoId, setContratoId] = useState(termo.contratoId || "");
  const [contratoNome, setContratoNome] = useState(termo.contratoNome || "");
  const [mesReferencia, setMesReferencia] = useState(termo.mesReferencia || todayYM());
  const [codigoProjeto, setCodigoProjeto] = useState(termo.codigoProjeto || "");
  const [status, setStatus] = useState(termo.status || "Criado");
  const [saving, setSaving] = useState(false);

  // ── Composição do Termo ──
  const [alocacoes, setAlocacoes] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [capacityCfg, setCapacityCfg] = useState(null);
  const [ticketsAll, setTicketsAll] = useState([]);

  useEffect(() => {
    return onSnapshot(query(collection(db, "financeiro_alocacoes")), snap => {
      setAlocacoes(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(a => a.termoId === termo.id));
    }, () => {});
  }, [termo.id]);

  useEffect(() => { return subscribeToUsers(d => setAllUsers(d || [])); }, []);

  useEffect(() => {
    if (!termo.mesReferencia) return;
    const [y, m] = termo.mesReferencia.split("-").map(Number);
    const pad = n => String(n).padStart(2, "0");
    const ps = termo.mesReferencia + "-01";
    const pe = `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`;
    loadCapacityConfig(ps, pe).then(setCapacityCfg).catch(() => setCapacityCfg(null));
  }, [termo.mesReferencia]);

  useEffect(() => {
    const q = query(collection(db, "tickets_global"), where("escopo", "in", ["DEMANDA", "DEMANDA FAST", "CATALOGO"]));
    return onSnapshot(q, snap => setTicketsAll(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
  }, []);

  const inTermo = t => {
    const tf = t.termoFaturamento;
    if (!tf) return false;
    if (Array.isArray(tf)) return tf.includes(termo.id);
    return tf === termo.id;
  };

  const ticketsDemanda = useMemo(() => ticketsAll.filter(t => inTermo(t) && String(t.escopo || "").toUpperCase().trim() === "DEMANDA"), [ticketsAll, termo.id]);
  const ticketsFast    = useMemo(() => ticketsAll.filter(t => inTermo(t) && String(t.escopo || "").toUpperCase().includes("FAST")), [ticketsAll, termo.id]);
  const ticketsCatalogo = useMemo(() => ticketsAll.filter(t => inTermo(t) && String(t.escopo || "").toUpperCase().trim() === "CATALOGO"), [ticketsAll, termo.id]);


  const calcHoras = uid => {
    const [y, m] = (termo.mesReferencia || "2026-01").split("-").map(Number);
    const defAloc = capacityCfg?.baseParams?.alocacao ?? DEFAULT_BASE_PARAMS?.alocacao ?? 100;
    const ov = capacityCfg?.memberOverrides?.[uid] || {};
    const aloc = ov.alocacao !== undefined ? ov.alocacao : defAloc;
    const wd = capacityCfg?.workingDays ?? countWDT(y, m - 1);
    return r1t(wd * 8 * aloc / 100);
  };

  const DEFAULT_ARC_FALLBACK = [
    { nome: "Sustentação Novo GED", valorBase: 16676.51 },
    { nome: "Sustentação Cadeia Reversa (Power Plataform)", valorBase: 700.21 },
    { nome: "Sustentação Hydro 4.0", valorBase: 13226.20 },
    { nome: "Sustentação Reformadora", valorBase: 13226.20 },
    { nome: "Sustentação Procon (Power Plataform)", valorBase: 3450.31 },
    { nome: "Sustentação Interjonada (Power Plataform)", valorBase: 700.21 },
    { nome: "Sustentação TPG (Power Plataform)", valorBase: 3450.31 },
    { nome: "Sustentação GED AI", valorBase: 700.21 },
  ];
  const arcItems  = (config?.tabelaArc?.length ? config.tabelaArc : DEFAULT_ARC_FALLBACK);
  const valorBase = config?.valorHoraBase || 0;

  // Milestone factors per slot: slot 0 = 30%, slot 1 = 60%, slot 2 = 10%
  const MILESTONE_FACTORS = [0.30, 0.60, 0.10];

  const getTicketFullH = t => {
    if (String(t.escopo || "").toUpperCase().includes("FAST")) {
      return t.planejamentoHorasDemandaFast != null ? Number(t.planejamentoHorasDemandaFast) : (t.tempoEsforcoHoras != null ? Number(t.tempoEsforcoHoras) : 0);
    }
    return t.tempoEsforcoHoras != null ? Number(t.tempoEsforcoHoras) : (t.estimativaTotal != null ? Number(t.estimativaTotal) : (t.estimativaMacroJira != null ? Number(t.estimativaMacroJira) : 0));
  };

  const getTicketH = t => {
    const fullH = getTicketFullH(t);
    // For DEMANDA tickets, always apply milestone factor based on slot position
    if (String(t.escopo || "").toUpperCase().trim() === "DEMANDA") {
      const tf = t.termoFaturamento;
      if (Array.isArray(tf) && tf.length >= 1) {
        const slotIdx = tf.indexOf(termo.id);
        if (slotIdx >= 0 && slotIdx < MILESTONE_FACTORS.length) {
          return Math.round(fullH * MILESTONE_FACTORS[slotIdx] * 10) / 10;
        }
      }
    }
    return fullH;
  };

  // ARC editable overrides (per termo) — must come before arcTotal
  const [arcOverride, setArcOverride] = useState(termo.arcOverride || null);
  const arcDisplay = arcOverride || arcItems;
  const updateArcRow = (i, field, val) => {
    const base = arcOverride || arcItems.map(x => ({ ...x }));
    const next = base.map((r, idx) => idx === i ? { ...r, [field]: val } : r);
    setArcOverride(next);
  };

  const arcTotal   = arcDisplay.reduce((s, x) => s + numVal(String(x.valorBase || 0)), 0);
  const alocHrsTotal = r1t(alocacoes.reduce((s, a) => s + calcHoras(a.userId), 0));
  const alocTotal  = alocacoes.reduce((s, a) => { const u = allUsers.find(x => x.id === a.userId); const rc = parseFloat(String(u?.rc || "0").replace(",", ".")) || 0; return s + calcHoras(a.userId) * rc; }, 0);
  const demHrsTotal = r1t(ticketsDemanda.reduce((s, t) => s + getTicketH(t), 0));
  const demTotal   = ticketsDemanda.reduce((s, t) => s + getTicketH(t) * valorBase, 0);
  const fastHrsTotal = r1t(ticketsFast.reduce((s, t) => s + getTicketH(t), 0));
  const fastTotal  = ticketsFast.reduce((s, t) => s + getTicketH(t) * valorBase, 0);
  const catHrsTotal = r1t(ticketsCatalogo.reduce((s, t) => s + getTicketH(t), 0));
  const catTotal   = ticketsCatalogo.reduce((s, t) => s + getTicketH(t) * valorBase, 0);
  const grandTotal = arcTotal + alocTotal + demTotal + fastTotal + catTotal;

  // Persist computed total back to the termo document
  useEffect(() => {
    if (grandTotal > 0) {
      updateDoc(doc(db, EMISSAO_COL, termo.id), { valorTotal: grandTotal }).catch(() => {});
    }
  }, [grandTotal]);

  // Collapsible state — all collapsed by default
  const [collapsed, setCollapsed] = useState({ arc: true, aloc: true, dem: true, fast: true, cat: true });
  const toggle = key => setCollapsed(p => ({ ...p, [key]: !p[key] }));

  const BLK = { borderRadius: 10, border: "1px solid var(--gray-5)", overflow: "hidden", marginTop: 4 };
  const BH  = { background: "var(--gray-3)", padding: "9px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" };
  const BHL = { fontSize: 12, fontWeight: 800, color: "var(--gray-12)", textTransform: "uppercase", letterSpacing: "0.06em" };
  const BHR = { fontSize: 12, fontWeight: 800, color: "var(--indigo-11)" };
  const HRS_W = 100; const VAL_W = 160;
  const TH  = { padding: "6px 10px", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "var(--gray-9)", borderBottom: "1px solid var(--gray-4)", background: "var(--gray-2)", textAlign: "left" };
  const TD  = { padding: "7px 10px", fontSize: 12, borderBottom: "1px solid var(--gray-3)", color: "var(--gray-12)", verticalAlign: "middle" };
  const TDR = { ...TD, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 };

  const currentIdx = STATUS_LIST.findIndex(s => s.label === status);
  const sm = getStatusMeta(status);
  const canPrev = currentIdx > 0;
  const canNext = currentIdx < STATUS_LIST.length - 1;
  const [statusDropOpen, setStatusDropOpen] = useState(false);
  const statusRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (statusRef.current && !statusRef.current.contains(e.target)) setStatusDropOpen(false); };
    if (statusDropOpen) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [statusDropOpen]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(termo.id, {
        contratoId, contratoNome, mesReferencia, codigoProjeto, status,
        ...(arcOverride ? { arcOverride: arcOverride.map(r => ({ nome: r.nome, valorBase: numVal(String(r.valorBase)) })) } : {}),
      });
      onClose();
    }
    catch { } finally { setSaving(false); }
  };

  const lbl = { fontSize: 11, fontWeight: 700, color: "var(--gray-10)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 };
  const inp = { width: "100%", padding: "8px 12px", borderRadius: 7, border: "1px solid var(--gray-6)", background: "var(--gray-2)", color: "var(--gray-12)", fontSize: 13, outline: "none" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--color-panel-solid)", border: "1px solid var(--gray-6)", borderRadius: 14, width: "min(98vw, 1100px)", maxHeight: "96vh", overflowY: "auto", display: "flex", flexDirection: "column" }}>

        {/* ── Header bar (like ticket modal) ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderBottom: "1px solid var(--gray-5)", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--indigo-11)", fontFamily: "monospace" }}>
            {termo.contratoNome || "TERMO"}
          </span>
          {termo.codigoProjeto && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "var(--amber-3)", border: "1px solid var(--amber-7)", color: "var(--amber-11)" }}>
              {termo.codigoProjeto}
            </span>
          )}
          {/* STATUS badge — clickable dropdown */}
          <div ref={statusRef} style={{ position: "relative" }}>
            <button type="button" onClick={() => setStatusDropOpen(v => !v)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 999, background: sm.bg, border: `1px solid ${sm.border}`, color: sm.color, cursor: "pointer", outline: "none" }}>
              {status}
              <ChevronDown size={12} style={{ transform: statusDropOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
            </button>
            {statusDropOpen && (
              <div style={{ position: "absolute", top: "110%", left: 0, zIndex: 300, background: "var(--color-panel-solid)", border: "1px solid var(--gray-5)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.35)", minWidth: 220, overflow: "hidden" }}>
                <div style={{ padding: "8px 12px", fontSize: 10, fontWeight: 700, color: "var(--gray-9)", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid var(--gray-4)" }}>
                  Transição de status
                </div>
                {canPrev && (() => {
                  const prev = STATUS_LIST[currentIdx - 1];
                  const pm = getStatusMeta(prev.label);
                  return (
                    <button type="button" onClick={() => { setStatus(prev.label); setStatusDropOpen(false); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "none", background: "none", cursor: "pointer", textAlign: "left", borderBottom: canNext ? "1px solid var(--gray-4)" : "none" }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--gray-3)"}
                      onMouseLeave={e => e.currentTarget.style.background = "none"}>
                      <span style={{ fontSize: 11, color: "var(--gray-9)", fontWeight: 600, flexShrink: 0 }}>Voltar para</span>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 6, background: pm.bg, border: `1px solid ${pm.border}`, color: pm.color, whiteSpace: "nowrap" }}>
                        {prev.label}
                      </span>
                    </button>
                  );
                })()}
                {canNext && (() => {
                  const next = STATUS_LIST[currentIdx + 1];
                  const nm = getStatusMeta(next.label);
                  return (
                    <button type="button" onClick={() => { setStatus(next.label); setStatusDropOpen(false); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "none", background: "none", cursor: "pointer", textAlign: "left" }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--gray-3)"}
                      onMouseLeave={e => e.currentTarget.style.background = "none"}>
                      <span style={{ fontSize: 11, color: "var(--gray-9)", fontWeight: 600, flexShrink: 0 }}>Avançar para</span>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 6, background: nm.bg, border: `1px solid ${nm.border}`, color: nm.color, whiteSpace: "nowrap" }}>
                        {next.label}
                      </span>
                    </button>
                  );
                })()}
                {!canPrev && !canNext && (
                  <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--gray-8)" }}>Nenhuma transição disponível.</div>
                )}
              </div>
            )}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            {!editing
              ? <button type="button" onClick={() => setEditing(true)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, border: "1px solid var(--indigo-6)", background: "var(--indigo-3)", color: "var(--indigo-11)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  <Pencil size={13} /> Editar
                </button>
              : <>
                  <button type="button" onClick={() => setEditing(false)} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid var(--gray-6)", background: "var(--gray-3)", color: "var(--gray-11)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
                  <button type="button" onClick={handleSave} disabled={saving} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 16px", borderRadius: 6, border: "none", background: "var(--indigo-9)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
                    <Save size={12} /> {saving ? "…" : "Salvar"}
                  </button>
                </>
            }
            <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-10)" }}><X size={18} /></button>
          </div>
        </div>

        <div style={{ padding: "10px 20px", display: "flex", flexDirection: "column", gap: 10 }}>

          {/* Fields — compact inline row */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end", background: "var(--gray-2)", borderRadius: 8, padding: "10px 12px", border: "1px solid var(--gray-4)" }}>
            <div style={{ flex: 3, minWidth: 200 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: "var(--gray-9)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>Contrato</label>
              {editing
                ? <ContratoPicker value={contratoId} contratos={contratos} onChange={(id, nome) => { setContratoId(id); setContratoNome(nome); }} />
                : <span style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-12)" }}>{termo.contratoNome || "—"}</span>}
            </div>
            <div style={{ minWidth: 150 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: "var(--gray-9)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>Mês Referência</label>
              {editing
                ? <input type="month" value={mesReferencia} onChange={e => setMesReferencia(e.target.value)} style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid var(--gray-6)", background: "var(--gray-1)", color: "var(--gray-12)", fontSize: 12, outline: "none", cursor: "pointer" }} />
                : <span style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-12)" }}>{fmtMes(termo.mesReferencia)}</span>}
            </div>
            <div style={{ minWidth: 160 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: "var(--gray-9)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>Código Projeto</label>
              {editing
                ? (projectCodes.length > 0
                    ? <select value={codigoProjeto} onChange={e => setCodigoProjeto(e.target.value)} style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid var(--gray-6)", background: "var(--gray-1)", color: "var(--gray-12)", fontSize: 12, outline: "none", cursor: "pointer" }}>
                        <option value="">— Selecionar —</option>
                        {projectCodes.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    : <input value={codigoProjeto} onChange={e => setCodigoProjeto(e.target.value)} style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid var(--gray-6)", background: "var(--gray-1)", color: "var(--gray-12)", fontSize: 12, outline: "none" }} />)
                : <span style={{ fontSize: 13, fontWeight: 700, color: "var(--amber-11)" }}>{termo.codigoProjeto || "—"}</span>}
            </div>
            {/* Grand Total inline — right side of fields row */}
            <div style={{ marginLeft: "auto", textAlign: "right", flexShrink: 0, borderLeft: "1px solid var(--gray-5)", paddingLeft: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--gray-9)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>💰 Total</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "var(--indigo-11)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtCurrency(grandTotal)}</div>
            </div>
          </div>

          {/* ── Composição do Termo ── */}
          <div style={{ marginTop: 4, borderTop: "2px solid var(--gray-5)", paddingTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--gray-12)", letterSpacing: "0.04em", marginBottom: 14 }}>📋 COMPOSIÇÃO DO TERMO</div>

            {/* Block 1: Tabela ARC */}
            <div style={{ marginBottom: 10 }}>
              <button type="button" onClick={() => toggle("arc")} style={{ width: "100%", border: "none", background: "none", cursor: "pointer", padding: 0, display: "block" }}>
                <div style={{ ...BH, background: "rgba(56,189,248,0.1)" }}>
                  <span style={{ ...BHL, color: "#38bdf8" }}>1 · Tabela ARC — Baseline Demand {collapsed.arc ? "▶" : "▼"}</span>
                  <div style={{ display: "flex" }}><div style={{ width: HRS_W }} /><div style={{ width: VAL_W, textAlign: "right" }}><span style={{ ...BHR, color: "#38bdf8" }}>{fmtCurrency(arcTotal)}</span></div></div>
                </div>
              </button>
              {!collapsed.arc && <div style={BLK}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    <th style={TH}>Sistema</th>
                    <th style={{ ...TH, textAlign: "right" }}>Valor Base (R$)</th>
                  </tr></thead>
                  <tbody>
                    {arcDisplay.map((s, i) => (
                      <tr key={i}>
                        <td style={TD}>
                          {editing
                            ? <input value={s.nome} onChange={e => updateArcRow(i, "nome", e.target.value)} style={{ width: "100%", padding: "4px 7px", borderRadius: 5, border: "1px solid var(--gray-6)", background: "var(--gray-1)", color: "var(--gray-12)", fontSize: 12, outline: "none" }} />
                            : s.nome}
                        </td>
                        <td style={TDR}>
                          {editing
                            ? <input type="number" min={0} step={0.01} value={s.valorBase ?? ""} onChange={e => updateArcRow(i, "valorBase", e.target.value)} style={{ width: 130, padding: "4px 7px", borderRadius: 5, border: "1px solid rgba(56,189,248,0.4)", background: "rgba(56,189,248,0.05)", color: "#38bdf8", fontSize: 12, fontWeight: 700, outline: "none", textAlign: "right" }} />
                            : fmtCurrency(numVal(String(s.valorBase || 0)))}
                        </td>
                      </tr>
                    ))}
                    {arcDisplay.length === 0 && <tr><td colSpan={2} style={{ ...TD, textAlign: "center", color: "var(--gray-7)" }}>Nenhum sistema configurado. Acesse as Configurações de Base.</td></tr>}
                  </tbody>
                </table>
              </div>}
            </div>

            {/* Block 2: Horas Alocações */}
            <div style={{ marginBottom: 10 }}>
              <button type="button" onClick={() => toggle("aloc")} style={{ width: "100%", border: "none", background: "none", cursor: "pointer", padding: 0, display: "block" }}>
                <div style={{ ...BH, background: "rgba(167,139,250,0.1)" }}>
                  <span style={{ ...BHL, color: "#a78bfa" }}>2 · Horas Alocações — Ratecard {collapsed.aloc ? "▶" : "▼"}</span>
                  <div style={{ display: "flex" }}><div style={{ width: HRS_W, textAlign: "right", paddingRight: 8 }}>{alocHrsTotal > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", opacity: 0.75 }}>{alocHrsTotal}h</span>}</div><div style={{ width: VAL_W, textAlign: "right" }}><span style={{ ...BHR, color: "#a78bfa" }}>{fmtCurrency(alocTotal)}</span></div></div>
                </div>
              </button>
              {!collapsed.aloc && <div style={BLK}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    <th style={TH}>Membro</th>
                    <th style={{ ...TH, textAlign: "right" }}>Rate Card (R$/h)</th>
                    <th style={{ ...TH, textAlign: "right" }}>Horas</th>
                    <th style={{ ...TH, textAlign: "right" }}>Valor</th>
                  </tr></thead>
                  <tbody>
                    {alocacoes.map(a => {
                      const u = allUsers.find(x => x.id === a.userId);
                      const rc = parseFloat(String(u?.rc || "0").replace(",", ".")) || 0;
                      const h = calcHoras(a.userId);
                      const v = r1t(h * rc);
                      const name = u ? (u.displayName || u.shortName || u.name || u.id) : a.userId;
                      return (
                        <tr key={a.id}>
                          <td style={TD}>{name}</td>
                          <td style={TDR}>{rc > 0 ? fmtCurrency(rc) : "—"}</td>
                          <td style={TDR}>{h}h</td>
                          <td style={{ ...TDR, color: "#a78bfa" }}>{fmtCurrency(v)}</td>
                        </tr>
                      );
                    })}
                    {alocacoes.length === 0 && <tr><td colSpan={4} style={{ ...TD, textAlign: "center", color: "var(--gray-7)" }}>Nenhum membro alocado neste termo. Configure em ALOCAÇÕES.</td></tr>}
                  </tbody>
                </table>
              </div>}
            </div>

            {/* Blocks 3-5: Demandas, Fast, Catálogo */}
            {[
              { key: "dem", label: "3 · Horas Demandas — Baseline Demand", tickets: ticketsDemanda, total: demTotal, hrsTotal: demHrsTotal, color: "#3b82f6" },
              { key: "fast", label: "4 · Horas Demandas Fast — Baseline Demand", tickets: ticketsFast, total: fastTotal, hrsTotal: fastHrsTotal, color: "#f59e0b" },
              { key: "cat", label: "5 · Horas Catálogo — Apontamento Horas", tickets: ticketsCatalogo, total: catTotal, hrsTotal: catHrsTotal, color: "#a855f7" },
            ].map(({ key, label, tickets, total, hrsTotal, color }) => (
              <div key={key} style={{ marginBottom: 10 }}>
                <button type="button" onClick={() => toggle(key)} style={{ width: "100%", border: "none", background: "none", cursor: "pointer", padding: 0, display: "block" }}>
                  <div style={{ ...BH, background: `${color}10` }}>
                    <span style={{ ...BHL, color }}>{label} {collapsed[key] ? "▶" : "▼"}</span>
                    <div style={{ display: "flex" }}><div style={{ width: HRS_W, textAlign: "right", paddingRight: 8 }}>{hrsTotal > 0 && <span style={{ fontSize: 11, fontWeight: 700, color, opacity: 0.75 }}>{hrsTotal}h</span>}</div><div style={{ width: VAL_W, textAlign: "right" }}><span style={{ ...BHR, color }}>{fmtCurrency(total)}</span></div></div>
                  </div>
                </button>
                {!collapsed[key] && <div style={BLK}>
                  <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                    <colgroup>
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "25%" }} />
                      <col style={{ width: "11%" }} />
                      <col style={{ width: "11%" }} />
                      <col style={{ width: "9%" }} />
                      <col style={{ width: "7%" }} />
                      <col style={{ width: "11%" }} />
                      <col style={{ width: "16%" }} />
                    </colgroup>
                    <thead><tr>
                      <th style={TH}>Chave</th>
                      <th style={TH}>Resumo</th>
                      <th style={TH}>Status</th>
                      <th style={TH}>Squad</th>
                      <th style={{ ...TH, textAlign: "right" }}>EST. TOTAL</th>
                      <th style={{ ...TH, textAlign: "right" }}>FAT (%)</th>
                      <th style={{ ...TH, textAlign: "right" }}>FAT (H)</th>
                      <th style={{ ...TH, textAlign: "right" }}>Valor</th>
                    </tr></thead>
                    <tbody>
                      {tickets.map(t => {
                        const fatH = getTicketH(t);
                        const fullH = getTicketFullH(t);
                        const isDem = String(t.escopo || "").toUpperCase().trim() === "DEMANDA";
                        const tf = t.termoFaturamento;
                        const slotIdx = isDem && Array.isArray(tf) ? tf.indexOf(termo.id) : -1;
                        const milePct = slotIdx >= 0 ? (MILESTONE_FACTORS[slotIdx] * 100).toFixed(0) + "%" : null;
                        const mileColors = ["#fb923c", "#38bdf8", "#4ade80"];
                        const mileCol = slotIdx >= 0 ? mileColors[slotIdx] : "#a78bfa";
                        const squad = t.squadPrincipal || t.squad || "—";
                        return (
                          <tr key={t.id}>
                            <td style={{ ...TD, fontFamily: "monospace", fontSize: 11, color: "var(--indigo-11)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.issueKey || t.id}</td>
                            <td style={{ ...TD, overflow: "hidden", textOverflow: "ellipsis" }} title={t.summary}>{t.summary || "—"}</td>
                            <td style={TD}>
                              {t.status ? <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 999, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc", whiteSpace: "nowrap" }}>{t.status}</span> : <span style={{ color: "var(--gray-7)", fontSize: 11 }}>—</span>}
                            </td>
                            <td style={{ ...TD, overflow: "hidden", textOverflow: "ellipsis" }}>
                              {squad !== "—" ? <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 999, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#6ee7b7", whiteSpace: "nowrap" }}>{squad}</span> : <span style={{ color: "var(--gray-7)", fontSize: 11 }}>—</span>}
                            </td>
                            <td style={{ ...TDR, color: "var(--gray-10)" }}>{fullH}h</td>
                            <td style={{ ...TDR }}>
                              {milePct
                                ? <span style={{ fontSize: 10, fontWeight: 900, color: mileCol, padding: "2px 7px", borderRadius: 5, background: `${mileCol}18`, border: `1px solid ${mileCol}44`, whiteSpace: "nowrap" }}>{milePct}</span>
                                : <span style={{ color: "var(--gray-7)", fontSize: 11 }}>—</span>}
                            </td>
                            <td style={{ ...TDR, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fatH}h</td>
                            <td style={{ ...TDR, color }}>{fmtCurrency(fatH * valorBase)}</td>
                          </tr>
                        );
                      })}
                      {tickets.length === 0 && <tr><td colSpan={8} style={{ ...TD, textAlign: "center", color: "var(--gray-7)" }}>Nenhum ticket vinculado neste termo.</td></tr>}
                    </tbody>
                  </table>
                </div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Config Modal ─────────────────────────────────────────────── */
function ConfigModal({ config, contratos, onSave, onClose }) {
  const [valorHoraBase, setValorHoraBase] = useState(config?.valorHoraBase != null ? String(config.valorHoraBase) : "");
  const [empresas, setEmpresas] = useState(config?.empresas?.length ? config.empresas.map(e => ({ ...e, percentual: e.percentual != null ? String(e.percentual) : "" })) : [{ id: uid(), nome: "", contratoId: "", contratoNome: "", percentual: "" }]);
  const [saving, setSaving] = useState(false);
  const addEmpresa = () => setEmpresas(p => [...p, { id: uid(), nome: "", contratoId: "", contratoNome: "", percentual: "" }]);
  const removeEmpresa = (id) => setEmpresas(p => p.filter(e => e.id !== id));
  const update = (id, f, v) => setEmpresas(p => p.map(e => e.id === id ? { ...e, [f]: v } : e));
  const DEFAULT_ARC = [
    { nome: "Sustentação Novo GED", valorBase: 16676.51 },
    { nome: "Sustentação Cadeia Reversa (Power Plataform)", valorBase: 700.21 },
    { nome: "Sustentação Hydro 4.0", valorBase: 13226.20 },
    { nome: "Sustentação Reformadora", valorBase: 13226.20 },
    { nome: "Sustentação Procon (Power Plataform)", valorBase: 3450.31 },
    { nome: "Sustentação Interjonada (Power Plataform)", valorBase: 700.21 },
    { nome: "Sustentação TPG (Power Plataform)", valorBase: 3450.31 },
    { nome: "Sustentação GED AI", valorBase: 700.21 },
  ];
  const [tabelaArc, setTabelaArc] = useState(
    config?.tabelaArc?.length
      ? config.tabelaArc.map(s => ({ ...s, valorBase: s.valorBase != null ? String(s.valorBase) : "" }))
      : DEFAULT_ARC.map((s, i) => ({ id: `arc-${i}`, ...s, valorBase: String(s.valorBase) }))
  );
  const addArc = () => setTabelaArc(p => [...p, { id: uid(), nome: "", valorBase: "" }]);
  const removeArc = (id) => setTabelaArc(p => p.filter(s => s.id !== id));
  const updateArc = (id, f, v) => setTabelaArc(p => p.map(s => s.id === id ? { ...s, [f]: v } : s));
  const totalArc = tabelaArc.reduce((sum, s) => sum + (s.valorBase !== "" ? numVal(s.valorBase) : 0), 0);

  const DEFAULT_SP = [{ key: "aprovacaoPlanejamento", label: "Aprovação de Planejamento", pct: 30 }, { key: "emHomologacao", label: "Em homologação", pct: 60 }, { key: "concluida", label: "Concluída", pct: 10 }];
  const [statusPct, setStatusPct] = useState(DEFAULT_SP.map(s => ({ ...s, pct: config?.statusPct?.[s.key] != null ? String(config.statusPct[s.key]) : String(s.pct) })));
  const totalPct = empresas.reduce((s, e) => s + (e.percentual !== "" ? numVal(e.percentual) : 0), 0);
  const totalSP = statusPct.reduce((s, x) => s + (x.pct !== "" ? numVal(x.pct) : 0), 0);
  const lbl = { fontSize: 10, fontWeight: 700, color: "var(--gray-10)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 };
  const inp = { padding: "6px 9px", borderRadius: 6, border: "1px solid var(--gray-6)", background: "var(--gray-2)", color: "var(--gray-12)", fontSize: 12, outline: "none", width: "100%" };

  const handleSave = async () => {
    setSaving(true);
    try {
      const spMap = {};
      statusPct.forEach(s => { spMap[s.key] = s.pct !== "" ? numVal(s.pct) : null; });
      await onSave({
        valorHoraBase: valorHoraBase !== "" ? numVal(valorHoraBase) : null,
        empresas: empresas.filter(e => e.nome.trim()).map(e => ({ id: e.id, nome: e.nome.trim(), contratoId: e.contratoId || "", contratoNome: e.contratoNome || "", percentual: e.percentual !== "" ? numVal(e.percentual) : null })),
        statusPct: spMap,
        tabelaArc: tabelaArc.filter(s => s.nome.trim()).map(s => ({ id: s.id, nome: s.nome.trim(), valorBase: s.valorBase !== "" ? numVal(s.valorBase) : null })),
      });
      onClose();
    } catch { } finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--color-panel-solid)", border: "1px solid var(--gray-6)", borderRadius: 14, padding: "28px 32px", width: "min(96vw, 920px)", maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--gray-12)", display: "flex", alignItems: "center", gap: 8 }}><Settings size={16} style={{ color: "var(--indigo-10)" }} /> Configuração de Termos</div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-10)" }}><X size={18} /></button>
        </div>

        <div style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 10, padding: "14px 16px" }}>
          <label style={{ ...lbl, color: "#a5b4fc", marginBottom: 8 }}>Valor Hora Base (Baseline) *</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: "var(--gray-10)", fontWeight: 700 }}>R$</span>
            <input type="number" min={0} step={0.01} value={valorHoraBase} onChange={e => setValorHoraBase(e.target.value)} placeholder="0,00"
              style={{ width: 180, padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#a5b4fc", fontSize: 20, fontWeight: 800, outline: "none" }} />
            {valorHoraBase && <span style={{ fontSize: 14, color: "#a5b4fc", opacity: 0.6 }}>{fmtCurrency(numVal(valorHoraBase))}</span>}
          </div>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <label style={{ ...lbl, marginBottom: 0 }}>Empresas ({empresas.length})</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {totalPct > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: totalPct > 100 ? "#f87171" : totalPct === 100 ? "#4ade80" : "#fbbf24" }}>Total: {totalPct.toFixed(1)}%</span>}
              <button type="button" onClick={addEmpresa} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, border: "none", background: "var(--indigo-9)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><Plus size={12} /> Adicionar empresa</button>
            </div>
          </div>
          <div style={{ borderRadius: 8, border: "1px solid var(--gray-5)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <colgroup><col style={{ width: 32 }} /><col style={{ width: "27%" }} /><col /><col style={{ width: 110 }} /><col style={{ width: 120 }} /><col style={{ width: 40 }} /></colgroup>
              <thead><tr style={{ background: "var(--gray-3)" }}>
                {["#","EMPRESA","CONTRATO","% EMP.","R$/HORA",""].map((h,i) => <th key={i} style={{ padding: "7px 10px", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "var(--gray-9)", textAlign: i >= 3 ? "right" : "left", borderBottom: "1px solid var(--gray-5)" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {empresas.map((e, idx) => {
                  const vhe = valorHoraBase !== "" && e.percentual !== "" ? numVal(valorHoraBase) * numVal(e.percentual) / 100 : null;
                  return (
                    <tr key={e.id} style={{ borderBottom: "1px solid var(--gray-4)", background: idx % 2 === 0 ? undefined : "var(--gray-1)" }}>
                      <td style={{ padding: "6px 8px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--gray-9)" }}>{idx + 1}</td>
                      <td style={{ padding: "5px 6px" }}><input value={e.nome} onChange={ev => update(e.id, "nome", ev.target.value)} placeholder="Nome..." style={inp} /></td>
                      <td style={{ padding: "5px 6px" }}>
                        <select value={e.contratoId} onChange={ev => { const c = contratos.find(x => x.id === ev.target.value); update(e.id, "contratoId", ev.target.value); update(e.id, "contratoNome", c?.nome || ""); }} style={{ ...inp, cursor: "pointer" }}>
                          <option value="">— Contrato —</option>
                          {contratos.map(c => <option key={c.id} value={c.id}>{c.nome} · {c.projectName}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: "5px 6px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          <input type="number" min={0} max={100} step={0.01} value={e.percentual} onChange={ev => update(e.id, "percentual", ev.target.value)} placeholder="%" style={{ ...inp, textAlign: "right" }} />
                          <span style={{ fontSize: 11, color: "var(--gray-10)", flexShrink: 0 }}>%</span>
                        </div>
                      </td>
                      <td style={{ padding: "5px 8px", textAlign: "right", fontSize: 13, fontWeight: 800, color: "#38bdf8" }}>{vhe != null ? fmtCurrency(vhe) : "—"}</td>
                      <td style={{ padding: "5px 6px", textAlign: "center" }}>
                        <button type="button" onClick={() => removeEmpresa(e.id)} style={{ padding: "3px 5px", borderRadius: 5, border: "1px solid var(--red-6)", background: "var(--red-3)", color: "var(--red-10)", cursor: "pointer", display: "flex", alignItems: "center" }}><Trash2 size={12} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabela ARC */}
        <div style={{ background: "rgba(56,189,248,0.04)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <label style={{ ...lbl, color: "#38bdf8", marginBottom: 2 }}>Tabela ARC — Sistemas e Valores Base</label>
              <div style={{ fontSize: 10, color: "var(--gray-8)" }}>Configure os sistemas e seus valores base mensais.</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#38bdf8" }}>Total: {fmtCurrency(totalArc)}</span>
              <button type="button" onClick={addArc}
                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, border: "none", background: "rgba(56,189,248,0.2)", color: "#38bdf8", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                <Plus size={12} /> Adicionar sistema
              </button>
            </div>
          </div>
          <div style={{ borderRadius: 8, border: "1px solid rgba(56,189,248,0.2)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <colgroup><col style={{ width: 32 }} /><col /><col style={{ width: 160 }} /><col style={{ width: 40 }} /></colgroup>
              <thead><tr style={{ background: "rgba(56,189,248,0.07)" }}>
                {["#","SISTEMA","VALOR BASE (R$)",""].map((h,i) => <th key={i} style={{ padding: "7px 10px", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "#38bdf8", textAlign: i === 2 ? "right" : i >= 3 ? "center" : "left", borderBottom: "1px solid rgba(56,189,248,0.2)" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {tabelaArc.map((s, idx) => (
                  <tr key={s.id} style={{ borderBottom: "1px solid rgba(56,189,248,0.1)", background: idx % 2 === 0 ? undefined : "rgba(56,189,248,0.02)" }}>
                    <td style={{ padding: "5px 8px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--gray-9)" }}>{idx + 1}</td>
                    <td style={{ padding: "5px 6px" }}>
                      <input value={s.nome} onChange={ev => updateArc(s.id, "nome", ev.target.value)} placeholder="Nome do sistema..." style={{ ...inp, fontSize: 12 }} />
                    </td>
                    <td style={{ padding: "5px 6px" }}>
                      <input type="number" min={0} step={0.01} value={s.valorBase} onChange={ev => updateArc(s.id, "valorBase", ev.target.value)}
                        placeholder="0,00" style={{ ...inp, textAlign: "right", color: "#38bdf8", fontWeight: 700 }} />
                    </td>
                    <td style={{ padding: "5px 6px", textAlign: "center" }}>
                      <button type="button" onClick={() => removeArc(s.id)} style={{ padding: "3px 5px", borderRadius: 5, border: "1px solid var(--red-6)", background: "var(--red-3)", color: "var(--red-10)", cursor: "pointer", display: "flex", alignItems: "center" }}><Trash2 size={12} /></button>
                    </td>
                  </tr>
                ))}
                {tabelaArc.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: "12px", textAlign: "center", fontSize: 12, color: "var(--gray-8)" }}>Clique em "Adicionar sistema" para inserir.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <label style={{ ...lbl, color: "#fbbf24", marginBottom: 0 }}>% de Horas a Faturar por Status</label>
            <span style={{ fontSize: 11, fontWeight: 700, color: totalSP > 100 ? "#f87171" : totalSP === 100 ? "#4ade80" : "#fbbf24" }}>Total: {totalSP.toFixed(1)}%</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {statusPct.map(s => (
              <div key={s.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-12)", flex: 1 }}>{s.label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <input type="number" min={0} max={100} step={1} value={s.pct}
                    onChange={ev => setStatusPct(p => p.map(x => x.key === s.key ? { ...x, pct: ev.target.value } : x))}
                    style={{ ...inp, width: 72, textAlign: "right", fontSize: 14, fontWeight: 700, color: "#fbbf24", border: "1px solid rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.05)" }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4, borderTop: "1px solid var(--gray-5)" }}>
          <button type="button" onClick={onClose} style={{ padding: "7px 18px", borderRadius: 7, border: "1px solid var(--gray-6)", background: "var(--gray-3)", color: "var(--gray-11)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          <button type="button" onClick={handleSave} disabled={saving}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 22px", borderRadius: 7, border: "none", background: "var(--indigo-9)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
            <Save size={14} /> {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────── */
export default function FinanceiroTermos() {
  const [config, setConfig] = useState(null);
  const [termos, setTermos] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [projectCodes, setProjectCodes] = useState([]);
  const [showConfig, setShowConfig] = useState(false);
  const [showCriar, setShowCriar] = useState(false);
  const [viewTermo, setViewTermo] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => onSnapshot(doc(db, "financeiro_termos", "config"), snap => setConfig(snap.exists() ? snap.data() : null), () => {}), []);
  useEffect(() => {
    const q = query(collection(db, EMISSAO_COL), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => setTermos(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
  }, []);
  useEffect(() => { loadAllContratos().then(setContratos).catch(() => {}); }, []);
  useEffect(() => { loadProjectCodes().then(setProjectCodes).catch(() => {}); }, []);

  const handleSaveConfig = useCallback(async (data) => {
    await setDoc(doc(db, "financeiro_termos", "config"), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  }, []);
  const handleCriarTermo = useCallback(async (data) => {
    await addDoc(collection(db, EMISSAO_COL), { ...data, createdAt: serverTimestamp() });
  }, []);
  const handleUpdateTermo = useCallback(async (id, data) => {
    await updateDoc(doc(db, EMISSAO_COL, id), { ...data, updatedAt: serverTimestamp() });
  }, []);
  const handleDelete = async (id) => {
    if (!window.confirm("Excluir este termo?")) return;
    setDeletingId(id);
    try { await deleteDoc(doc(db, EMISSAO_COL, id)); } finally { setDeletingId(null); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {showConfig && <ConfigModal config={config} contratos={contratos} onSave={handleSaveConfig} onClose={() => setShowConfig(false)} />}
      {showCriar && <CriarTermoModal contratos={contratos} projectCodes={projectCodes} onSave={handleCriarTermo} onClose={() => setShowCriar(false)} />}
      {viewTermo && <ViewTermoModal termo={viewTermo} contratos={contratos} projectCodes={projectCodes} config={config} onSave={handleUpdateTermo} onClose={() => setViewTermo(null)} />}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--gray-12)" }}>Gestão de Emissão de Termos</div>
          <div style={{ fontSize: 11, color: "var(--gray-8)", marginTop: 3 }}>{termos.length} termo{termos.length !== 1 ? "s" : ""} emitido{termos.length !== 1 ? "s" : ""}.</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" onClick={() => setShowConfig(true)} title="Configurações de Base"
            style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--gray-6)", background: "var(--gray-2)", color: "var(--gray-10)", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <Settings size={15} />
          </button>
          <button type="button" onClick={() => setShowCriar(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--indigo-9)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            <Plus size={15} /> Criar Termo
          </button>
        </div>
      </div>

      {termos.length === 0 ? (
        <div style={{ padding: "48px 0", textAlign: "center", color: "var(--gray-8)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Nenhum termo emitido ainda.</div>
          <div style={{ fontSize: 12, marginTop: 6, color: "var(--gray-7)" }}>Clique em "Criar Termo" para emitir o primeiro termo.</div>
        </div>
      ) : (
        <div style={{ borderRadius: 10, border: "1px solid var(--gray-5)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--gray-3)" }}>
                {[
                  { label: "STATUS", align: "left" },
                  { label: "MÊS REF.", align: "left" },
                  { label: "VALOR TOTAL", align: "right" },
                  { label: "CONTRATO", align: "left" },
                  { label: "CÓD. PROJETO", align: "left" },
                  { label: "CRIADO EM", align: "left" },
                  { label: "AÇÕES", align: "center" },
                ].map((h, i) => (
                  <th key={i} style={{ padding: "9px 14px", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "var(--gray-9)", textAlign: h.align, borderBottom: "1px solid var(--gray-5)", whiteSpace: "nowrap" }}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {termos.map((t, idx) => {
                const createdAt = t.createdAt?.toDate ? t.createdAt.toDate().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
                return (
                  <tr key={t.id} style={{ borderBottom: "1px solid var(--gray-4)", background: idx % 2 === 0 ? undefined : "var(--gray-1)" }}>
                    <td style={{ padding: "10px 14px" }}><StatusBadge status={t.status} /></td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--gray-12)" }}>{fmtMes(t.mesReferencia)}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      {t.valorTotal != null
                        ? <span style={{ fontSize: 12, fontWeight: 800, color: "var(--indigo-11)", fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(t.valorTotal)}</span>
                        : <span style={{ fontSize: 11, color: "var(--gray-7)" }}>—</span>}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "var(--gray-12)" }}>{t.contratoNome || "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      {t.codigoProjeto ? <span style={{ fontSize: 12, fontWeight: 700, color: "var(--amber-11)", background: "var(--amber-3)", border: "1px solid var(--amber-7)", borderRadius: 6, padding: "2px 8px" }}>{t.codigoProjeto}</span>
                        : <span style={{ fontSize: 11, color: "var(--gray-7)" }}>—</span>}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--gray-9)" }}>{createdAt}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                        <button type="button" title="Visualizar" onClick={() => setViewTermo(t)}
                          style={{ padding: "4px 7px", borderRadius: 6, border: "1px solid var(--gray-6)", background: "var(--gray-2)", color: "var(--gray-10)", cursor: "pointer", display: "flex", alignItems: "center" }}>
                          <Eye size={13} />
                        </button>
                        <button type="button" title="Editar" onClick={() => setViewTermo(t)}
                          style={{ padding: "4px 7px", borderRadius: 6, border: "1px solid var(--indigo-6)", background: "var(--indigo-3)", color: "var(--indigo-11)", cursor: "pointer", display: "flex", alignItems: "center" }}>
                          <Pencil size={13} />
                        </button>
                        <button type="button" title="Excluir" disabled={deletingId === t.id} onClick={() => handleDelete(t.id)}
                          style={{ padding: "4px 7px", borderRadius: 6, border: "1px solid var(--red-6)", background: "var(--red-3)", color: "var(--red-10)", cursor: "pointer", display: "flex", alignItems: "center", opacity: deletingId === t.id ? 0.5 : 1 }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
