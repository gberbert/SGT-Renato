import React, { useMemo, useState } from "react";

/** Normalize any date value → JS Date (local midnight) */
function toDate(v) {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  if (typeof v === "object" && typeof v.seconds === "number") return new Date(v.seconds * 1000);
  if (v instanceof Date) return v;
  if (typeof v === "string") return new Date(v.length === 10 ? v + "T00:00:00" : v);
  return null;
}

function formatDate(v) {
  const d = toDate(v);
  if (!d || isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function workingDaysBetween(start, end) {
  const s = toDate(start);
  const e = toDate(end);
  if (!s || !e || isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
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

function tipoColor(tipo) {
  if (!tipo) return "gray";
  const t = tipo.toLowerCase();
  if (t.includes("feria") || t.includes("féria")) return "teal";
  if (t.includes("folga")) return "cyan";
  if (t.includes("atestado")) return "orange";
  if (t.includes("hora extra") || t.includes("horaextra")) return "purple";
  return "gray";
}

function tipoLabel(tipo) {
  if (!tipo) return "—";
  const map = { "Ferias": "Férias", "ferias": "Férias" };
  return map[tipo] || tipo;
}

function Badge({ value, color }) {
  const c = color || "gray";
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 6,
      fontSize: 12, fontWeight: 700,
      background: `var(--${c}-3)`, border: `1px solid var(--${c}-6)`,
      color: `var(--${c}-11)`, whiteSpace: "nowrap",
    }}>
      {value}
    </span>
  );
}

function getUserLabel(u) {
  return u?.displayName || u?.shortName || u?.name || u?.email || u?.id || "Sem nome";
}

const TH = {
  padding: "6px 12px", fontSize: 10, fontWeight: 700,
  letterSpacing: "0.06em", color: "var(--gray-9)",
  borderBottom: "2px solid var(--gray-4)", whiteSpace: "nowrap",
  background: "var(--gray-2)", position: "sticky", top: 0, zIndex: 2,
};
const TH_LEFT = { ...TH, textAlign: "left" };
const TD = {
  padding: "7px 12px", fontSize: 12,
  borderBottom: "1px solid var(--gray-3)",
  whiteSpace: "nowrap", verticalAlign: "middle",
};
const TD_LEFT = { ...TD, textAlign: "left" };
const TD_RIGHT = { ...TD, textAlign: "right" };
const TD_CENTER = { ...TD, textAlign: "center" };

const TIPO_OPTIONS = ["Férias", "Folga", "Atestado", "Hora Extra"];

export default function JourneyControlGrid({ usersFiltered, squadById, membership }) {
  const [filterTipo, setFilterTipo] = useState(new Set());
  const [filterName, setFilterName] = useState("");

  const rows = useMemo(() => {
    const list = [];
    for (const u of (usersFiltered || [])) {
      const uid = u.id || u.uid;
      const squads = membership
        ? [...(membership.get(uid) || new Set())].map((sid) => ({
            id: sid,
            label: squadById?.[sid]?.name || squadById?.[sid]?.key || squadById?.[sid]?.sigla || sid,
          }))
        : [];
      for (const p of (Array.isArray(u.journeyPeriods) ? u.journeyPeriods : [])) {
        if (!p?.dataInicio || !p?.dataFim) continue;
        const days = workingDaysBetween(p.dataInicio, p.dataFim);
        const hours = days * 8;
        list.push({
          uid,
          name: getUserLabel(u),
          squads,
          squad: squads.map((s) => s.label).join(", ") || "—",
          tipo: tipoLabel(p.tipo || ""),
          dataInicio: p.dataInicio,
          dataFim: p.dataFim,
          days,
          hours,
          // for sorting
          _startMs: (() => { const d = toDate(p.dataInicio); return d ? d.getTime() : 0; })(),
        });
      }
    }
    // Sort by start date asc then name
    list.sort((a, b) => a._startMs - b._startMs || a.name.localeCompare(b.name, "pt-BR"));
    return list;
  }, [usersFiltered, membership, squadById]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterTipo.size > 0 && !filterTipo.has(r.tipo)) return false;
      if (filterName.trim()) {
        const term = filterName.trim().toLowerCase();
        if (!r.name.toLowerCase().includes(term) && !r.squad.toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }, [rows, filterTipo, filterName]);

  const totals = useMemo(() => {
    return filtered.reduce((acc, r) => {
      acc.days  += r.days;
      acc.hours += r.hours;
      return acc;
    }, { days: 0, hours: 0 });
  }, [filtered]);

  const toggleTipo = (t) =>
    setFilterTipo((prev) => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n; });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <input
          placeholder="Filtrar por nome ou squad..."
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
          style={{
            flex: "1 1 220px", padding: "6px 10px", fontSize: 12, borderRadius: 7,
            border: "1px solid var(--gray-5)", background: "var(--gray-2)",
            color: "var(--gray-12)", outline: "none",
          }}
        />
        {TIPO_OPTIONS.map((t) => {
          const c = tipoColor(t);
          const active = filterTipo.has(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggleTipo(t)}
              style={{
                padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                border: active ? `1px solid var(--${c}-9)` : `1px solid var(--gray-6)`,
                background: active ? `var(--${c}-3)` : "transparent",
                color: active ? `var(--${c}-11)` : "var(--gray-10)",
                cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
              }}
            >
              {t}
            </button>
          );
        })}
        {(filterTipo.size > 0 || filterName.trim()) && (
          <button
            type="button"
            onClick={() => { setFilterTipo(new Set()); setFilterName(""); }}
            style={{
              padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700,
              border: "1px solid var(--red-7)", background: "var(--red-3)",
              color: "var(--red-11)", cursor: "pointer",
            }}
          >
            ✕ Limpar
          </button>
        )}
        <span style={{ fontSize: 12, color: "var(--gray-9)", marginLeft: "auto", whiteSpace: "nowrap" }}>
          <strong>{filtered.length}</strong> registro{filtered.length !== 1 ? "s" : ""}
          {" · "}<strong>{totals.days}</strong> dias úteis
          {" · "}<strong>{totals.hours}</strong>h
        </span>
      </div>

      {/* table */}
      <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--gray-4)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
          <thead>
            <tr>
              <th style={TH_LEFT}>NOME</th>
              <th style={TH_LEFT}>SQUAD</th>
              <th style={{ ...TH, textAlign: "center" }}>TIPO</th>
              <th style={{ ...TH, textAlign: "center" }}>INÍCIO</th>
              <th style={{ ...TH, textAlign: "center" }}>FIM</th>
              <th style={{ ...TH, textAlign: "right" }}>DIAS ÚTEIS</th>
              <th style={{ ...TH, textAlign: "right" }}>HORAS</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...TD_CENTER, padding: 32, color: "var(--gray-8)" }}>
                  Nenhum registro de jornada encontrado.
                </td>
              </tr>
            )}
            {filtered.map((r, i) => {
              const c = tipoColor(r.tipo);
              return (
                <tr
                  key={i}
                  style={{ background: i % 2 === 0 ? undefined : "var(--gray-1)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--gray-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "" : "var(--gray-1)")}
                >
                  <td style={TD_LEFT}>
                    <span style={{ fontWeight: 600, color: "var(--gray-12)" }}>{r.name}</span>
                  </td>
                  <td style={TD_LEFT}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {r.squads && r.squads.length > 0
                        ? r.squads.map((sq) => (
                          <span key={sq.id} style={{
                            display: "inline-block", padding: "2px 8px", borderRadius: 999,
                            fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", whiteSpace: "nowrap",
                            background: "var(--cyan-3)", border: "1px solid var(--cyan-7)", color: "var(--cyan-11)",
                          }}>{sq.label.toUpperCase()}</span>
                        ))
                        : <span style={{ color: "var(--gray-7)", fontSize: 11 }}>—</span>}
                    </div>
                  </td>
                  <td style={TD_CENTER}>
                    <Badge value={r.tipo} color={c} />
                  </td>
                  <td style={TD_CENTER}>
                    <span style={{ fontSize: 12, color: "var(--gray-11)", fontVariantNumeric: "tabular-nums" }}>
                      {formatDate(r.dataInicio)}
                    </span>
                  </td>
                  <td style={TD_CENTER}>
                    <span style={{ fontSize: 12, color: "var(--gray-11)", fontVariantNumeric: "tabular-nums" }}>
                      {formatDate(r.dataFim)}
                    </span>
                  </td>
                  <td style={TD_RIGHT}>
                    <span style={{ fontWeight: 600, color: `var(--${c}-11)` }}>{r.days}</span>
                  </td>
                  <td style={TD_RIGHT}>
                    <Badge value={r.hours + "h"} color={c} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr>
                <td
                  colSpan={5}
                  style={{
                    ...TD_LEFT,
                    fontWeight: 700,
                    background: "var(--gray-2)",
                    borderTop: "2px solid var(--gray-5)",
                  }}
                >
                  TOTAL ({filtered.length} registros)
                </td>
                <td style={{ ...TD_RIGHT, fontWeight: 700, background: "var(--gray-2)", borderTop: "2px solid var(--gray-5)", color: "var(--gray-11)" }}>
                  {totals.days}
                </td>
                <td style={{ ...TD_RIGHT, fontWeight: 700, background: "var(--gray-2)", borderTop: "2px solid var(--gray-5)" }}>
                  <Badge value={totals.hours + "h"} color="gray" />
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
