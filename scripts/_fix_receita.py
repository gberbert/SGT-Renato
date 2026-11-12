import sys

with open('src/components/FinanceiroReceita.jsx', 'r') as f:
    content = f.read()

marker = 'fontSize: 9, color: "var\n'

idx = content.rfind(marker)
if idx == -1:
    print("Marker not found")
    sys.exit(1)

tail = '''                  <div style={{ fontSize: 9, color: "var(--gray-7)", marginTop: 1 }}>Gross | Net</div>
                </div>
              );
            })}
          </div>

          <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--green-6)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead>
                <tr style={{ background: "var(--green-3)" }}>
                  <th style={{ padding: "7px 12px", fontSize: 9, fontWeight: 700, color: "var(--green-11)", textAlign: "left", width: 240, borderBottom: "2px solid var(--green-6)", position: "sticky", top: 0, zIndex: 2, background: "var(--green-3)", whiteSpace: "nowrap" }}>DESCRIÇÃO</th>
                  {months.map((mo, i) => {
                    const { gross, net } = monthTotals(i);
                    return (
                      <th key={mo.ps} colSpan={2} style={{ padding: "5px 8px", fontSize: 9, fontWeight: 700, color: "var(--green-11)", textAlign: "center", borderBottom: "2px solid var(--green-6)", position: "sticky", top: 0, zIndex: 2, background: "var(--green-3)", whiteSpace: "nowrap", lineHeight: 1.3 }}>
                        <div>{mo.label.toUpperCase()}</div>
                        <div style={{ fontSize: 9, opacity: 0.8 }}>{gross > 0 ? fmtCurrency(gross) : "—"} · Net: {net > 0 ? fmtCurrency(net) : "—"}</div>
                      </th>
                    );
                  })}
                </tr>
                <tr style={{ background: "var(--green-2)" }}>
                  <th style={{ padding: "3px 12px", fontSize: 8, borderBottom: "1px solid var(--green-5)", textAlign: "left" }} />
                  {months.map((mo) => (
                    <React.Fragment key={mo.ps}>
                      <th style={{ padding: "3px 6px", fontSize: 8, fontWeight: 700, color: "var(--green-10)", textAlign: "right", borderBottom: "1px solid var(--green-5)", whiteSpace: "nowrap" }}>GROSS</th>
                      <th style={{ padding: "3px 6px", fontSize: 8, fontWeight: 700, color: "var(--teal-10)", textAlign: "right", borderBottom: "1px solid var(--green-5)", whiteSpace: "nowrap" }}>NET</th>
                    </React.Fragment>
                  ))}
                </tr>
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
                        return (
                          <React.Fragment key={mo.ps}>
                            <td style={{ padding: "4px 6px", textAlign: "right" }}>
                              <input type="number" min={0} value={gross || ""} placeholder="0"
                                onChange={(e) => setFieldValue(f.key, mk, e.target.value)}
                                style={{ width: 100, padding: "3px 7px", fontSize: 12, borderRadius: 5, border: "1px solid var(--green-5)", background: "transparent", color: gross > 0 ? "var(--green-11)" : "var(--gray-9)", textAlign: "right", outline: "none", fontWeight: gross > 0 ? 700 : 400 }}
                                onFocus={(e) => { e.target.style.borderColor = "var(--green-7)"; e.target.style.background = "rgba(255,255,255,0.08)"; }}
                                onBlur={(e) => { e.target.style.borderColor = "var(--green-5)"; e.target.style.background = "transparent"; }}
                              />
                            </td>
                            <td style={{ padding: "4px 6px", textAlign: "right" }}>
                              <span style={{ fontSize: 12, fontWeight: net > 0 ? 600 : 400, color: net > 0 ? "var(--teal-11)" : "var(--gray-7)", fontVariantNumeric: "tabular-nums" }}>
                                {net > 0 ? fmtCurrency(net) : "—"}
                              </span>
                            </td>
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
'''

fixed = content[:idx] + tail

with open('src/components/FinanceiroReceita.jsx', 'w') as f:
    f.write(fixed)

print("Fixed! Length:", len(fixed))
