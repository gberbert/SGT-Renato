import React, { useState, useEffect, useMemo } from "react";
import { Save, RotateCcw } from "lucide-react";
import {
  subscribeToCapacityConfig,
  saveCapacityConfig,
  DEFAULT_BASE_PARAMS,
} from "../services/teamCapacityService";

function round1(n) {
  return Math.round((Number(n) || 0) * 10) / 10;
}

function computeMemberCapacity(workingDays, params) {
  const wd       = Number(workingDays)    || 0;
  const alocacao = Number(params?.alocacao ?? 100);
  const capacityBruto         = round1(wd * 8);
  const capacityBrutoAlocacao = round1(capacityBruto * (alocacao / 100));
  return { capacityBruto, capacityBrutoAlocacao };
}

/** Normalize any date value (Firestore Timestamp, {seconds}, Date, string) → JS Date */
function toDateLocal(v) {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();                   // Firestore Timestamp
  if (typeof v === "object" && typeof v.seconds === "number")
    return new Date(v.seconds * 1000);                                       // plain {seconds,nanoseconds}
  if (v instanceof Date) return v;
  if (typeof v === "string")
    return new Date(v.length === 10 ? v + "T00:00:00" : v);                 // "YYYY-MM-DD" → local midnight
  return null;
}

/**
 * Compute jornada hours for Ferias, Folga, Atestado, Hora Extra
 * overlapping with [periodStart, periodEnd] (inclusive, "YYYY-MM-DD").
 * Handles Firestore Timestamps, plain {seconds} objects, Date, and strings.
 */
function computeJornadaHours(journeyPeriods, periodStart, periodEnd) {
  const result = { ferias: 0, folga: 0, atestado: 0, horaExtra: 0 };
  if (!Array.isArray(journeyPeriods) || !periodStart || !periodEnd) return result;
  const psRaw = new Date(periodStart + "T00:00:00");
  const peRaw = new Date(periodEnd   + "T00:00:00");
  // Normalize period bounds to local midnight (avoid UTC shift)
  const psD = new Date(psRaw.getFullYear(), psRaw.getMonth(), psRaw.getDate());
  const peD = new Date(peRaw.getFullYear(), peRaw.getMonth(), peRaw.getDate());
  for (const p of journeyPeriods) {
    if (!p?.dataInicio || !p?.dataFim) continue;
    const s = toDateLocal(p.dataInicio);
    const e = toDateLocal(p.dataFim);
    if (!s || !e || isNaN(s.getTime()) || isNaN(e.getTime())) continue;
    // Normalize to local midnight for day-level comparison
    const sD = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const eD = new Date(e.getFullYear(), e.getMonth(), e.getDate());
    const overlapStart = sD < psD ? psD : sD;
    const overlapEnd   = eD > peD ? peD : eD;
    if (overlapEnd < overlapStart) continue;
    const days = Math.round((overlapEnd - overlapStart) / 86400000) + 1;
    const h    = round1(days * 8);
    const tipo = p.tipo || "";
    if (tipo === "Ferias" || tipo === "Férias") result.ferias    += h;
    else if (tipo === "Folga")                  result.folga     += h;
    else if (tipo === "Atestado")               result.atestado  += h;
    else if (tipo === "Hora Extra")             result.horaExtra += h;
  }
  result.ferias    = round1(result.ferias);
  result.folga     = round1(result.folga);
  result.atestado  = round1(result.atestado);
  result.horaExtra = round1(result.horaExtra);
  return result;
}

function getUserLabel(u) {
  return u?.displayName || u?.shortName || u?.name || u?.email || u?.id || "Sem nome";
}

function NumInput({ value, onChange, highlight, min, max, step, title }) {
  return (
    <input
      type="number"
      min={min !== undefined ? min : 0}
      max={max !== undefined ? max : 9999}
      step={step !== undefined ? step : 0.5}
      value={value}
      title={title}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: 66,
        padding: "3px 6px",
        fontSize: 12,
        borderRadius: 5,
        border: highlight ? "1px solid var(--amber-7)" : "1px solid var(--gray-5)",
        background: highlight ? "var(--amber-2)" : "var(--gray-2)",
        color: "var(--gray-12)",
        textAlign: "right",
        fontWeight: highlight ? 700 : 400,
        outline: "none",
        boxSizing: "border-box",
      }}
    />
  );
}

function Badge({ value, color }) {
  const c = color || "gray";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 700,
        background: `var(--${c}-3)`,
        border: `1px solid var(--${c}-6)`,
        color: `var(--${c}-11)`,
        minWidth: 48,
        textAlign: "right",
      }}
    >
      {value}
    </span>
  );
}

