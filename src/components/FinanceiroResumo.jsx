import React, { useEffect, useState, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { loadExpenses, mergeWithDefaults, DEFAULT_CATEGORIES, REVENUE_FIELDS, subscribeToRevenue, mergeRevenueWithDefaults } from "../services/financeiroExpensesService";

function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function calcNetLine(gross, taxRate) {
  if (gross < 0) return gross;
  return Math.round(gross * (1 - taxRate / 100) * 100) / 100;
}
function fmtCurrency(v) {
  if (!v && v !== 0) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}
function fmtPct(v) {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return v.toFixed(2) + "%";
}
function numVal(s) { return parseFloat(String(s || "0").replace(",", ".")) || 0; }

const B = { padding: "6px 8px", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "var(--gray-9)", borderBottom: "2px solid var(--gray-4)", whiteSpace: "nowrap", background: "var(--gray-2)", position: "sticky", top: 0, zIndex: 2, textAlign: "right" };
const D = { padding: "5px 8px", fontSize: 12, borderBottom: "1px solid var(--gray-3)", whiteSpace: "nowrap", verticalAlign: "middle", textAlign: "right" };

const marColor = (m) => m === null ? "var(--gray-7)" : m >= 30 ? "var(--green-11)" : m >= 0 ? "var(--amber-11)" : "var(--red-11)";

export default function FinanceiroResumo({ rows, months, projectCodeOptions }) {
  const [expanded, setExpanded] = useState(new Set());
  const [expensesData, setExpensesData] = useState({});
  const [revenueData, setRevenueData] = useState({});

  useEffect(() => {
    if (!projectCodeOptions?.length) return;
    Promise.all(projectCodeOptions.map(async (code) => {
      const saved = await loadExpenses(code).catch(() => null);
      return [code, mergeWithDefaults(saved, code, months)];
    })).then((entries) => setExpensesData(Object.fromEntries(entries)));
  }, [projectCodeOptions?.join(","), months.map(m => m.ps).join(",")]);

  useEffect(() => {
    if (!projectCodeOptions?.length) return;
    const unsubs = projectCodeOptions.map((code) =>
      subscribeToRevenue(code, (saved) => {
        setRevenueData((prev) => ({ ...prev, [code]: mergeRevenueWithDefaults(saved, code, months) }));
      })
    );
    return () => unsubs.forEach((u) => u && u());
  }, [projectCodeOptions?.join(","), months.map(m => m.ps).join(",")]);

  const toggleExpand = (code) => setExpanded((prev) => {
    const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n;
  });

  const costByProject = useMemo(() => {
    const map = {};
    for (const r of rows) {
      const pc = r.user?.projectCode || "__SEM__";
      const contract = r.user?.contract || "—";
      const cl = r.classificacao;
      if (!map[pc]) map[pc] = {};
      const key = `${contract}|||${cl}`;
      if (!map[pc][key]) map[pc][key] = { contract, classificacao: cl, monthValues: months.map(() => 0) };
      r.monthValues.forEach((v, i) => { map[pc][key].monthValues[i] = r2(map[pc][key].monthValues[i] + v); });
    }
    return map;
  }, [rows, months]);

  const allCodes = useMemo(() => {
    const s = new Set([...projectCodeOptions]);
    Object.keys(costByProject).forEach((k) => { if (k !== "__SEM__") s.add(k); });
    return [...s].sort();
  }, [projectCodeOptions, costByProject]);

  function projectMonthCost(code) {
    const peopleCost = months.map((_, i) => {
      const groups = costByProject[code] || {};
      return r2(Object.values(groups).reduce((s, g) => s + (g.monthValues[i] || 0), 0));
    });
    const expData = expensesData[code];
    const expCost = months.map((mo) => {
      const mk = mo.ps.slice(0, 7);
      if (!expData?.categories) return 0;
      return r2(DEFAULT_CATEGORIES.reduce((s, cat) => {
        const fields = expData.categories[cat.name] || {};
        return s + Object.values(fields).reduce((fs, f) => fs + numVal(f?.values?.[mk]), 0);
      }, 0));
    });
    return { peopleCost, expCost, total: months.map((_, i) => r2(peopleCost[i] + expCost[i])) };
  }

  function projectMonthRevenue(code) {
    const revData = revenueData[code];
    const taxRate = revData?.taxRate ?? 5.65;
    return months.map((mo) => {
      const mk = mo.ps.slice(0, 7);
      if (!revData?.fields) return { gross: 0, net: 0 };
      const gross = REVENUE_FIELDS.reduce((s, f) => s + numVal(revData.fields[f.key]?.values?.[mk]), 0);
      const net = REVENUE_FIELDS.reduce((s, f) => {
        const g = numVal(revData.fields[f.key]?.values?.[mk]);
        return s + calcNetLine(g, taxRate);
      }, 0);
      return { gross, net: r2(net) };
    });
  }

  const grandCostTotals = months.map((_, i) => r2(allCodes.reduce((s, c) => s + projectMonthCost(c).total[i], 0)));
  const grandRevTotals = months.map((_, i) => {
    const g = allCodes.reduce((s, c) => s + projectMonthRevenue(c)[i].gross, 0);
    const n = allCodes.reduce((s, c) => s + projectMonthRevenue(c)[i].net, 0);
    return { gross: r2(g), net: r2(n) };
  });

  const CONTRACT_COLORS = {
    "Consultoria": "var(--indigo-11)",
    "GDNe": "var(--green-11)",
    "Subcontratado": "var(--orange-11)",
  };

  // ── Consolidated totals ──
  const totCosts = months.map((_, i) => r2(allCodes.reduce((s, c) => s + projectMonthCost(c).total[i], 0)));
  const totRevs = months.map((_, i) => r2(allCodes.reduce((s, c) => s + projectMonthRevenue(c)[i].net, 0)));
  const totMargins = months.map((_, i) => totRevs[i] !== 0 ? ((totRevs[i] - totCosts[i]) / totRevs[i]) * 100 : null);
  const grandCost = r2(totCosts.reduce((s, v) => s + v, 0));
  const grandRev = r2(totRevs.reduce((s, v) => s + v, 0));
  const grandMar = grandRev !== 0 ? ((grandRev - grandCost) / grandRev) * 100 : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* ── CONTRACT MARGEM — CONSOLIDADA (topo) ── */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "var(--gray-9)", textTransform: "uppercase", marginBottom: 8 }}>
          CONTRACT MARGEM — CONSOLIDADA
          <span style={{ fontSize: 10, fontWeight: 400, color: "var(--gray-7)", textTransform: "none", letterSpacing: 0, marginLeft: 8 }}>Soma de todos os projetos</span>
        </div>
        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--violet-7)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
            <thead>
              <tr style={{ background: "var(--violet-4)" }}>
                <th style={{ ...B, textAlign: "left", width: 200, background: "var(--violet-4)", color: "var(--violet-12)" }}>LINHA</th>
                {months.map((mo) => <th key={mo.ps} style={{ ...B, background: "var(--violet-4)", color: "var(--violet-12)" }}>{mo.label.toUpperCase()}</th>)}
                <th style={{ ...B, background: "var(--violet-4)", color: "var(--violet-12)" }}>TOTAL / %</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "6px 10px", fontSize: 12, fontWeight: 700, color: "var(--red-11)", borderBottom: "1px solid var(--gray-3)", textAlign: "left" }}>Custo Total</td>
                {totCosts.map((v, i) => <td key={i} style={{ ...D, color: v > 0 ? "var(--red-11)" : "var(--gray-7)", fontWeight: v > 0 ? 600 : 400 }}>{v > 0 ? fmtCurrency(v) : "—"}</td>)}
                <td style={{ ...D, background: "var(--red-2)", fontWeight: 700, color: "var(--red-11)" }}>{grandCost > 0 ? fmtCurrency(grandCost) : "—"}</td>
              </tr>
              <tr>
                <td style={{ padding: "6px 10px", fontSize: 12, fontWeight: 700, color: "var(--teal-11)", borderBottom: "1px solid var(--gray-3)", textAlign: "left" }}>Receita Total (Net)</td>
                {totRevs.map((v, i) => <td key={i} style={{ ...D, color: v !== 0 ? (v > 0 ? "var(--teal-11)" : "var(--red-11)") : "var(--gray-7)", fontWeight: v !== 0 ? 600 : 400 }}>{v !== 0 ? fmtCurrency(v) : "—"}</td>)}
                <td style={{ ...D, background: "var(--green-2)", fontWeight: 700, color: grandRev !== 0 ? (grandRev > 0 ? "var(--green-11)" : "var(--red-11)") : "var(--gray-7)" }}>{grandRev !== 0 ? fmtCurrency(grandRev) : "—"}</td>
              </tr>
              <tr style={{ background: "var(--violet-1)" }}>
                <td style={{ padding: "6px 10px", fontSize: 12, fontWeight: 700, color: "var(--violet-11)", borderBottom: "2px solid var(--violet-5)", textAlign: "left" }}>% Margem Consolidada</td>
                {totMargins.map((m, i) => <td key={i} style={{ ...D, fontSize: 13, fontWeight: m !== null ? 700 : 400, color: marColor(m), borderBottom: "2px solid var(--violet-5)" }}>{fmtPct(m)}</td>)}
                <td style={{ ...D, fontSize: 13, background: "var(--violet-3)", fontWeight: 700, color: marColor(grandMar), borderBottom: "2px solid var(--violet-5)" }}>{fmtPct(grandMar)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CONTRACT MARGEM — POR PROJETO ── */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "var(--gray-9)", textTransform: "uppercase", marginBottom: 8 }}>
          CONTRACT MARGEM — POR PROJETO
          <span style={{ fontSize: 10, fontWeight: 400, color: "var(--gray-7)", textTransform: "none", letterSpacing: 0, marginLeft: 8 }}>Custo, Receita (Gross) e Margem % por mês</span>
        </div>
        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--violet-5)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
            <thead>
              <tr style={{ background: "var(--violet-3)" }}>
                <th style={{ ...B, textAlign: "left", width: 200, background: "var(--violet-3)", color: "var(--violet-11)" }}>PROJETO / LINHA</th>
                {months.map((mo) => <th key={mo.ps} style={{ ...B, background: "var(--violet-3)", color: "var(--violet-11)" }}>{mo.label.toUpperCase()}</th>)}
                <th style={{ ...B, background: "var(--violet-3)", color: "var(--violet-11)" }}>TOTAL / %</th>
              </tr>
            </thead>
            <tbody>
              {allCodes.map((code, ci) => {
                const costs = projectMonthCost(code).total;
                const revs = projectMonthRevenue(code).map((m) => m.net);
                const margins = months.map((_, i) => revs[i] !== 0 ? ((revs[i] - costs[i]) / revs[i]) * 100 : null);
                const totalCost = r2(costs.reduce((s, v) => s + v, 0));
                const totalRev = r2(revs.reduce((s, v) => s + v, 0));
                const totalMar = totalRev !== 0 ? ((totalRev - totalCost) / totalRev) * 100 : null;
                const sep = ci > 0 ? { borderTop: "2px solid var(--violet-4)" } : {};
                return (
                  <React.Fragment key={code}>
                    <tr style={{ background: "var(--violet-2)" }}>
                      <td colSpan={months.length + 2} style={{ padding: "5px 10px", fontSize: 11, fontWeight: 700, ...sep }}>
                        <span style={{ background: "var(--amber-3)", border: "1px solid var(--amber-7)", color: "var(--amber-11)", borderRadius: 6, padding: "1px 7px" }}>{code}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: "4px 10px 4px 20px", fontSize: 11, fontWeight: 600, color: "var(--red-11)", borderBottom: "1px solid var(--gray-3)", textAlign: "left" }}>Custo</td>
                      {costs.map((v, i) => <td key={i} style={{ ...D, fontSize: 11, color: v > 0 ? "var(--red-11)" : "var(--gray-7)" }}>{v > 0 ? fmtCurrency(v) : "—"}</td>)}
                      <td style={{ ...D, fontSize: 11, background: "var(--red-2)", fontWeight: 700, color: "var(--red-11)" }}>{totalCost > 0 ? fmtCurrency(totalCost) : "—"}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "4px 10px 4px 20px", fontSize: 11, fontWeight: 600, color: "var(--teal-11)", borderBottom: "1px solid var(--gray-3)", textAlign: "left" }}>Receita (Net)</td>
                      {revs.map((v, i) => <td key={i} style={{ ...D, fontSize: 11, color: v !== 0 ? (v > 0 ? "var(--teal-11)" : "var(--red-11)") : "var(--gray-7)" }}>{v !== 0 ? fmtCurrency(v) : "—"}</td>)}
                      <td style={{ ...D, fontSize: 11, background: "var(--teal-2)", fontWeight: 700, color: totalRev !== 0 ? (totalRev > 0 ? "var(--teal-11)" : "var(--red-11)") : "var(--gray-7)" }}>{totalRev !== 0 ? fmtCurrency(totalRev) : "—"}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "4px 10px 4px 20px", fontSize: 11, fontWeight: 600, color: "var(--violet-11)", borderBottom: "2px solid var(--violet-4)", textAlign: "left" }}>% Margem</td>
                      {margins.map((m, i) => <td key={i} style={{ ...D, fontSize: 12, fontWeight: m !== null ? 700 : 400, color: marColor(m), borderBottom: "2px solid var(--violet-4)" }}>{fmtPct(m)}</td>)}
                      <td style={{ ...D, fontSize: 12, background: "var(--violet-2)", fontWeight: 700, color: marColor(totalMar), borderBottom: "2px solid var(--violet-4)" }}>{fmtPct(totalMar)}</td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* CUSTO TABLE */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "var(--gray-9)", textTransform: "uppercase", marginBottom: 8 }}>
          CUSTO
          <span style={{ fontSize: 10, fontWeight: 400, color: "var(--gray-7)", textTransform: "none", letterSpacing: 0, marginLeft: 8 }}>Pessoas (horas × CSR) + Expenses por código de projeto</span>
        </div>
        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--gray-4)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
            <thead>
              <tr>
                <th style={{ ...B, textAlign: "left", width: 240 }}>PROJETO / BREAKDOWN</th>
                {months.map((mo, i) => (
                  <th key={mo.ps} style={{ ...B, lineHeight: 1.3 }}>
                    <div>{mo.label.toUpperCase()}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--indigo-11)", marginTop: 1 }}>{grandCostTotals[i] > 0 ? fmtCurrency(grandCostTotals[i]) : "—"}</div>
                  </th>
                ))}
                <th style={{ ...B, color: "var(--indigo-11)" }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {allCodes.map((code) => {
                const isOpen = expanded.has(`cost:${code}`);
                const { peopleCost, expCost, total } = projectMonthCost(code);
                const grandTotal = r2(total.reduce((s, v) => s + v, 0));
                const groups = costByProject[code] || {};
                const expData = expensesData[code];
                return (
                  <React.Fragment key={code}>
                    <tr style={{ background: "var(--gray-2)", cursor: "pointer" }} onClick={() => toggleExpand(`cost:${code}`)}>
                      <td style={{ padding: "7px 10px", textAlign: "left", borderBottom: "1px solid var(--gray-3)", fontWeight: 700, fontSize: 12 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          <span style={{ background: "var(--amber-3)", border: "1px solid var(--amber-7)", color: "var(--amber-11)", borderRadius: 6, padding: "1px 7px", fontSize: 11 }}>{code}</span>
                        </span>
                      </td>
                      {total.map((v, i) => <td key={i} style={{ ...D, fontWeight: 700, color: v > 0 ? "var(--indigo-11)" : "var(--gray-7)" }}>{v > 0 ? fmtCurrency(v) : "—"}</td>)}
                      <td style={{ ...D, background: "var(--indigo-2)", fontWeight: 700, color: "var(--indigo-11)" }}>{grandTotal > 0 ? fmtCurrency(grandTotal) : "—"}</td>
                    </tr>
                    {isOpen && (
                      <>
                        {Object.values(groups).map((g, gi) => (
                          <tr key={gi} style={{ background: "var(--gray-1)" }}>
                            <td style={{ padding: "5px 10px 5px 28px", textAlign: "left", borderBottom: "1px solid var(--gray-3)", fontSize: 11 }}>
                              <span style={{ color: CONTRACT_COLORS[g.contract] || "var(--gray-10)", fontWeight: 600 }}>{g.contract}</span>
                              {g.classificacao !== "—" && <span style={{ color: "var(--gray-8)", marginLeft: 4 }}>· {g.classificacao}</span>}
                            </td>
                            {g.monthValues.map((v, i) => <td key={i} style={{ ...D, fontSize: 11, color: v > 0 ? "var(--gray-11)" : "var(--gray-6)" }}>{v > 0 ? fmtCurrency(v) : "—"}</td>)}
                            <td style={{ ...D, fontSize: 11 }}>{fmtCurrency(r2(g.monthValues.reduce((s, v) => s + v, 0)))}</td>
                          </tr>
                        ))}
                        {DEFAULT_CATEGORIES.map((cat) => {
                          const catMonths = months.map((mo) => {
                            const mk = mo.ps.slice(0, 7);
                            if (!expData?.categories?.[cat.name]) return 0;
                            return r2(Object.values(expData.categories[cat.name]).reduce((s, f) => s + numVal(f?.values?.[mk]), 0));
                          });
                          const catTotal = r2(catMonths.reduce((s, v) => s + v, 0));
                          if (catTotal === 0 && catMonths.every(v => v === 0)) return null;
                          return (
                            <tr key={cat.name} style={{ background: "var(--gray-1)" }}>
                              <td style={{ padding: "5px 10px 5px 28px", textAlign: "left", borderBottom: "1px solid var(--gray-3)", fontSize: 11, color: "var(--gray-10)" }}>📦 {cat.name}</td>
                              {catMonths.map((v, i) => <td key={i} style={{ ...D, fontSize: 11, color: v > 0 ? "var(--orange-11)" : "var(--gray-6)" }}>{v > 0 ? fmtCurrency(v) : "—"}</td>)}
                              <td style={{ ...D, fontSize: 11, color: "var(--orange-11)" }}>{catTotal > 0 ? fmtCurrency(catTotal) : "—"}</td>
                            </tr>
                          );
                        })}
                      </>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECEITA TABLE */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "var(--gray-9)", textTransform: "uppercase", marginBottom: 8 }}>
          RECEITA
          <span style={{ fontSize: 10, fontWeight: 400, color: "var(--gray-7)", textTransform: "none", letterSpacing: 0, marginLeft: 8 }}>Receita Net por código de projeto</span>
        </div>
        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--green-5)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
            <thead>
              <tr>
                <th style={{ ...B, textAlign: "left", width: 240, background: "var(--green-3)", color: "var(--green-11)" }}>PROJETO</th>
                {months.map((mo, i) => (
                  <th key={mo.ps} style={{ ...B, background: "var(--green-3)", color: "var(--teal-11)", lineHeight: 1.3 }}>
                    <div>{mo.label.toUpperCase()}</div>
                    <div style={{ fontSize: 9, fontWeight: 600, marginTop: 1 }}>{grandRevTotals[i].net !== 0 ? fmtCurrency(grandRevTotals[i].net) : "—"}</div>
                  </th>
                ))}
                <th style={{ ...B, background: "var(--green-3)", color: "var(--teal-11)" }}>TOTAL NET</th>
              </tr>
            </thead>
            <tbody>
              {allCodes.map((code, ci) => {
                const revMonths = projectMonthRevenue(code);
                const totalNet = r2(revMonths.reduce((s, m) => s + m.net, 0));
                return (
                  <tr key={code} style={{ background: ci % 2 === 0 ? undefined : "var(--gray-1)" }}>
                    <td style={{ padding: "6px 10px", textAlign: "left", borderBottom: "1px solid var(--gray-3)", fontSize: 11, fontWeight: 700 }}>
                      <span style={{ background: "var(--amber-3)", border: "1px solid var(--amber-7)", color: "var(--amber-11)", borderRadius: 6, padding: "1px 7px" }}>{code}</span>
                    </td>
                    {revMonths.map((m, mi) => (
                      <td key={mi} style={{ ...D, fontSize: 11, color: m.net !== 0 ? (m.net > 0 ? "var(--teal-11)" : "var(--red-11)") : "var(--gray-6)", fontWeight: m.net !== 0 ? 600 : 400 }}>{m.net !== 0 ? fmtCurrency(m.net) : "—"}</td>
                    ))}
                    <td style={{ ...D, fontSize: 11, background: "var(--teal-2)", fontWeight: 700, color: totalNet > 0 ? "var(--teal-11)" : "var(--gray-7)" }}>{totalNet > 0 ? fmtCurrency(totalNet) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
