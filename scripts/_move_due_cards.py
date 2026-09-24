import sys

with open('/Users/rhonorin/Documents/SGT-Renato/src/components/operacao/OperacaoHome.jsx', 'r') as f:
    content = f.read()

# Step 1: Add date-calc vars to outer IIFE (before return)
old1 = (
    '                          const pieSegments = buildPieSegments(priorityRows, priorityTotal, 80, 80, 65);\n\n'
    '                          return (\n'
    '                            <Box mb="4" style={{ paddingBottom: 16, borderBottom: \'1px solid rgba(255,255,255,0.07)\' }}>\n'
    '                              <Flex gap="6" align="start" wrap="wrap">'
)
new1 = (
    '                          const pieSegments = buildPieSegments(priorityRows, priorityTotal, 80, 80, 65);\n\n'
    '                          const _DUE_FIELDS = [\'dataFimDesenvolvimento\', \'dataFimTesteInterno\', \'dataConclusao\'];\n'
    '                          const _getDueDates = (t) => _DUE_FIELDS.map((f) => t[f] ? String(t[f]).slice(0, 10) : null).filter(Boolean);\n'
    '                          const venceHoje = visibleTickets.filter((t) => _getDueDates(t).includes(todayStr)).length;\n'
    '                          const vence2dias = visibleTickets.filter((t) => { const dates = _getDueDates(t); return dates.includes(plus1Str) || dates.includes(plus2Str); }).length;\n'
    '                          const vencidos = visibleTickets.filter((t) => { const dates = _getDueDates(t); return dates.some((d) => d < todayStr); }).length;\n\n'
    '                          return (\n'
    '                            <Box mb="4" style={{ paddingBottom: 16, borderBottom: \'1px solid rgba(255,255,255,0.07)\' }}>\n'
    '                              <Flex gap="6" align="start" wrap="wrap">'
)
if old1 in content:
    content = content.replace(old1, new1, 1)
    print("Step 1 OK")
else:
    print("Step 1 FAILED")
    sys.exit(1)

# Step 2: Simplify inner IIFE (remove date vars, fix minWidth)
old2 = (
    '                                {/* RIGHT: Priority pie chart + due-date counters */}\n'
    '                                {priorityTotal > 0 && (() => {\n'
    '                                  const _todayStr = todayStr;\n'
    '                                  const _plus1Str = plus1Str;\n'
    '                                  const _plus2Str = plus2Str;\n'
    "                                  const DATE_FIELDS = ['dataFimDesenvolvimento', 'dataFimTesteInterno', 'dataConclusao'];\n"
    '                                  const getTicketDates = (t) => DATE_FIELDS.map((f) => t[f] ? String(t[f]).slice(0, 10) : null).filter(Boolean);\n'
    '                                  const venceHoje = visibleTickets.filter((t) => getTicketDates(t).includes(_todayStr)).length;\n'
    '                                  const vence2dias = visibleTickets.filter((t) => {\n'
    '                                    const dates = getTicketDates(t);\n'
    '                                    return dates.includes(_plus1Str) || dates.includes(_plus2Str);\n'
    '                                  }).length;\n'
    '                                  const vencidos = visibleTickets.filter((t) => {\n'
    '                                    const dates = getTicketDates(t);\n'
    '                                    return dates.some((d) => d < _todayStr);\n'
    '                                  }).length;\n'
    '                                  return (\n'
    "                                    <Box style={{ flex: '0 0 auto', minWidth: 420 }}>"
)
new2 = (
    '                                {/* RIGHT: Priority pie chart */}\n'
    '                                {priorityTotal > 0 && (() => {\n'
    '                                  return (\n'
    "                                    <Box style={{ flex: '0 0 auto', minWidth: 280 }}>"
)
if old2 in content:
    content = content.replace(old2, new2, 1)
    print("Step 2 OK")
else:
    print("Step 2 FAILED")
    sys.exit(1)

# Step 3: Remove counters column from inside pie section
START_MARKER = '                                        {/* Due-date counters */}'
COUNTERS_END = '                                        </Flex>\n                                      </Flex>'
start_idx = content.find(START_MARKER)
if start_idx == -1:
    print("Step 3 FAILED - START_MARKER not found")
    sys.exit(1)
end_idx = content.find(COUNTERS_END, start_idx)
if end_idx == -1:
    print("Step 3 FAILED - END not found")
    sys.exit(1)
remove_end = end_idx + len('                                        </Flex>')
content = content[:start_idx] + '                                      </Flex>' + content[remove_end:]
print("Step 3 OK")

with open('/Users/rhonorin/Documents/SGT-Renato/src/components/operacao/OperacaoHome.jsx', 'w') as f:
    f.write(content)
print("File written OK")
