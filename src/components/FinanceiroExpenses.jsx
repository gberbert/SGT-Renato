import React, { useEffect, useState, useCallback } from "react";
import { Save, ChevronDown, ChevronRight, Plus } from "lucide-react";
import {
  DEFAULT_CATEGORIES,
  subscribeToExpenses,
  saveExpenses,
  mergeWithDefaults,
} from "../services/financeiroExpensesService";

const CAT_COLORS = {
  "Internal Charges Cost": { bg: "var(--indigo-2)", border: "var(--indigo-6)", text: "var(--indigo-11)", hdr: "var(--indigo-3)" },
  "Purchases and Others Cost": { bg: "var(--orange-2)", border: "var(--orange-6)", text: "var(--orange-11)", hdr: "var(--orange-3)" },
  "Travel Expenses Cost": { bg: "var(--teal-2)", border: "var(--teal-6)", text: "var(--teal-11)", hdr: "var(--teal-3)" },
};

function fmtCurrency(v) {
  if (!v && v !== 0) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function numVal(s) { return parseFloat(String(s || "0").replace(",", ".")) || 0; }

export default function FinanceiroExpenses({ projectCodes, months, readOnly = false }) {
  const [selectedCode, setSelectedCode] = useState("__TODOS__");
  const [data, setData] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [allData, setAllData] = useState({});

  // Subscribe to all codes for TODOS view
  useEffect(() => {
    if (!projectCodes?.length) return;
    const unsubs = projectCodes.map((code) =>
      subscribeToExpenses(code, (saved) => {
        setAllData((prev) => ({ ...prev, [code]: mergeWithDefaults(saved, code, months) }));
      })
    );
    return () => unsubs.forEach((u) => u && u());
  }, [projectCodes?.join(","), months.map((m) => m.ps).join(",")]);

  // Subscribe to individual code for editing
  useEffect(() => {
    if (!selectedCode || selectedCode === "__TODOS__") { setData(null); return; }
    const unsub = subscribeToExpenses(selectedCode, (saved) => {
      setData(mergeWithDefaults(saved, selectedCode, months));
      setDirty(false);
    });
    return () => unsub();
  }, [selectedCode, months.map(m => m.ps).join(",")]);

  const setFieldLabel = useCallback((catName, fieldKey, label) => {
    setData((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next.categories[catName][fieldKey].label = label;
      return next;
    });
    setDirty(true);
  }, []);

  const setFieldValue = useCallback((catName, fieldKey, monthKey, value) => {
    setData((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next.categories[catName][fieldKey].values[monthKey] = numVal(value);
      return next;
    });
    setDirty(true);
  }, []);

  const toggleCat = (catName) => setCollapsed((p) => ({ ...p, [catName]: !p[catName] }));

  const handleSave = async () => {
    if (!selectedCode || !data) return;
    setSaving(true);
    try { await saveExpenses(selectedCode, data); setDirty(false); }
    catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  // Compute column totals per category
  function catMonthTotals(catName) {
    if (!data?.categories?.[catName]) return months.map(() => 0);
    const catFields = DEFAULT_CATEGORIES.find(c => c.name === catName)?.fields || [];
    return months.map(mo => {
      const mk = mo.ps.slice(0, 7);
      return catFields.reduce((sum, f) => sum + numVal(data.categories[catName][f.key]?.values?.[mk]), 0);
    });
  }

  function grandTotals() {
    return months.map((mo, i) =>
      DEFAULT_CATEGORIES.reduce((sum, cat) => sum + catMonthTotals(cat.name)[i], 0)
    );
  }

  if (projectCodes.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--gray-8)", fontSize: 14 }}>
        Nenhum código de projeto encontrado. Configure os projetos nos dados dos membros do time.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Project selector + Save */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-10)", whiteSpace: "nowrap" }}>Código do Projeto:</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button type="button" onClick={() => setSelectedCode("__TODOS__")} style={{ padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", border: selectedCode === "__TODOS__" ? "1px solid var(--indigo-7)" : "1px solid var(--gray-6)", background: selectedCode === "__TODOS__" ? "var(--indigo-3)" : "var(--gray-2)", color: selectedCode === "__TODOS__" ? "var(--indigo-11)" : "var(--gray-10)", transition: "all 0.15s" }}>TODOS</button>
          {projectCodes.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setSelectedCode(code)}
              style={{
                padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer",
                border: selectedCode === code ? "1px solid var(--amber-7)" : "1px solid var(--gray-6)",
                background: selectedCode === code ? "var(--amber-3)" : "var(--gray-2)",
                color: selectedCode === code ? "var(--amber-11)" : "var(--gray-10)",
                transition: "all 0.15s",
              }}
            >
              {code}
            </button>
          ))}
        </div>
        {readOnly && (
          <span style={{ fontSize: 11, color: "var(--red-11)", fontWeight: 600, background: "var(--red-2)", border: "1px solid var(--red-6)", padding: "3px 10px", borderRadius: 6 }}>
            🔒 Leitura — controle fechado
          </span>
        )}
        {!readOnly && dirty && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 16px", borderRadius: 7, fontSize: 12, fontWeight: 700,
              border: "none", background: "var(--indigo-9)", color: "white",
              cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
            }}
          >
            <Save size={13} />
            {saving ? "Salvando…" : "Salvar alterações"}
          </button>
        )}
      </div>

      {selectedCode === "__TODOS__" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 11, color: "var(--gray-8)" }}>Totais agregados por categoria — somente leitura. Selecione um projeto para editar.</div>
          {DEFAULT_CATEGORIES.map((cat) => {
            const colors = CAT_COLORS[cat.name] || CAT_COLORS["Internal Charges Cost"];
            const catMonthTotals = months.map((mo) => {
              const mk = mo.ps.slice(0, 7);
              return projectCodes.reduce((sum, code) => {
                const d = allData[code];
                if (!d?.categories?.[cat.name]) return sum;
                return sum + cat.fields.reduce((fs, f) => fs + numVal(d.categories[cat.name][f.key]?.values?.[mk]), 0);
              }, 0);
            });
            const catTotal = catMonthTotals.reduce((s, v) => s + v, 0);
            return (
              <div key={cat.name} style={{ borderRadius: 10, border: `1px solid ${colors.border}`, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: colors.hdr, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: colors.text }}>{cat.name}</span>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginLeft: 8 }}>
                    {catMonthTotals.map((v, i) => (
                      <div key={i} style={{ textAlign: "center", minWidth: 70 }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: colors.text, opacity: 0.7 }}>{months[i].label.toUpperCase()}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: v > 0 ? colors.text : "var(--gray-7)" }}>{v > 0 ? fmtCurrency(v) : "—"}</div>
                      </div>
                    ))}
                    <div style={{ textAlign: "center", minWidth: 70, borderLeft: `1px solid ${colors.border}`, paddingLeft: 8 }}>
                      <div style={{ fontSize: 9, fontWeight: 600, color: colors.text, opacity: 0.7 }}>TOTAL</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: catTotal > 0 ? colors.text : "var(--gray-7)" }}>{catTotal > 0 ? fmtCurrency(catTotal) : "—"}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : !data ? (
        <div style={{ padding: 32, textAlign: "center", color: "var(--gray-7)" }}>Carregando…</div>
      ) : (
        <>
          {/* Grand total row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "var(--gray-3)", border: "1px solid var(--gray-5)", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--gray-11)", marginRight: 8 }}>TOTAL GERAL</span>
            {months.map((mo, i) => {
              const tot = grandTotals()[i];
              return (
                <div key={mo.ps} style={{ textAlign: "center", minWidth: 80 }}>
                  <div style={{ fontSize: 10, color: "var(--gray-9)", fontWeight: 600 }}>{mo.label.toUpperCase()}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: tot > 0 ? "var(--indigo-11)" : "var(--gray-7)" }}>
                    {tot > 0 ? fmtCurrency(tot) : "—"}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Categories */}
          {DEFAULT_CATEGORIES.map((cat) => {
            const colors = CAT_COLORS[cat.name] || CAT_COLORS["Internal Charges Cost"];
            const isCollapsed = !!collapsed[cat.name];
            const monthTots = catMonthTotals(cat.name);

            return (
              <div key={cat.name} style={{ borderRadius: 10, border: `1px solid ${colors.border}`, overflow: "hidden" }}>
                {/* Category header */}
                <div
                  onClick={() => toggleCat(cat.name)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                    background: colors.hdr, cursor: "pointer", flexWrap: "wrap",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, color: colors.text, flex: "0 0 auto" }}>
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    {cat.name}
                  </span>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginLeft: 8 }}>
                    {months.map((mo, i) => (
                      <div key={mo.ps} style={{ textAlign: "center", minWidth: 70 }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: colors.text, opacity: 0.7 }}>{mo.label.toUpperCase()}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: monthTots[i] > 0 ? colors.text : "var(--gray-7)" }}>
                          {monthTots[i] > 0 ? fmtCurrency(monthTots[i]) : "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fields table */}
                {!isCollapsed && (
                  <div style={{ background: colors.bg }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: `${colors.hdr}99` }}>
                          <th style={{ padding: "5px 10px", fontSize: 9, fontWeight: 700, color: colors.text, textAlign: "left", width: 240, letterSpacing: "0.06em" }}>DESCRIÇÃO (CLIQUE PARA EDITAR)</th>
                          {months.map((mo) => (
                            <th key={mo.ps} style={{ padding: "5px 8px", fontSize: 9, fontWeight: 700, color: colors.text, textAlign: "right", letterSpacing: "0.06em" }}>{mo.label.toUpperCase()}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {cat.fields.map((f, fi) => {
                          const fieldData = data.categories[cat.name]?.[f.key];
                          if (!fieldData) return null;
                          return (
                            <tr key={f.key} style={{ borderTop: fi > 0 ? `1px solid ${colors.border}44` : "none" }}>
                              <td style={{ padding: "6px 10px" }}>
                                <input
                                  type="text"
                                  value={fieldData.label}
                                  onChange={(e) => setFieldLabel(cat.name, f.key, e.target.value)}
                                  style={{
                                    width: "100%", padding: "3px 7px", fontSize: 12, borderRadius: 5,
                                    border: `1px solid ${colors.border}66`, background: "transparent",
                                    color: "var(--gray-12)", outline: "none", fontWeight: 500,
                                  }}
                                  onFocus={(e) => { e.target.style.borderColor = colors.border; e.target.style.background = "rgba(255,255,255,0.08)"; }}
                                  onBlur={(e) => { e.target.style.borderColor = `${colors.border}66`; e.target.style.background = "transparent"; }}
                                />
                              </td>
                              {months.map((mo) => {
                                const mk = mo.ps.slice(0, 7);
                                const val = fieldData.values?.[mk] ?? 0;
                                return (
                                  <td key={mo.ps} style={{ padding: "4px 6px", textAlign: "right" }}>
                                    <input
                                      type="number"
                                      min={0}
                                      value={val || ""}
                                      placeholder="0"
                                      onChange={(e) => setFieldValue(cat.name, f.key, mk, e.target.value)}
                                      style={{
                                        width: 90, padding: "3px 7px", fontSize: 12, borderRadius: 5,
                                        border: `1px solid ${colors.border}66`, background: "transparent",
                                        color: val > 0 ? colors.text : "var(--gray-9)", textAlign: "right",
                                        outline: "none", fontWeight: val > 0 ? 700 : 400,
                                      }}
                                      onFocus={(e) => { e.target.style.borderColor = colors.border; e.target.style.background = "rgba(255,255,255,0.08)"; }}
                                      onBlur={(e) => { e.target.style.borderColor = `${colors.border}66`; e.target.style.background = "transparent"; }}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
