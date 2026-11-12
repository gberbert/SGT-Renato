import React, { useEffect, useState, useCallback } from "react";
import { Save } from "lucide-react";
import {
  REVENUE_FIELDS,
  subscribeToRevenue,
  saveRevenue,
  mergeRevenueWithDefaults,
} from "../services/financeiroExpensesService";

function fmtCurrency(v) {
  if (!v && v !== 0) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}
function numVal(s) { return parseFloat(String(s || "0").replace(",", ".")) || 0; }
function calcNet(gross, taxRate) {
  if (gross < 0) return gross; // negative gross: net = gross (no tax deduction)
  return Math.round(gross * (1 - taxRate / 100) * 100) / 100;
}

export default function FinanceiroReceita({ projectCodes, months, readOnly = false }) {
  const [selectedCode, setSelectedCode] = useState("__TODOS__");
  const [data, setData] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allData, setAllData] = useState({});
  const [colMode, setColMode] = useState("both"); // "both" | "gross" | "net"

  // Subscribe to all codes for TODOS view
  useEffect(() => {
    if (!projectCodes?.length) return;
    const unsubs = projectCodes.map((code) =>
      subscribeToRevenue(code, (saved) => {
        setAllData((prev) => ({ ...prev, [code]: mergeRevenueWithDefaults(saved, code, months) }));
      })
    );
    return () => unsubs.forEach((u) => u && u());
  }, [projectCodes?.join(","), months.map((m) => m.ps).join(",")]);

  // Subscribe to individual code for editing
  useEffect(() => {
    if (!selectedCode || selectedCode === "__TODOS__") { setData(null); return; }
    const unsub = subscribeToRevenue(selectedCode, (saved) => {
      setData(mergeRevenueWithDefaults(saved, selectedCode, months));
      setDirty(false);
    });
    return () => unsub();
  }, [selectedCode, months.map((m) => m.ps).join(",")]);

  const setFieldLabel = useCallback((fieldKey, label) => {
    setData((prev) => { const next = JSON.parse(JSON.stringify(prev)); next.fields[fieldKey].label = label; return next; });
    setDirty(true);
  }, []);

  const setFieldValue = useCallback((fieldKey, monthKey, value) => {
    setData((prev) => { const next = JSON.parse(JSON.stringify(prev)); next.fields[fieldKey].values[monthKey] = numVal(value); return next; });
    setDirty(true);
  }, []);

  const setTaxRate = useCallback((v) => {
    setData((prev) => { const next = JSON.parse(JSON.stringify(prev)); next.taxRate = numVal(v); return next; });
    setDirty(true);
  }, []);

  const handleSave = async () => {
    if (!selectedCode || !data) return;
    setSaving(true);
    try { await saveRevenue(selectedCode, data); setDirty(false); }
    catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  if (projectCodes.length === 0) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--gray-8)", fontSize: 14 }}>Nenhum código de projeto encontrado.</div>;
  }

  const taxRate = data?.taxRate ?? 5.65;

  function monthTotals(mi) {
    if (!data?.fields) return { gross: 0, net: 0 };
    const mk = months[mi].ps.slice(0, 7);
    const gross = REVENUE_FIELDS.reduce((s, f) => s + numVal(data.fields[f.key]?.values?.[mk]), 0);
    // Sum individual NETs (respects the negative rule per field)
    const net = REVENUE_FIELDS.reduce((s, f) => {
      const g = numVal(data.fields[f.key]?.values?.[mk]);
      return s + calcNet(g, taxRate);
    }, 0);
    return { gross, net };
  }

  // Project selector bar (shared)
  const SelectorBar = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-10)", whiteSpace: "nowrap" }}>Código do Projeto:</label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" onClick={() => setSelectedCode("__TODOS__")} style={{ padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", border: selectedCode === "__TODOS__" ? "1px solid var(--indigo-7)" : "1px solid var(--gray-6)", background: selectedCode === "__TODOS__" ? "var(--indigo-3)" : "var(--gray-2)", color: selectedCode === "__TODOS__" ? "var(--indigo-11)" : "var(--gray-10)", transition: "all 0.15s" }}>TODOS</button>
        {projectCodes.map((code) => (
          <button key={code} type="button" onClick={() => setSelectedCode(code)} style={{ padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", border: selectedCode === code ? "1px solid var(--amber-7)" : "1px solid var(--gray-6)", background: selectedCode === code ? "var(--amber-3)" : "var(--gray-2)", color: selectedCode === code ? "var(--amber-11)" : "var(--gray-10)", transition: "all 0.15s" }}>{code}</button>
        ))}
      </div>
    </div>
  );

  if (selectedCode === "__TODOS__") {
    // Aggregate gross/net per field key across all project codes
    function aggField(fKey, moIdx) {
      const mk = months[moIdx].ps.slice(0, 7);
      let gross = 0, net = 0;
      for (const code of projectCodes) {
        const d = allData[code];
        if (!d?.fields) continue;
        const g = numVal(d.fields[fKey]?.values?.[mk]);
        gross += g;
        net += calcNet(g, d.taxRate ?? 5.65);
      }
      return { gross, net };
    }
    function aggTotals(moIdx) {
      let gross = 0, net = 0;
      for (const f of REVENUE_FIELDS) {
        const a = aggField(f.key, moIdx);
        gross += a.gross; net += a.net;
      }
      return { gross, net };
    }
    // Get label for a field: use first project that has a non-default label, else first available
    function getLabel(fKey, defaultLabel) {
      for (const code of projectCodes) {
        const lbl = allData[code]?.fields?.[fKey]?.label;
        if (lbl && lbl !== defaultLabel && lbl !== fKey) return lbl;
      }
      for (const code of projectCodes) {
        const lbl = allData[code]?.fields?.[fKey]?.label;
        if (lbl) return lbl;
      }
      return defaultLabel || fKey;
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <SelectorBar />
          <div style={{ display: "flex", borderRadius: 7, border: "1px solid var(--gray-6)", overflow: "hidden", marginLeft: 8 }}>
            {[{ id: "both", label: "G + N" }, { id: "gross", label: "Gross" }, { id: "net", label: "Net" }].map((m) => (
              <button key={m.id} type="button" onClick={() => setColMode(m.id)} style={{ padding: "3px 10px", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", background: colMode === m.id ? "var(--green-9)" : "var(--gray-2)", color: colMode === m.id ? "white" : "var(--gray-10)", transition: "all 0.15s" }}>{m.label}</button>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 11, color: "var(--gray-8)" }}>Totais agregados por linha — somente leitura. Selecione um projeto para editar.</div>
        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--green-6)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr style={{ background: "var(--green-3)" }}>
                <th style={{ padding: "7px 12px", fontSize: 9, fontWeight: 700, color: "var(--green-11)", textAlign: "left", width: 240, borderBottom: "2px solid var(--green-6)", position: "sticky", top: 0, zIndex: 2, background: "var(--green-3)", whiteSpace: "nowrap" }}>DESCRIÇÃO</th>
                {months.map((mo, i) => {
                  const { gross, net } = aggTotals(i);
                  const span = colMode === "both" ? 2 : 1;
                  const disp = colMode === "net" ? (net !== 0 ? fmtCurrency(net) : "—") : (gross !== 0 ? fmtCurrency(gross) : "—");
                  const disp2 = colMode === "both" && net !== 0 ? ` · N:${fmtCurrency(net)}` : "";
                  return (
                    <th key={mo.ps} colSpan={span} style={{ padding: "5px 8px", fontSize: 9, fontWeight: 700, color: "var(--green-11)", textAlign: "center", borderBottom: "2px solid var(--green-6)", position: "sticky", top: 0, zIndex: 2, background: "var(--green-3)", whiteSpace: "nowrap", lineHeight: 1.3 }}>
                      <div>{mo.label.toUpperCase()}</div>
                      <div style={{ fontSize: 9, opacity: 0.8 }}>{disp}{colMode === "both" ? disp2 : ""}</div>
                    </th>
                  );
                })}
              </tr>
              {colMode === "both" && (
                <tr style={{ background: "var(--green-2)" }}>
                  <th style={{ padding: "3px 12px", fontSize: 8, borderBottom: "1px solid var(--green-5)", textAlign: "left" }} />
                  {months.map((mo) => (
                    <React.Fragment key={mo.ps}>
                      <th style={{ padding: "3px 6px", fontSize: 8, fontWeight: 700, color: "var(--green-10)", textAlign: "right", borderBottom: "1px solid var(--green-5)", whiteSpace: "nowrap" }}>GROSS</th>
                      <th style={{ padding: "3px 6px", fontSize: 8, fontWeight: 700, color: "var(--teal-10)", textAlign: "right", borderBottom: "1px solid var(--green-5)", whiteSpace: "nowrap" }}>NET</th>
                    </React.Fragment>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {REVENUE_FIELDS.map((f, fi) => {
                const label = getLabel(f.key, f.defaultLabel || f.key);
                return (
                  <tr key={f.key} style={{ background: fi % 2 === 0 ? "var(--green-1)" : undefined, borderTop: "1px solid var(--green-4)" }}>
                    <td style={{ padding: "5px 12px", fontSize: 12, fontWeight: 500, color: "var(--gray-12)" }}>{label}</td>
                    {months.map((mo, mi) => {
                      const { gross, net } = aggField(f.key, mi);
                      const grossColor = gross !== 0 ? (gross > 0 ? "var(--green-11)" : "var(--red-11)") : "var(--gray-9)";
                      const netColor = net !== 0 ? (net > 0 ? "var(--teal-11)" : "var(--red-11)") : "var(--gray-7)";
                      return (
                        <React.Fragment key={mo.ps}>
                          {colMode !== "net" && (
                            <td style={{ padding: "4px 6px", textAlign: "right" }}>
                              <span style={{ fontSize: 12, fontWeight: gross !== 0 ? 700 : 400, color: grossColor, fontVariantNumeric: "tabular-nums" }}>
                                {gross !== 0 ? fmtCurrency(gross) : "—"}
                              </span>
                            </td>
                          )}
                          {colMode !== "gross" && (
                            <td style={{ padding: "4px 6px", textAlign: "right" }}>
                              <span style={{ fontSize: 12, fontWeight: net !== 0 ? 600 : 400, color: netColor, fontVariantNumeric: "tabular-nums" }}>
                                {net !== 0 ? fmtCurrency(net) : "—"}
                              </span>
                            </td>
                          )}
                        </React.Fragment>
                      );
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <SelectorBar />
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--gray-10)", whiteSpace: "nowrap" }}>Imposto (%):</label>
          <input type="number" min={0} max={100} step={0.01} value={data?.taxRate ?? 5.65} onChange={(e) => setTaxRate(e.target.value)} style={{ width: 72, padding: "3px 7px", fontSize: 12, borderRadius: 5, border: "1px solid var(--violet-6)", background: "var(--violet-2)", color: "var(--gray-12)", fontWeight: 700, outline: "none" }} />
          <span style={{ fontSize: 11, color: "var(--gray-9)" }}>Net = Gross × (1 − {(data?.taxRate ?? 5.65).toFixed(2)}%)</span>
        </div>
        <div style={{ display: "flex", borderRadius: 7, border: "1px solid var(--gray-6)", overflow: "hidden", marginLeft: 8 }}>
          {[{ id: "both", label: "G + N" }, { id: "gross", label: "Gross" }, { id: "net", label: "Net" }].map((m) => (
            <button key={m.id} type="button" onClick={() => setColMode(m.id)} style={{ padding: "3px 10px", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", background: colMode === m.id ? "var(--green-9)" : "var(--gray-2)", color: colMode === m.id ? "white" : "var(--gray-10)", transition: "all 0.15s", letterSpacing: "0.03em" }}>{m.label}</button>
          ))}
        </div>
        {readOnly && (
          <span style={{ fontSize: 11, color: "var(--red-11)", fontWeight: 600, background: "var(--red-2)", border: "1px solid var(--red-6)", padding: "3px 10px", borderRadius: 6 }}>
            🔒 Leitura — controle fechado
          </span>
        )}
        {!readOnly && dirty && (
          <button type="button" onClick={handleSave} disabled={saving} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 16px", borderRadius: 7, fontSize: 12, fontWeight: 700, border: "none", background: "var(--indigo-9)", color: "white", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
            <Save size={13} /> {saving ? "Salvando…" : "Salvar alterações"}
          </button>
        )}
      </div>

      {!data ? (
        <div style={{ padding: 32, textAlign: "center", color: "var(--gray-7)" }}>Carregando…</div>
      ) : (
        <>
          <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--green-6)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead>
                <tr style={{ background: "var(--green-3)" }}>
                  <th style={{ padding: "7px 12px", fontSize: 9, fontWeight: 700, color: "var(--green-11)", textAlign: "left", width: 240, borderBottom: "2px solid var(--green-6)", position: "sticky", top: 0, zIndex: 2, background: "var(--green-3)", whiteSpace: "nowrap" }}>DESCRIÇÃO</th>
                  {months.map((mo, i) => {
                    const { gross, net } = monthTotals(i);
                    const span = colMode === "both" ? 2 : 1;
                    const disp = colMode === "net" ? (net !== 0 ? fmtCurrency(net) : "—") : (gross !== 0 ? fmtCurrency(gross) : "—");
                    const disp2 = colMode === "net" ? "" : (net !== 0 ? ` · N:${fmtCurrency(net)}` : "");
                    return (
                      <th key={mo.ps} colSpan={span} style={{ padding: "5px 8px", fontSize: 9, fontWeight: 700, color: "var(--green-11)", textAlign: "center", borderBottom: "2px solid var(--green-6)", position: "sticky", top: 0, zIndex: 2, background: "var(--green-3)", whiteSpace: "nowrap", lineHeight: 1.3 }}>
                        <div>{mo.label.toUpperCase()}</div>
                        <div style={{ fontSize: 9, opacity: 0.8 }}>{disp}{colMode === "both" ? disp2 : ""}</div>
                      </th>
                    );
                  })}
                </tr>
                {colMode === "both" && (
                  <tr style={{ background: "var(--green-2)" }}>
                    <th style={{ padding: "3px 12px", fontSize: 8, borderBottom: "1px solid var(--green-5)", textAlign: "left" }} />
                    {months.map((mo) => (
                      <React.Fragment key={mo.ps}>
                        <th style={{ padding: "3px 6px", fontSize: 8, fontWeight: 700, color: "var(--green-10)", textAlign: "right", borderBottom: "1px solid var(--green-5)", whiteSpace: "nowrap" }}>GROSS</th>
                        <th style={{ padding: "3px 6px", fontSize: 8, fontWeight: 700, color: "var(--teal-10)", textAlign: "right", borderBottom: "1px solid var(--green-5)", whiteSpace: "nowrap" }}>NET</th>
                      </React.Fragment>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody>
                {REVENUE_FIELDS.map((f, fi) => {
                  const fieldData = data.fields?.[f.key];
                  if (!fieldData) return null;
                  return (
                    <tr key={f.key} style={{ background: fi % 2 === 0 ? "var(--green-1)" : undefined, borderTop: "1px solid var(--green-4)" }}>
                      <td style={{ padding: "5px 10px" }}>
                        <input type="text" value={fieldData.label} onChange={(e) => setFieldLabel(f.key, e.target.value)}
                          style={{ width: "100%", padding: "3px 7px", fontSize: 12, borderRadius: 5, border: "1px solid var(--green-5)", background: "transparent", color: "var(--gray-12)", outline: "none", fontWeight: 500 }}
                          onFocus={(e) => { e.target.style.borderColor = "var(--green-7)"; e.target.style.background = "rgba(255,255,255,0.08)"; }}
                          onBlur={(e) => { e.target.style.borderColor = "var(--green-5)"; e.target.style.background = "transparent"; }}
                        />
                      </td>
                      {months.map((mo) => {
                        const mk = mo.ps.slice(0, 7);
                        const gross = numVal(fieldData.values?.[mk]);
                        const net = calcNet(gross, taxRate);
                        const grossColor = gross !== 0 ? (gross > 0 ? "var(--green-11)" : "var(--red-11)") : "var(--gray-9)";
                        const netColor = net !== 0 ? (net > 0 ? "var(--teal-11)" : "var(--red-11)") : "var(--gray-7)";
                        return (
                          <React.Fragment key={mo.ps}>
                            {colMode !== "net" && (
                              <td style={{ padding: "4px 6px", textAlign: "right" }}>
                                <input type="number" value={gross || ""} placeholder="0"
                                  onChange={(e) => setFieldValue(f.key, mk, e.target.value)}
                                  style={{ width: 100, padding: "3px 7px", fontSize: 12, borderRadius: 5, border: "1px solid var(--green-5)", background: "transparent", color: grossColor, textAlign: "right", outline: "none", fontWeight: gross !== 0 ? 700 : 400 }}
                                  onFocus={(e) => { e.target.style.borderColor = "var(--green-7)"; e.target.style.background = "rgba(255,255,255,0.08)"; }}
                                  onBlur={(e) => { e.target.style.borderColor = "var(--green-5)"; e.target.style.background = "transparent"; }}
                                />
                              </td>
                            )}
                            {colMode !== "gross" && (
                              <td style={{ padding: "4px 6px", textAlign: "right" }}>
                                <span style={{ fontSize: 12, fontWeight: net !== 0 ? 600 : 400, color: netColor, fontVariantNumeric: "tabular-nums" }}>
                                  {net !== 0 ? fmtCurrency(net) : "—"}
                                </span>
                              </td>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
