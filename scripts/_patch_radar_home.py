#!/usr/bin/env python3
import sys

with open('src/components/operacao/OperacaoHome.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

# 1. Add selectedGeralEscopo state after computedRadar
old1 = "  const [computedRadar, setComputedRadar] = useState(null);"
new1 = "  const [selectedGeralEscopo, setSelectedGeralEscopo] = useState(null);\n  const [geralEscopoLoading, setGeralEscopoLoading] = useState(false);\n  const [computedRadar, setComputedRadar] = useState(null);"
if old1 in content:
    content = content.replace(old1, new1, 1)
    changes += 1
    print("Change 1 applied: selectedGeralEscopo state")
else:
    print("WARN: Change 1 not found")

# 2. Add auto-bootstrap useEffect
old2 = "  // 1) Ao entrar na tela Radar, restaurar cache de sess"
new2 = "  // Auto-bootstrap on mount so GERAL totals load immediately\n  // eslint-disable-next-line react-hooks/exhaustive-deps\n  useEffect(() => { ensureRadarBootstrap(); }, []);\n\n  // 1) Ao entrar na tela Radar, restaurar cache de sess"
if old2 in content:
    content = content.replace(old2, new2, 1)
    changes += 1
    print("Change 2 applied: auto-bootstrap useEffect")
else:
    print("WARN: Change 2 not found")

# 3. Remove PRECIFICACAO and CATALOGO cards
old3a = "        label: 'Precifica\u00e7\u00e3o',"
if old3a in content:
    # Find the whole block and remove it
    import re
    # Remove the PRECIFICACAO block
    content = re.sub(
        r"\s*\{\s*\n\s*key: 'PRECIFICACAO DEMANDAS',\s*\n\s*label: 'Precifica\u00e7\u00e3o',\s*\n\s*total: findTotal\('PRECIFICACAO DEMANDAS'\),\s*\n\s*\},",
        "",
        content
    )
    # Remove the CATALOGO block
    content = re.sub(
        r"\s*\{\s*\n\s*key: 'CATALOGO',\s*\n\s*label: 'CAT\u00c1LOGO',\s*\n\s*total: findTotal\('CATALOGO'\),\s*\n\s*color: '#a855f7',\s*\n\s*\},",
        "",
        content
    )
    changes += 1
    print("Change 3 applied: removed PRECIFICACAO and CATALOGO cards")
else:
    print("WARN: Change 3 (PRECIFICACAO label) not found in content")

# 4. Add status breakdown panel after geralCards buttons + change onClick to toggle
# Change the geralCards map to toggle selectedGeralEscopo instead of always openDrill
old4 = "                  <Box className=\"operacao-radar-lanes\" mt=\"4\" style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>\n                    {geralCards.map((card) => (\n                      <button\n                        key={card.key}\n                        type=\"button\"\n                        className=\"operacao-radar-summary-value\"\n                        onClick={() => openDrill(card.key, card.label)}\n                        disabled={drillLoading}\n                        style={{\n                          width: 210,\n                          height: 86,\n                          borderRadius: 16,\n                          border: `1px solid rgba(255,255,255,0.08)`,\n                          background: 'rgba(255,255,255,0.02)',\n                          display: 'flex',\n                          flexDirection: 'column',\n                          alignItems: 'flex-start',\n                          justifyContent: 'center',\n                          padding: 16,\n                          gap: 6,\n                          cursor: 'pointer',\n                        }}\n                        title={`Ver tickets de ${card.label}`}\n                      >\n                        <Text\n                          size=\"7\"\n                          weight=\"bold\"\n                          style={{ margin: 0, color: card.color, lineHeight: 1 }}\n                        >\n                          {formatNumber(card.total)}\n                        </Text>\n                        <Text size=\"2\" color=\"gray\" style={{ margin: 0, textTransform: 'uppercase' }}>\n                          {card.label}\n                        </Text>\n                      </button>\n                    ))}\n                  </Box>"

if old4 in content:
    new4 = """                  <Box className="operacao-radar-lanes" mt="4" style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                    {geralCards.map((card) => {
                      const isSelG = selectedGeralEscopo === card.key;
                      return (
                        <button
                          key={card.key}
                          type="button"
                          className="operacao-radar-summary-value"
                          onClick={async () => {
                            if (isSelG) { setSelectedGeralEscopo(null); return; }
                            setSelectedGeralEscopo(card.key);
                            if (!loadedEscopos.has(card.key)) {
                              setGeralEscopoLoading(true);
                              try { await loadTicketsData(card.key); } finally { setGeralEscopoLoading(false); }
                            }
                          }}
                          disabled={drillLoading}
                          style={{
                            width: 210, height: 86, borderRadius: 16,
                            border: isSelG ? `2px solid ${card.color || '#22d3ee'}` : '1px solid rgba(255,255,255,0.08)',
                            background: isSelG ? `${(card.color || '#22d3ee')}18` : 'rgba(255,255,255,0.02)',
                            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center',
                            padding: 16, gap: 6, cursor: 'pointer',
                            boxShadow: isSelG ? `0 0 0 3px ${(card.color || '#22d3ee')}22` : 'none',
                            transition: 'border 0.15s, box-shadow 0.15s, background 0.15s',
                          }}
                          title={`Ver tickets de ${card.label}`}
                        >
                          <Text size="7" weight="bold" style={{ margin: 0, color: card.color, lineHeight: 1 }}>
                            {formatNumber(card.total)}
                          </Text>
                          <Text size="2" color="gray" style={{ margin: 0, textTransform: 'uppercase' }}>
                            {card.label}
                          </Text>
                        </button>
                      );
                    })}
                  </Box>

                  {/* Status breakdown for selected GERAL escopo */}
                  {selectedGeralEscopo && (() => {
                    const selCard = geralCards.find(c => c.key === selectedGeralEscopo);
                    if (geralEscopoLoading) return (
                      <Flex align="center" gap="3" mt="3" style={{ padding: 16 }}>
                        <Loader2 size={18} color="#38bdf8" className="spin" />
                        <Text size="2" color="gray">Carregando dados de {selCard?.label}...</Text>
                      </Flex>
                    );
                    if (!Array.isArray(ticketsCache)) return null;
                    const escopoT = ticketsCache.filter(t => String(t.escopo || '').toUpperCase() === selectedGeralEscopo.toUpperCase());
                    if (!escopoT.length) return <Text size="2" color="gray" mt="3">Nenhum ticket carregado para {selCard?.label}.</Text>;
                    const sCounts = {};
                    for (const t of escopoT) {
                      const s = t.status ? String(t.status).trim() : '(sem status)';
                      sCounts[s] = (sCounts[s] || 0) + 1;
                    }
                    const sortedS = Object.entries(sCounts).sort((a, b) => b[1] - a[1]);
                    return (
                      <Box mt="3" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${(selCard?.color || '#22d3ee')}33`, borderRadius: 12, padding: '14px 16px' }}>
                        <Flex align="center" justify="between" mb="3">
                          <Text style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: `${selCard?.color || '#22d3ee'}99` }}>
                            {selCard?.label} · POR STATUS
                          </Text>
                          <button type="button" onClick={() => openDrill(selectedGeralEscopo, selCard?.label || selectedGeralEscopo)} disabled={drillLoading}
                            style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, border: `1px solid ${(selCard?.color || '#22d3ee')}55`, background: `${(selCard?.color || '#22d3ee')}15`, color: selCard?.color || '#22d3ee', cursor: 'pointer' }}>
                            Ver todos
                          </button>
                        </Flex>
                        <Flex gap="2" wrap="wrap">
                          {sortedS.map(([status, count]) => (
                            <button key={status} type="button"
                              onClick={() => openDrill(selectedGeralEscopo, `${selCard?.label} \u00b7 ${status}`, null, status)}
                              disabled={drillLoading}
                              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, padding: '10px 14px', textAlign: 'left', width: 150, flex: '0 0 150px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4, transition: 'border 0.12s, background 0.12s' }}
                              onMouseEnter={e => { e.currentTarget.style.border = `1px solid ${selCard?.color || '#22d3ee'}55`; e.currentTarget.style.background = `${selCard?.color || '#22d3ee'}0d`; }}
                              onMouseLeave={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.09)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}>
                              <span style={{ fontSize: 24, fontWeight: 900, color: selCard?.color || '#22d3ee', lineHeight: 1 }}>{formatNumber(count)}</span>
                              <span style={{ fontSize: 10, lineHeight: 1.3, color: 'rgba(255,255,255,0.5)', whiteSpace: 'normal', wordBreak: 'break-word' }}>{status}</span>
                            </button>
                          ))}
                        </Flex>
                      </Box>
                    );
                  })()}"""
    content = content.replace(old4, new4, 1)
    changes += 1
    print("Change 4 applied: status breakdown panel")
else:
    print("WARN: Change 4 (geralCards.map block) not found")

with open('src/components/operacao/OperacaoHome.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Done: {changes}/4 changes applied")