const TH = {
  padding: "6px 10px",
  textAlign: "right",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.06em",
  color: "var(--gray-9)",
  borderBottom: "2px solid var(--gray-4)",
  whiteSpace: "nowrap",
  background: "var(--gray-2)",
  position: "sticky",
  top: 0,
  zIndex: 2,
};
const TH_LEFT       = { ...TH, textAlign: "left" };
const TD = {
  padding: "7px 10px",
  fontSize: 12,
  borderBottom: "1px solid var(--gray-3)",
  textAlign: "right",
  whiteSpace: "nowrap",
  verticalAlign: "middle",
};
const TD_LEFT       = { ...TD, textAlign: "left" };
const TD_TOTAL      = { ...TD, fontWeight: 700, background: "var(--gray-2)", borderTop: "2px solid var(--gray-5)" };
const TD_TOTAL_LEFT = { ...TD_TOTAL, textAlign: "left" };

function Dash() {
  return <span style={{ color: "var(--gray-6)", fontSize: 11 }}>{"—"}</span>;
}

export default function TeamCapacityGrid({
  usersFiltered,
  squadById,
  membership,
  workingDays,
  baseParams,
  periodStart,
  periodEnd,
  currentUser,
}) {
  const users = usersFiltered || [];
  const sqMap = squadById    || {};
  const wd    = Number(workingDays) || 22;

  const base = useMemo(
    () => ({ alocacao: 100, ...DEFAULT_BASE_PARAMS, ...(baseParams || {}) }),
    [baseParams]
  );

  const [overrides, setOverrides] = useState({});
  const [savedOv,   setSavedOv]   = useState({});
  const [saving,    setSaving]    = useState(false);
  const [savedAt,   setSavedAt]   = useState(null);

  useEffect(() => {
    if (!periodStart || !periodEnd) return;
    const unsub = subscribeToCapacityConfig(periodStart, periodEnd, (cfg) => {
      const mo = cfg?.memberOverrides || {};
      setSavedOv(mo);
      setOverrides(mo);
    });
    return unsub;
  }, [periodStart, periodEnd]);

  const hasChanges = useMemo(
    () => JSON.stringify(overrides) !== JSON.stringify(savedOv),
    [overrides, savedOv]
  );

  const handleChange = (uid, field, raw) => {
    const val = raw === "" ? "" : Number(raw);
    setOverrides((prev) => ({
      ...prev,
      [uid]: { ...(prev[uid] || {}), [field]: val },
    }));
  };

  const handleReset = (uid) => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[uid];
      return next;
    });
  };

  const handleSave = async () => {
    if (!periodStart || !periodEnd) return;
    setSaving(true);
    try {
      await saveCapacityConfig({
        periodStart,
        periodEnd,
        workingDays: wd,
        baseParams: base,
        memberOverrides: overrides,
        updatedBy: currentUser?.uid || "unknown",
      });
      setSavedOv(overrides);
      setSavedAt(new Date());
    } catch (e) {
      console.error("Erro ao salvar overrides:", e);
    } finally {
      setSaving(false);
    }
  };

  const rows = useMemo(() => {
    return users.map((u) => {
      const uid = u.id || u.uid;
      const ov  = overrides[uid] || {};
      const resolved = {
        alocacao: ov.alocacao !== undefined ? ov.alocacao : base.alocacao,
      };
      const computed = computeMemberCapacity(wd, resolved);
      const jornada  = computeJornadaHours(u.journeyPeriods, periodStart, periodEnd);
      // CAP. REAL = bruto - ferias - folga - atestado + horaExtra (min 0)
      const capacityReal = round1(
        Math.max(
          0,
          computed.capacityBruto
            - jornada.ferias
            - jornada.folga
            - jornada.atestado
            + jornada.horaExtra
        )
      );
      const squads = membership
        ? [...(membership.get(uid) || new Set())].map((sid) => sqMap[sid]?.name || sid)
        : [];
      const isOverridden = !!overrides[uid] && Object.keys(overrides[uid]).length > 0;
      return { user: u, uid, resolved, computed, jornada, capacityReal, squads, isOverridden };
    });
  }, [users, overrides, base, wd, membership, sqMap, periodStart, periodEnd]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => {
          acc.capacityBruto += r.computed.capacityBruto;
          acc.ferias        += r.jornada.ferias;
          acc.folga         += r.jornada.folga;
          acc.atestado      += r.jornada.atestado;
          acc.horaExtra     += r.jornada.horaExtra;
          acc.capacityReal  += r.capacityReal;
          return acc;
        },
        { capacityBruto: 0, ferias: 0, folga: 0, atestado: 0, horaExtra: 0, capacityReal: 0 }
      ),
    [rows]
  );

  if (!users.length) {
    return (
      <div style={{ padding: 24, color: "var(--gray-9)", fontSize: 13 }}>
        Nenhum membro encontrado para o período selecionado.
      </div>
    );
  }

  const saveBtnActive = hasChanges && !saving && !!periodStart;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 12, color: "var(--gray-9)" }}>
          <strong>{rows.length}</strong> membros &middot; <strong>{wd}</strong> dias úteis
          {savedAt && (
            <span style={{ marginLeft: 8, color: "var(--green-9)" }}>
              {"\u2713"} Salvo às{" "}
              {savedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={!saveBtnActive}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 16px",
            borderRadius: 7,
            fontSize: 13,
            fontWeight: 600,
            background: saveBtnActive ? "var(--blue-9)" : "var(--gray-4)",
            color: saveBtnActive ? "#fff" : "var(--gray-8)",
            border: "none",
            cursor: saveBtnActive ? "pointer" : "default",
            transition: "background 0.2s",
          }}
        >
          <Save size={14} />
          {saving ? "Salvando..." : "Salvar Alterações"}
        </button>
      </div>

      {/* legend */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11, color: "var(--gray-9)" }}>
        <span>
          <span style={{ color: "var(--amber-9)", fontWeight: 700 }}>{"■"}</span>{" "}
          Override individual ativo
        </span>
        <span>{"—"}</span>
        <span>{"✏"} Alocação (%) editável por membro (padrão 100%)</span>
        <span>{"—"}</span>
        <span>Cap. Bruto = dias úteis × 8h</span>
      </div>

      {/* table */}
      <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--gray-4)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
          <thead>
            <tr>
              <th style={TH_LEFT}>MEMBRO</th>
              <th style={TH_LEFT}>SQUAD</th>
              <th
                style={{ ...TH, color: "var(--amber-10)" }}
                title="Percentual de alocação do membro no período"
              >
                {"✏"} ALOC. (%)
              </th>
              <th
                style={{ ...TH, color: "var(--blue-10)" }}
                title="Dias úteis × 8h"
              >
                CAP. BRUTO (h)
              </th>
              <th style={{ ...TH, textAlign: "center" }}>RESET</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const { user: u, uid, resolved, computed, jornada, capacityReal, squads, isOverridden } = r;
              const rowBg = isOverridden ? "var(--amber-1)" : undefined;
              return (
                <tr key={uid} style={{ background: rowBg }}>
                  {/* MEMBRO */}
                  <td style={TD_LEFT}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {isOverridden && (
                        <span style={{ color: "var(--amber-9)", fontSize: 10, fontWeight: 700 }}>{"■"}</span>
                      )}
                      <span style={{ fontWeight: 600, color: "var(--gray-12)" }}>
                        {getUserLabel(u)}
                      </span>
                    </div>
                  </td>
                  {/* SQUAD */}
                  <td style={TD_LEFT}>
                    <span style={{ fontSize: 11, color: "var(--gray-10)" }}>
                      {squads.length ? squads.join(", ") : <Dash />}
                    </span>
                  </td>
                  {/* ALOC. % */}
                  <td style={TD}>
                    <NumInput
                      value={resolved.alocacao}
                      onChange={(v) => handleChange(uid, "alocacao", v)}
                      highlight={isOverridden}
                      min={0}
                      max={200}
                      step={5}
                      title="Alocação (%)"
                    />
                  </td>
                  {/* CAP. BRUTO */}
                  <td style={TD}>
                    <Badge value={computed.capacityBruto + "h"} color="blue" />
                  </td>
                  {/* RESET */}
                  <td style={{ ...TD, textAlign: "center" }}>
                    {isOverridden ? (
                      <button
                        onClick={() => handleReset(uid)}
                        title="Remover override individual"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--gray-9)",
                          padding: 4,
                          borderRadius: 4,
                          display: "inline-flex",
                          alignItems: "center",
                        }}
                      >
                        <RotateCcw size={14} />
                      </button>
                    ) : (
                      <Dash />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td style={TD_TOTAL_LEFT} colSpan={2}>
                <strong>TOTAL ({rows.length} membros)</strong>
              </td>
              <td style={TD_TOTAL} title="Média de alocação">
                {round1(
                  rows.reduce((s, r) => s + r.resolved.alocacao, 0) / (rows.length || 1)
                )}
                {"%"}
              </td>
              <td style={{ ...TD_TOTAL, color: "var(--blue-11)" }}>
                <strong>{round1(totals.capacityBruto)}h</strong>
              </td>
              <td style={TD_TOTAL} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
