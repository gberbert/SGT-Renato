import React, { useState, useEffect, useMemo, useRef } from "react";
import { Save, Download } from "lucide-react";
import * as XLSX from "xlsx";
import {
  subscribeToCapacityConfig, saveCapacityConfig, loadCapacityConfig,
  DEFAULT_BASE_PARAMS, computeCapacity,
} from "../services/teamCapacityService";

/* ─── helpers ─────────────────────────────────────── */
function r1(n) { return Math.round((Number(n) || 0) * 10) / 10; }

function toDate(v) {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  if (v?.seconds) return new Date(v.seconds * 1000);
  if (v instanceof Date) return v;
  if (typeof v === "string") return new Date(v.length === 10 ? v + "T00:00:00" : v);
  return null;
}

function workingDaysBetweenDates(s, e) {
  const sD = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const eD = new Date(e.getFullYear(), e.getMonth(), e.getDate());
  if (eD < sD) return 0;
  const totalDays = Math.round((eD - sD) / 86400000) + 1;
  let count = 0;
  const startDow = sD.getDay();
  for (let i = 0; i < totalDays; i++) {
    const dow = (startDow + i) % 7;
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

function computeJourneyBreakdown(journeyPeriods, periodStart, periodEnd) {
  const ps = periodStart ? toDate(periodStart) : null;
  const pe = periodEnd   ? toDate(periodEnd)   : null;
  let ferias = 0, folga = 0, atestado = 0, horaExtra = 0;
  for (const p of (journeyPeriods || [])) {
    if (!p?.dataInicio || !p?.dataFim) continue;
    const s = toDate(p.dataInicio);
    const e = toDate(p.dataFim);
    if (!s || !e) continue;
    const start = ps ? new Date(Math.max(s.getTime(), ps.getTime())) : s;
    const end   = pe ? new Date(Math.min(e.getTime(), pe.getTime())) : e;
    if (start > end) continue;
    const days  = workingDaysBetweenDates(start, end);
    const hours = r1(days * 8);
    const tipo = (p.tipo || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s/g, "");
    if (tipo.includes("feria"))      ferias    = r1(ferias    + hours);
    else if (tipo.includes("folga")) folga     = r1(folga     + hours);
    else if (tipo.includes("atest")) atestado  = r1(atestado  + hours);
    else if (tipo.includes("hora"))  horaExtra = r1(horaExtra + hours);
  }
  return { ferias, folga, atestado, horaExtra };
}

/* count Mon–Fri days in a given year/month (0-based month) */
function countWeekdays(year, month) {
  const last = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= last; d++) {
    const dow = new Date(year, month, d).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

/* ─── styles ──────────────────────────────────────── */
const B = { padding:"6px 10px", fontSize:10, fontWeight:700, letterSpacing:"0.06em",
  color:"var(--gray-9)", borderBottom:"2px solid var(--gray-4)", whiteSpace:"nowrap",
  background:"var(--gray-2)", position:"sticky", top:0, zIndex:2 };
const THL = { ...B, textAlign:"left" };
const THC = { ...B, textAlign:"center" };
const THR = { ...B, textAlign:"right" };
const D = { padding:"7px 10px", fontSize:12, borderBottom:"1px solid var(--gray-3)",
  whiteSpace:"nowrap", verticalAlign:"middle" };
const TDL = { ...D, textAlign:"left" };
const TDC = { ...D, textAlign:"center" };
const TDR = { ...D, textAlign:"right" };
const F = { padding:"6px 10px", fontSize:12, fontWeight:700, background:"var(--gray-3)",
  whiteSpace:"nowrap", verticalAlign:"middle", borderTop:"2px solid var(--gray-5)",
  color:"var(--gray-11)" };
const TFL = { ...F, textAlign:"left" };
const TFR = { ...F, textAlign:"right" };

/* ─── component ───────────────────────────────────── */
export default function TeamCapacityGrid({
  usersFiltered, workingDays, periodStart, periodEnd, squadById, membership, membershipRoles,
}) {
  const users = usersFiltered || [];
  const [config,    setConfig] = useState(null);
  const [overrides, setOvr]   = useState({});
  const [dirty,     setDirty] = useState(false);
  const [saving,    setSaving]= useState(false);

  const pRef = useRef({ periodStart, periodEnd, workingDays });
  useEffect(() => { pRef.current = { periodStart, periodEnd, workingDays }; });

  useEffect(() => {
    if (!periodStart || !periodEnd) return;
    return subscribeToCapacityConfig(periodStart, periodEnd, (cfg) => {
      setConfig(cfg);
      const ov = {};
      for (const [uid, m] of Object.entries(cfg?.memberOverrides || {}))
        if (m?.alocacao !== undefined) ov[uid] = { alocacao: m.alocacao };
      setOvr(ov);
      setDirty(false);
    });
  }, [periodStart, periodEnd]);

  const defaultAloc = config?.baseParams?.alocacao ?? DEFAULT_BASE_PARAMS.alocacao ?? 100;
  const sqMap = squadById || {};

  const rows = useMemo(() => users.map((u) => {
    const uid      = u.id || u.uid;
    const ov       = overrides[uid] || {};
    const alocacao = ov.alocacao !== undefined ? ov.alocacao : defaultAloc;
    const wd       = Number(workingDays) || 0;
    const capacityBruto = r1(wd * 8 * alocacao / 100);
    const jb       = computeJourneyBreakdown(u.journeyPeriods, periodStart, periodEnd);
    const capacityReal = r1(capacityBruto - jb.ferias - jb.folga - jb.atestado + jb.horaExtra);
    const squads = membership
      ? [...(membership.get(uid) || new Set())].map((sid) => ({
          id: sid,
          label: sqMap[sid]?.name || sqMap[sid]?.key || sqMap[sid]?.sigla || sid,
        }))
      : [];
    const sqRoles = membershipRoles ? (membershipRoles.get(uid) || []) : [];
    return { user: u, uid, alocacao, hiAloc: ov.alocacao !== undefined,
      capacityBruto, ...jb, capacityReal, squads, sqRoles };
  }), [users, overrides, defaultAloc, workingDays, sqMap, membership, membershipRoles, periodStart, periodEnd]);

  const tot = useMemo(() => rows.reduce((a, r) => ({
    bruto: r1(a.bruto + r.capacityBruto),
    ferias: r1(a.ferias + r.ferias),
    folga: r1(a.folga + r.folga),
    atestado: r1(a.atestado + r.atestado),
    horaExtra: r1(a.horaExtra + r.horaExtra),
    real: r1(a.real + r.capacityReal),
  }), { bruto:0, ferias:0, folga:0, atestado:0, horaExtra:0, real:0 }), [rows]);

  function setAlocacao(uid, val) {
    const v = Math.min(200, Math.max(0, Number(val) || 0));
    setOvr((p) => ({ ...p, [uid]: { ...(p[uid] || {}), alocacao: v } }));
    setDirty(true);
  }

  async function exportCapacityToXlsx() {
    const dateStr = new Date().toISOString().slice(0, 10);

    // ── Sheet 1: retrato do mês selecionado ─────────────────────────────────
    const dataRows = rows.map((r) => ({
      "Membro":          r.user?.displayName || r.user?.shortName || r.user?.name || r.user?.email || r.uid,
      "SAP":             r.user?.sapId || "",
      "Contratação":     r.user?.contract || "—",
      "Squad(s)":        r.squads.map((sq) => sq.label).join("; ") || "—",
      "Papel na Squad":  r.sqRoles.map((sr) => `${sr.squadName}${sr.role ? ` · ${sr.role}` : ""}`).join("; ") || "—",
      "Alocação (%)":    r.alocacao,
      "Cap. Bruto (h)":  r.capacityBruto,
      "Férias (h)":      r.ferias || 0,
      "Folga (h)":       r.folga || 0,
      "Atestado (h)":    r.atestado || 0,
      "H. Extra (h)":    r.horaExtra || 0,
      "Cap. Real (h)":   r.capacityReal,
    }));
    dataRows.push({
      "Membro":          `TOTAL (${rows.length} membros)`,
      "SAP":             "",
      "Contratação":     "",
      "Squad(s)":        "",
      "Papel na Squad":  "",
      "Alocação (%)":    "",
      "Cap. Bruto (h)":  tot.bruto,
      "Férias (h)":      tot.ferias,
      "Folga (h)":       tot.folga,
      "Atestado (h)":    tot.atestado,
      "H. Extra (h)":    tot.horaExtra,
      "Cap. Real (h)":   tot.real,
    });
    const ws1 = XLSX.utils.json_to_sheet(dataRows);
    const cols1 = Object.keys(dataRows[0] || {});
    ws1["!cols"] = cols1.map((k) => ({
      wch: Math.max(k.length, ...dataRows.map((row) => String(row[k] ?? "").length), 8),
    }));

    // ── Sheet 2: projeção Cap. Real — 6 meses a partir do mês atual ─────────
    const today  = new Date();
    const months = [];
    for (let i = 0; i < 6; i++) {
      const d   = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const y   = d.getFullYear();
      const mo  = d.getMonth();
      const pad = (n) => String(n).padStart(2, "0");
      const ps  = `${y}-${pad(mo + 1)}-01`;
      const pe  = `${y}-${pad(mo + 1)}-${pad(new Date(y, mo + 1, 0).getDate())}`;
      const raw = d.toLocaleString("pt-BR", { month: "short", year: "numeric" });
      const label = raw.replace(".", "").replace(/^\w/, (c) => c.toUpperCase());
      months.push({ ps, pe, label, y, mo });
    }

    // fetch configs for all 6 months in parallel
    const configs = await Promise.all(months.map(({ ps, pe }) => loadCapacityConfig(ps, pe)));

    const projRows = rows.map((r) => {
      const rowData = {
        "Membro":         r.user?.displayName || r.user?.shortName || r.user?.name || r.user?.email || r.uid,
        "SAP":            r.user?.sapId || "",
        "Contratação":    r.user?.contract || "—",
        "Squad(s)":       r.squads.map((sq) => sq.label).join("; ") || "—",
        "Papel na Squad": r.sqRoles.map((sr) => `${sr.squadName}${sr.role ? ` · ${sr.role}` : ""}`).join("; ") || "—",
      };
      months.forEach(({ ps, pe, label, y, mo }, i) => {
        const cfg      = configs[i];
        const defAloc  = cfg?.baseParams?.alocacao ?? DEFAULT_BASE_PARAMS.alocacao ?? 100;
        const alocacao = cfg?.memberOverrides?.[r.uid]?.alocacao ?? defAloc;
        const wd       = cfg?.workingDays ?? countWeekdays(y, mo);
        const capBruto = r1(wd * 8 * alocacao / 100);
        const jb       = computeJourneyBreakdown(r.user.journeyPeriods, ps, pe);
        const capReal  = r1(capBruto - jb.ferias - jb.folga - jb.atestado + jb.horaExtra);
        rowData[label] = capReal;
      });
      return rowData;
    });

    // totals row for projection
    const projTotal = { "Membro": `TOTAL (${rows.length} membros)`, "SAP": "", "Contratação": "", "Squad(s)": "", "Papel na Squad": "" };
    months.forEach(({ label }) => {
      projTotal[label] = r1(projRows.reduce((acc, row) => acc + (Number(row[label]) || 0), 0));
    });
    projRows.push(projTotal);

    const ws2 = XLSX.utils.json_to_sheet(projRows);
    const cols2 = Object.keys(projRows[0] || {});
    ws2["!cols"] = cols2.map((k) => ({
      wch: Math.max(k.length, ...projRows.map((row) => String(row[k] ?? "").length), 8),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "Retrato do Mês");
    XLSX.utils.book_append_sheet(wb, ws2, "Projeção 6 Meses");
    XLSX.writeFile(wb, `team_capacity_${dateStr}.xlsx`);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { periodStart: ps, periodEnd: pe, workingDays: wd } = pRef.current;
      const mo = {};
      for (const [uid, ov] of Object.entries(overrides))
        if (ov.alocacao !== undefined) mo[uid] = { alocacao: ov.alocacao };
      await saveCapacityConfig({
        periodStart: ps, periodEnd: pe,
        workingDays: Number(wd) || 0,
        capacityBruto: r1((Number(wd) || 0) * 8),
        baseParams: config?.baseParams || { alocacao: defaultAloc },
        memberOverrides: mo, updatedBy: "",
      });
      setDirty(false);
    } finally { setSaving(false); }
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
        <button
          type="button"
          onClick={exportCapacityToXlsx}
          style={{
            display:"inline-flex", alignItems:"center", gap:6,
            padding:"6px 14px", borderRadius:7, fontSize:12, fontWeight:700,
            border:"1px solid var(--green-7)", background:"var(--green-3)",
            color:"var(--green-11)", cursor:"pointer", letterSpacing:"0.04em",
            transition:"all 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--green-4)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--green-3)"; }}
        >
          <Download size={14} />
          Exportar Excel
        </button>
        {dirty && (
          <button onClick={handleSave} disabled={saving} style={{
            display:"flex", alignItems:"center", gap:6, padding:"6px 18px",
            borderRadius:7, fontSize:13, fontWeight:700,
            background:"var(--green-9)", color:"#fff", border:"none",
            cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
          }}>
            <Save size={14} />
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        )}
      </div>
      <div style={{ overflowX:"auto", borderRadius:10, border:"1px solid var(--gray-4)" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:860 }}>
          <thead>
            <tr>
              <th style={THL}>MEMBRO</th>
              <th style={THL}>SQUAD</th>
              <th style={THL}>PAPEL NA SQUAD</th>
              <th style={THC}>ALOCAÇÃO (%)</th>
              <th style={THR}>CAP. BRUTO</th>
              <th style={THR}>FÉRIAS (h)</th>
              <th style={THR}>FOLGA (h)</th>
              <th style={THR}>ATESTADO (h)</th>
              <th style={THR}>H. EXTRA (h)</th>
              <th style={THR}>CAP. REAL</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={10} style={{ ...TDC, padding:32, color:"var(--gray-8)" }}>
                Nenhum membro encontrado.
              </td></tr>
            )}
            {rows.map((r, i) => {
              const name = r.user?.displayName || r.user?.shortName || r.user?.name || r.user?.email || r.uid;
              return (
                <tr key={r.uid} style={{ background: i%2===0 ? undefined : "var(--gray-1)" }}>
                  <td style={TDL}><span style={{ fontWeight:600, color:"var(--gray-12)" }}>{name}</span></td>
                  <td style={TDL}>
                    <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                      {r.squads.length > 0
                        ? r.squads.map((sq) => (
                          <span key={sq.id} style={{ display:"inline-block", padding:"2px 8px", borderRadius:999,
                            fontSize:11, fontWeight:700, background:"var(--cyan-3)",
                            border:"1px solid var(--cyan-7)", color:"var(--cyan-11)", whiteSpace:"nowrap" }}>
                            {sq.label.toUpperCase()}
                          </span>))
                        : <span style={{ color:"var(--gray-7)", fontSize:11 }}>—</span>}
                    </div>
                  </td>
                  <td style={TDL}>
                    {r.sqRoles && r.sqRoles.length > 0
                      ? <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                          {r.sqRoles.map((sr, idx) => (
                            <span key={idx} style={{
                              display:"inline-flex", alignItems:"center", gap:4,
                              padding:"2px 8px", borderRadius:999, fontSize:11,
                              fontWeight:600, whiteSpace:"nowrap",
                              background:"var(--indigo-3)", border:"1px solid var(--indigo-7)", color:"var(--indigo-11)",
                            }}>
                              <span style={{ fontWeight:700, color:"var(--cyan-11)" }}>{sr.squadName}</span>
                              {sr.role ? <span style={{ color:"var(--gray-10)" }}>· {sr.role}</span> : null}
                            </span>
                          ))}
                        </div>
                      : <span style={{ color:"var(--gray-7)", fontSize:11 }}>—</span>}
                  </td>
                  <td style={TDC}>
                    <input type="number" min={0} max={200} value={r.alocacao}
                      onChange={(e) => setAlocacao(r.uid, e.target.value)}
                      style={{ width:64, textAlign:"center", padding:"3px 6px", fontSize:12, borderRadius:5,
                        border:`1px solid ${r.hiAloc ? "var(--blue-7)" : "var(--gray-5)"}`,
                        background: r.hiAloc ? "var(--blue-2)" : "var(--gray-2)",
                        color:"var(--gray-12)", outline:"none" }} />
                  </td>
                  <td style={TDR}><span style={{ fontWeight:600, color:"var(--gray-11)", fontVariantNumeric:"tabular-nums" }}>{r.capacityBruto}h</span></td>
                  <td style={TDR}><span style={{ color: r.ferias>0 ? "var(--teal-11)" : "var(--gray-8)", fontVariantNumeric:"tabular-nums" }}>{r.ferias > 0 ? r.ferias+"h" : "—"}</span></td>
                  <td style={TDR}><span style={{ color: r.folga>0 ? "var(--cyan-11)" : "var(--gray-8)", fontVariantNumeric:"tabular-nums" }}>{r.folga > 0 ? r.folga+"h" : "—"}</span></td>
                  <td style={TDR}><span style={{ color: r.atestado>0 ? "var(--orange-11)" : "var(--gray-8)", fontVariantNumeric:"tabular-nums" }}>{r.atestado > 0 ? r.atestado+"h" : "—"}</span></td>
                  <td style={TDR}><span style={{ color: r.horaExtra>0 ? "var(--purple-11)" : "var(--gray-8)", fontVariantNumeric:"tabular-nums" }}>{r.horaExtra > 0 ? "+"+r.horaExtra+"h" : "—"}</span></td>
                  <td style={TDR}><span style={{ fontWeight:700, color:"var(--green-11)", fontVariantNumeric:"tabular-nums" }}>{r.capacityReal}h</span></td>
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={4} style={{ ...TFL }}>TOTAL ({rows.length} membros)</td>
                <td style={TFR}>{tot.bruto}h</td>
                <td style={TFR}>{tot.ferias > 0 ? tot.ferias+"h" : "—"}</td>
                <td style={TFR}>{tot.folga > 0 ? tot.folga+"h" : "—"}</td>
                <td style={TFR}>{tot.atestado > 0 ? tot.atestado+"h" : "—"}</td>
                <td style={TFR}>{tot.horaExtra > 0 ? "+"+tot.horaExtra+"h" : "—"}</td>
                <td style={{ ...TFR, color:"var(--green-11)" }}>{tot.real}h</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
