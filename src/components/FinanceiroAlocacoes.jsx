import React, { useEffect, useState, useMemo, useRef } from "react";
import { db } from "../firebase";
import { collection, query, onSnapshot, orderBy, doc, setDoc, getDoc } from "firebase/firestore";
import { subscribeToUsers } from "../services/settingsService";
import { loadCapacityConfig, DEFAULT_BASE_PARAMS } from "../services/teamCapacityService";

const NATIONAL_FIXED = new Set(["01-01","04-21","05-01","09-07","10-12","11-02","11-15","11-20","12-25"]);

function countWD(year, month) {
  const last = new Date(year, month + 1, 0).getDate();
  let n = 0;
  for (let d = 1; d <= last; d++) {
    const dow = new Date(year, month, d).getDay();
    if (dow === 0 || dow === 6) continue;
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    if (NATIONAL_FIXED.has(mm + "-" + dd)) continue;
    n++;
  }
  return n;
}

function r1(n) { return Math.round((Number(n) || 0) * 10) / 10; }

function fmtCurrency(v) {
  if (!v && v !== 0) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function getUserLabel(u) { return u?.displayName || u?.shortName || u?.name || u?.email || u?.id || "Sem nome"; }

function todayYM() {
  const t = new Date();
  return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0");
}

function TermoPickerAlocacao({ userId, mesRef, currentTermoId, termos }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const triggerRef = useRef(null);
  const dropRef = useRef(null);
  const docId = userId + "_" + mesRef.replace("-", "");

  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        dropRef.current && !dropRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const select = async (termoId) => {
    if (saving) return;
    setSaving(true);
    setOpen(false);
    try {
      await setDoc(doc(db, "financeiro_alocacoes", docId), {
        userId,
        mesReferencia: mesRef,
        termoId: termoId || null,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const current = currentTermoId || null;
  const termo = termos.find(t => t.id === current);
  const label = (() => {
    if (!current || !termo) return "— Selecionar —";
    const mes = termo.mesReferencia ? new Date(termo.mesReferencia + "-01").toLocaleString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "") : "";
    const short = (termo.contratoNome || termo.id || "").split("-").slice(-1)[0].trim() || (termo.contratoNome || termo.id);
    return mes ? `${mes} · ${short}` : short;
  })();

  // Position the dropdown using fixed positioning
  const positionDrop = () => {
    if (!triggerRef.current || !dropRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    dropRef.current.style.top = (r.bottom + 4) + "px";
    dropRef.current.style.left = r.left + "px";
    dropRef.current.style.minWidth = r.width + "px";
  };

  return (
    <div style={{ position: "relative", minWidth: 170 }}>
      <button ref={triggerRef} type="button" onClick={() => { setOpen(v => { if (!v) setTimeout(positionDrop, 0); return !v; }); }}
        style={{ width: "100%", padding: "4px 8px", borderRadius: 6, border: `1px solid ${current ? "var(--indigo-7)" : "var(--gray-6)"}`, background: current ? "var(--indigo-2)" : "var(--gray-2)", color: current ? "var(--indigo-11)" : "var(--gray-9)", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4, outline: "none" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "left" }}>{saving ? "…" : label}</span>
        <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
      </button>
      {open && (
        <div ref={dropRef} style={{ position: "fixed", zIndex: 9500, background: "var(--color-panel-solid)", border: "1px solid var(--gray-5)", borderRadius: 8, boxShadow: "0 8px 32px rgba(0,0,0,.45)", maxHeight: 280, overflowY: "auto" }}>
          <button type="button" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); select(null); }}
            style={{ width: "100%", padding: "8px 12px", textAlign: "left", fontSize: 12, border: "none", background: "none", cursor: "pointer", color: "var(--gray-9)", borderBottom: "1px solid var(--gray-4)" }}>
            — Nenhum —
          </button>
          {termos.map(t => {
            const mes = t.mesReferencia ? new Date(t.mesReferencia + "-01").toLocaleString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "") : "";
            const short = (t.contratoNome || t.id || "").split("-").slice(-1)[0].trim() || (t.contratoNome || t.id);
            return (
              <button key={t.id} type="button" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); select(t.id); }}
                style={{ width: "100%", padding: "8px 12px", textAlign: "left", fontSize: 12, border: "none", background: t.id === current ? "var(--indigo-2)" : "none", cursor: "pointer", color: "var(--gray-12)", borderBottom: "1px solid var(--gray-3)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 14, height: 14, borderRadius: 999, border: `2px solid ${t.id === current ? "var(--indigo-9)" : "var(--gray-6)"}`, background: t.id === current ? "var(--indigo-9)" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {t.id === current && <span style={{ fontSize: 7, color: "#fff", fontWeight: 900 }}>✓</span>}
                </span>
                <div>
                  {mes && <span style={{ fontSize: 10, fontWeight: 800, color: "var(--indigo-11)", marginRight: 4 }}>{mes}</span>}
                  <span style={{ fontWeight: 600, fontSize: 11 }}>{short}</span>
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

export default function FinanceiroAlocacoes() {
  const [users, setUsers] = useState([]);
  const [squads, setSquads] = useState([]);
  const [termos, setTermos] = useState([]);
  const [alocacoes, setAlocacoes] = useState({});
  const [mesRef, setMesRef] = useState(todayYM);
  const [cfg, setCfg] = useState(null);
  const [termoFiltro, setTermoFiltro] = useState("");

  useEffect(() => { const u = subscribeToUsers(d => setUsers(d || [])); return () => u(); }, []);
  useEffect(() => { return onSnapshot(query(collection(db, "squads")), s => setSquads(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {}); }, []);
  useEffect(() => {
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
    return onSnapshot(query(collection(db, "financeiro_alocacoes")), snap => {
      const map = {};
      snap.docs.forEach(d => { map[d.id] = d.data(); });
      setAlocacoes(map);
    }, () => {});
  }, []);

  useEffect(() => {
    const [y, m] = mesRef.split("-").map(Number);
    const pad = n => String(n).padStart(2, "0");
    const ps = mesRef + "-01";
    const pe = `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`;
    loadCapacityConfig(ps, pe).then(c => setCfg(c)).catch(() => setCfg(null));
  }, [mesRef]);

  const bodyshopSquad = useMemo(() => squads.find(s => (s.name || s.key || s.sigla || "").toUpperCase().includes("BODYSHOP")), [squads]);

  const squadById = useMemo(() => { const m = {}; squads.forEach(s => { m[s.id] = s; }); return m; }, [squads]);

  const membershipMap = useMemo(() => {
    const map = new Map();
    for (const sq of squads) {
      if (!sq?.id) continue;
      for (const member of (Array.isArray(sq.users) ? sq.users : [])) {
        const id = typeof member === "string" ? member : member?.id || "";
        if (!id) continue;
        if (!map.has(id)) map.set(id, new Set());
        map.get(id).add(sq.id);
      }
    }
    return map;
  }, [squads]);

  const bodyshopMembers = useMemo(() => {
    if (!bodyshopSquad) return [];
    const bsIds = new Set(
      (Array.isArray(bodyshopSquad.users) ? bodyshopSquad.users : [])
        .map(m => typeof m === "string" ? m : m?.id || "")
        .filter(Boolean)
    );
    return users
      .filter(u => bsIds.has(u.id || u.uid))
      .sort((a, b) => getUserLabel(a).localeCompare(getUserLabel(b), "pt-BR"));
  }, [users, bodyshopSquad]);

  const membrosVisiveis = useMemo(() => {
    if (!termoFiltro) return bodyshopMembers;
    return bodyshopMembers.filter(u => {
      const id = u.id || u.uid;
      const docId = id + "_" + mesRef.replace("-", "");
      return alocacoes[docId]?.termoId === termoFiltro;
    });
  }, [bodyshopMembers, termoFiltro, mesRef, alocacoes]);

  function calcHoras(u) {
    const id = u.id || u.uid;
    const [y, m] = mesRef.split("-").map(Number);
    const defAloc = cfg?.baseParams?.alocacao ?? DEFAULT_BASE_PARAMS?.alocacao ?? 100;
    const ov = cfg?.memberOverrides?.[id] || {};
    const aloc = ov.alocacao !== undefined ? ov.alocacao : defAloc;
    const wd = cfg?.workingDays ?? countWD(y, m - 1);
    return r1(wd * 8 * aloc / 100);
  }

  const B = { padding: "6px 10px", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "var(--gray-9)", borderBottom: "2px solid var(--gray-4)", whiteSpace: "nowrap", background: "var(--gray-2)", position: "sticky", top: 0, zIndex: 2, textAlign: "left" };
  const D = { padding: "8px 10px", fontSize: 12, borderBottom: "1px solid var(--gray-3)", whiteSpace: "nowrap", verticalAlign: "middle" };

  const [ym, mm] = mesRef.split("-").map(Number);
  const mesLabel = new Date(ym, mm - 1, 1).toLocaleString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header com seletor de mês */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "var(--gray-2)", borderRadius: 8, padding: "10px 14px", border: "1px solid var(--gray-5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--gray-9)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Mês de referência</span>
          <input type="month" value={mesRef} onChange={e => setMesRef(e.target.value)}
            style={{ padding: "5px 10px", fontSize: 13, borderRadius: 6, border: "1px solid var(--indigo-6)", background: "var(--indigo-2)", color: "var(--gray-12)", outline: "none", cursor: "pointer" }} />
        </div>
        <span style={{ fontSize: 11, color: "var(--indigo-11)", fontWeight: 700, textTransform: "capitalize" }}>{mesLabel}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--gray-9)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>Filtrar por Termo</span>
          <select value={termoFiltro} onChange={e => setTermoFiltro(e.target.value)}
            style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${termoFiltro ? "var(--indigo-6)" : "var(--gray-6)"}`, background: termoFiltro ? "var(--indigo-2)" : "var(--gray-1)", color: termoFiltro ? "var(--indigo-11)" : "var(--gray-12)", fontSize: 12, cursor: "pointer", outline: "none", maxWidth: 220 }}>
            <option value="">— Todos —</option>
            {termos.map(t => {
              const mes = t.mesReferencia ? new Date(t.mesReferencia + "-01").toLocaleString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "") : "";
              const short = (t.contratoNome || t.id || "").split("-").slice(-1)[0].trim() || (t.contratoNome || t.id);
              return <option key={t.id} value={t.id}>{mes ? `${mes} · ${short}` : short}</option>;
            })}
          </select>
          {termoFiltro && <button type="button" onClick={() => setTermoFiltro("")} style={{ fontSize: 10, color: "var(--red-10)", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>✕</button>}
        </div>
        <span style={{ fontSize: 11, color: "var(--gray-8)", marginLeft: "auto" }}>
          {membrosVisiveis.length} membro{membrosVisiveis.length !== 1 ? "s" : ""} · BODYSHOP
        </span>
      </div>

      {/* Grid */}
      <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--gray-4)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
          <thead>
            <tr>
              <th style={B}>MEMBRO</th>
              <th style={B}>SAP</th>
              <th style={{ ...B, textAlign: "center" }}>STATUS</th>
              <th style={B}>CÓD. PROJETO</th>
              <th style={B}>SQUAD</th>
              <th style={B}>CONTRATO</th>
              <th style={{ ...B, textAlign: "right" }}>RATE CARD</th>
              <th style={{ ...B, textAlign: "right" }}>HORAS PREVISTAS</th>
              <th style={B}>TERMO FATURAMENTO</th>
            </tr>
          </thead>
          <tbody>
            {membrosVisiveis.length === 0 && (
              <tr><td colSpan={9} style={{ ...D, padding: 32, textAlign: "center", color: "var(--gray-8)" }}>
                {bodyshopSquad ? (termoFiltro ? "Nenhum membro com este termo no mês selecionado." : "Nenhum membro encontrado na squad BODYSHOP.") : "Squad BODYSHOP não encontrada."}
              </td></tr>
            )}
            {membrosVisiveis.map((u, idx) => {
              const id = u.id || u.uid;
              const name = getUserLabel(u);
              const squadsDoUser = [...(membershipMap.get(id) || new Set())].map(sid => ({ id: sid, label: squadById[sid]?.name || squadById[sid]?.key || sid }));
              const horas = calcHoras(u);
              const rc = parseFloat(String(u?.rc || "0").replace(",", ".")) || 0;
              return (
                <tr key={id} style={{ background: idx % 2 === 0 ? undefined : "var(--gray-1)" }}>
                  {/* Membro */}
                  <td style={{ ...D, maxWidth: 180 }}>
                    <span style={{ fontWeight: 600, color: "var(--gray-12)", display: "block", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }} title={name}>{name}</span>
                  </td>
                  {/* SAP */}
                  <td style={D}>
                    {u?.sapId
                      ? <span style={{ fontSize: 11, fontWeight: 700, color: "var(--violet-11)", background: "var(--violet-3)", border: "1px solid var(--violet-7)", borderRadius: 6, padding: "2px 7px", fontFamily: "monospace" }}>{u.sapId}</span>
                      : <span style={{ color: "var(--gray-7)", fontSize: 11 }}>—</span>}
                  </td>
                  {/* Status */}
                  <td style={{ ...D, textAlign: "center" }}>
                    {u?.status
                      ? <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: u.status.toLowerCase() === "inativo" ? "var(--gray-3)" : "var(--green-3)", border: `1px solid ${u.status.toLowerCase() === "inativo" ? "var(--gray-6)" : "var(--green-7)"}`, color: u.status.toLowerCase() === "inativo" ? "var(--gray-9)" : "var(--green-11)", whiteSpace: "nowrap" }}>{u.status}</span>
                      : <span style={{ color: "var(--gray-7)", fontSize: 10 }}>—</span>}
                  </td>
                  {/* Cód. Projeto */}
                  <td style={D}>
                    {u?.projectCode
                      ? <span style={{ fontSize: 11, fontWeight: 700, color: "var(--amber-11)", background: "var(--amber-3)", border: "1px solid var(--amber-7)", borderRadius: 6, padding: "2px 7px" }}>{u.projectCode}</span>
                      : <span style={{ color: "var(--gray-7)", fontSize: 11 }}>—</span>}
                  </td>
                  {/* Squad */}
                  <td style={D}>
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                      {squadsDoUser.length > 0
                        ? squadsDoUser.map(sq => <span key={sq.id} style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 999, background: "var(--cyan-3)", border: "1px solid var(--cyan-7)", color: "var(--cyan-11)", whiteSpace: "nowrap" }}>{sq.label.toUpperCase()}</span>)
                        : <span style={{ color: "var(--gray-7)", fontSize: 11 }}>—</span>}
                    </div>
                  </td>
                  {/* Contrato */}
                  <td style={D}>
                    {u?.contract
                      ? <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "var(--gray-3)", border: "1px solid var(--gray-6)", color: "var(--gray-11)" }}>{u.contract}</span>
                      : <span style={{ color: "var(--gray-7)", fontSize: 11 }}>—</span>}
                  </td>
                  {/* Rate Card */}
                  <td style={{ ...D, textAlign: "right" }}>
                    {rc > 0
                      ? <span style={{ fontSize: 12, fontWeight: 700, color: "var(--violet-11)", fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(rc)}</span>
                      : <span style={{ color: "var(--gray-7)", fontSize: 11 }}>—</span>}
                  </td>
                  {/* Horas Previstas */}
                  <td style={{ ...D, textAlign: "right" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: horas > 0 ? "var(--green-11)" : "var(--gray-7)", fontVariantNumeric: "tabular-nums" }}>
                      {horas > 0 ? `${horas}h` : "—"}
                    </span>
                  </td>
                  {/* Termo Faturamento */}
                  <td style={D}>
                    <TermoPickerAlocacao
                      userId={id}
                      mesRef={mesRef}
                      termos={termos}
                      currentTermoId={alocacoes[id + "_" + mesRef.replace("-", "")]?.termoId || null}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
