#!/usr/bin/env python3
"""Applies FILA tags + GERAL-specific table to OperacaoHome.jsx"""

with open('src/components/operacao/OperacaoHome.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

def rep(old, new, label):
    global content, changes
    if old in content:
        content = content.replace(old, new, 1)
        changes += 1
        print(f'  OK {label}')
    else:
        print(f'  MISS {label}')

# 1. Add workflow imports
rep(
    "import { WorkflowModal } from '../../components/WorkflowReferenceModal';",
    (
        "import {\n"
        "  WorkflowModal,\n"
        "  WORKFLOW_STEPS_DEMANDAS,\n"
        "  WORKFLOW_STEPS_FAST,\n"
        "  WORKFLOW_STEPS_SERVICES,\n"
        "  WORKFLOW_STEPS_PROBLEMAS,\n"
        "} from '../../components/WorkflowReferenceModal';"
    ),
    'workflow imports'
)

# 2. Add STATUS_FILA_BY_ESCOPO and FilaTagInline after RESPONSIBLE_STYLE
OLD2 = (
    "const RESPONSIBLE_STYLE = {\n"
    "  'NTT Data': { bg: 'rgba(56,189,248,0.15)', border: 'rgba(56,189,248,0.4)', color: '#38bdf8' },\n"
    "  CPFL:       { bg: 'rgba(34,197,94,0.15)',  border: 'rgba(34,197,94,0.4)',  color: '#22c55e' },\n"
    "};"
)
NEW2 = OLD2 + """

// Status -> fila lookup per escopo
const _buildFilaMap = (steps) => {
  const m = new Map();
  steps.forEach((s) => { if (s.status && s.fila) m.set(s.status, s.fila); });
  return m;
};
const STATUS_FILA_BY_ESCOPO = {
  'DEMANDA':      _buildFilaMap(WORKFLOW_STEPS_DEMANDAS),
  'DEMANDA FAST': _buildFilaMap(WORKFLOW_STEPS_FAST.filter(s => !s.separator)),
  'INCIDENTE':    _buildFilaMap(WORKFLOW_STEPS_SERVICES),
  'SOLICITACAO':  _buildFilaMap(WORKFLOW_STEPS_SERVICES),
  'PROBLEMAS':    _buildFilaMap(WORKFLOW_STEPS_PROBLEMAS),
};

function FilaTagInline({ fila }) {
  if (!fila) return null;
  const isNTT = fila === 'NTT Data';
  const isPrevista = fila === 'CPFL Prevista';
  const bg     = isNTT ? 'rgba(59,130,246,0.15)' : isPrevista ? 'rgba(255,180,50,0.15)' : 'rgba(255,120,0,0.15)';
  const color  = isNTT ? '#60a5fa'                : isPrevista ? '#ffd166'               : '#ff8c00';
  const border = isNTT ? 'rgba(59,130,246,0.45)'  : isPrevista ? 'rgba(255,180,50,0.5)' : 'rgba(255,120,0,0.5)';
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: bg, color, border: `1px solid ${border}`, whiteSpace: 'nowrap', marginTop: 2, display: 'inline-block' }}>
      {fila}
    </span>
  );
}"""
rep(OLD2, NEW2, 'STATUS_FILA_BY_ESCOPO + FilaTagInline')

# 3. Update geralComputedTotals
OLD3 = (
    "  const geralComputedTotals = useMemo(() => {\n"
    "    if (!Array.isArray(ticketsCache) || allGeralStatusOptions.length === 0) return null;\n"
    "    const result = {};\n"
    "    for (const key of ['PROBLEMAS', 'DEMANDA FAST', 'DEMANDA', 'INCIDENTE', 'SOLICITACAO']) {\n"
    "      let escopoT = ticketsCache.filter((t) => String(t.escopo || '').toUpperCase() === key.toUpperCase());\n"
    "      if (activeGeralStatusFilter.size > 0) {\n"
    "        escopoT = escopoT.filter((t) => activeGeralStatusFilter.has(String(t.status || '').trim()));\n"
    "      }\n"
    "      if (key === 'PROBLEMAS') {\n"
    "        escopoT = escopoT.filter((t) => String(t.issueType || '').toUpperCase() === 'PROBLEM');\n"
    "      }\n"
    "      result[key] = escopoT.length;\n"
    "    }\n"
    "    return result;\n"
    "  }, [ticketsCache, activeGeralStatusFilter, allGeralStatusOptions]);"
)
NEW3 = (
    "  const geralComputedTotals = useMemo(() => {\n"
    "    if (!Array.isArray(ticketsCache) || allGeralStatusOptions.length === 0) return null;\n"
    "    const result = {};\n"
    "    const filaSubtotals = {};\n"
    "    for (const key of ['PROBLEMAS', 'DEMANDA FAST', 'DEMANDA', 'INCIDENTE', 'SOLICITACAO']) {\n"
    "      let escopoT = ticketsCache.filter((t) => String(t.escopo || '').toUpperCase() === key.toUpperCase());\n"
    "      if (activeGeralStatusFilter.size > 0) {\n"
    "        escopoT = escopoT.filter((t) => activeGeralStatusFilter.has(String(t.status || '').trim()));\n"
    "      }\n"
    "      if (key === 'PROBLEMAS') {\n"
    "        escopoT = escopoT.filter((t) => String(t.issueType || '').toUpperCase() === 'PROBLEM');\n"
    "      }\n"
    "      result[key] = escopoT.length;\n"
    "      const filaMap = STATUS_FILA_BY_ESCOPO[key] || new Map();\n"
    "      let ntt = 0, cpfl = 0;\n"
    "      for (const t of escopoT) {\n"
    "        const f = filaMap.get(String(t.status || '').trim());\n"
    "        if (f === 'NTT Data') ntt++;\n"
    "        else if (f === 'CPFL' || f === 'CPFL Prevista') cpfl++;\n"
    "      }\n"
    "      filaSubtotals[key] = { ntt, cpfl };\n"
    "    }\n"
    "    return { totals: result, filaSubtotals };\n"
    "  }, [ticketsCache, activeGeralStatusFilter, allGeralStatusOptions]);"
)
rep(OLD3, NEW3, 'geralComputedTotals + filaSubtotals')

# 4. Fix total sum reference
rep(
    '? formatNumber(Object.values(geralComputedTotals).reduce((a, b) => a + b, 0))',
    '? formatNumber(Object.values(geralComputedTotals.totals).reduce((a, b) => a + b, 0))',
    'total sum .totals'
)

# 5. Fix geralCards displayTotal reference
OLD5 = "        ? (geralComputedTotals[card.key] ?? card.total)\n        : card.total;"
NEW5 = "        ? (geralComputedTotals.totals[card.key] ?? card.total)\n        : card.total;\n      const filaSub = geralComputedTotals?.filaSubtotals?.[card.key];"
rep(OLD5, NEW5, 'displayTotal + filaSub')

# 6. Add filaSubtotals in GERAL card buttons
OLD6 = (
    "                          <Text size=\"2\" color=\"gray\" style={{ margin: 0, textTransform: 'uppercase' }}>\n"
    "                            {card.label}\n"
    "                          </Text>\n"
    "                        </button>"
)
NEW6 = (
    "                          <Text size=\"2\" color=\"gray\" style={{ margin: 0, textTransform: 'uppercase' }}>\n"
    "                            {card.label}\n"
    "                          </Text>\n"
    "                          {filaSub && (filaSub.ntt > 0 || filaSub.cpfl > 0) && (\n"
    "                            <Flex gap=\"1\" style={{ marginTop: 2 }}>\n"
    "                              {filaSub.ntt > 0 && (\n"
    "                                <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 6, background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.35)', whiteSpace: 'nowrap' }}>\n"
    "                                  NTT {formatNumber(filaSub.ntt)}\n"
    "                                </span>\n"
    "                              )}\n"
    "                              {filaSub.cpfl > 0 && (\n"
    "                                <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 6, background: 'rgba(255,120,0,0.12)', color: '#ff8c00', border: '1px solid rgba(255,120,0,0.35)', whiteSpace: 'nowrap' }}>\n"
    "                                  CPFL {formatNumber(filaSub.cpfl)}\n"
    "                                </span>\n"
    "                              )}\n"
    "                            </Flex>\n"
    "                          )}\n"
    "                        </button>"
)
rep(OLD6, NEW6, 'filaSubtotals in card')

# 7. Add FilaTagInline to status breakdown cards
OLD7 = (
    "                                <span style={{ fontSize: 10, lineHeight: 1.3, color: isStatusActive ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)', whiteSpace: 'normal', wordBreak: 'break-word' }}>{status}</span>\n"
    "                              </button>"
)
NEW7 = (
    "                                <span style={{ fontSize: 10, lineHeight: 1.3, color: isStatusActive ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)', whiteSpace: 'normal', wordBreak: 'break-word' }}>{status}</span>\n"
    "                                <FilaTagInline fila={(STATUS_FILA_BY_ESCOPO[selectedGeralEscopo] || new Map()).get(status)} />\n"
    "                              </button>"
)
rep(OLD7, NEW7, 'FilaTagInline in status cards')

# 8. Update the drill table: conditional thead + conditional tbody rows
# 8a. Replace thead section
OLD8A = """                    <Box className="operacao-radar-tickets-table-wrap">
                      <table className="operacao-radar-tickets-table">
                        <colgroup>
                          <col className="col-num" />
                          <col className="col-acoes" />
                          <col className="col-key" />
                          <col className="col-status" />
                          <col className="col-type" />
                          <col className="col-summary" />
                          <col className="col-squad" />
                          <col className="col-prio" />
                          <col className="col-imp" />
                          <col className="col-estim" />
                          <col className="col-estim" />
                          <col style={{ width: 90 }} />
                          <col style={{ width: 90 }} />
                          <col className="col-date" />
                          <col className="col-date" />
                          <col className="col-date" />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>AÇÕES</th>
                            <th>ISSUE_KEY</th>
                            <th>STATUS</th>
                            <th>ISSUETYPE</th>
                            <th>SUMMARY</th>
                            <th>SQUAD</th>
                            <th>PRIORIDADE</th>
                            <th>IMPEDIMENTO</th>
                            <th>EST. MACRO</th>
                            <th>EST. TOTAL</th>
                            <th>% DEV</th>
                            <th>% TESTE INT</th>
                            <th>DESENVOLVIMENTO</th>
                            <th>TESTE INTERNO</th>
                            <th>PRODUÇÃO</th>
                          </tr>
                        </thead>"""
NEW8A = """                    <Box className="operacao-radar-tickets-table-wrap">
                      <table className="operacao-radar-tickets-table">
                        {activeEscopoTab === 'GERAL' ? (
                          <>
                            <colgroup>
                              <col className="col-num" />
                              <col className="col-acoes" />
                              <col className="col-key" />
                              <col className="col-status" />
                              <col className="col-type" />
                              <col className="col-summary" />
                              <col className="col-squad" />
                              <col className="col-prio" />
                              <col style={{ width: 100 }} />
                              <col style={{ width: 80 }} />
                            </colgroup>
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>AÇÕES</th>
                                <th>ISSUE_KEY</th>
                                <th>STATUS</th>
                                <th>ISSUETYPE</th>
                                <th>SUMMARY</th>
                                <th>SQUAD</th>
                                <th>PRIORIDADE</th>
                                <th>CRIAÇÃO</th>
                                <th>AGING</th>
                              </tr>
                            </thead>
                          </>
                        ) : (
                          <>
                            <colgroup>
                              <col className="col-num" />
                              <col className="col-acoes" />
                              <col className="col-key" />
                              <col className="col-status" />
                              <col className="col-type" />
                              <col className="col-summary" />
                              <col className="col-squad" />
                              <col className="col-prio" />
                              <col className="col-imp" />
