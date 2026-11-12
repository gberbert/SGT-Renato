with open('src/components/operacao/DemandaDetailsModal.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

bad = """  // ── Linked ticket lines (shared by both Simplificado and Completo) ──
  const linkedTicketLines = isProblema && linkedTickets.length > 0 ? [
  // ── Texto SIMPLIFICADO ──────────────────────────────────────
  // PROBLEMA: remove % Teste Interno; adds linked tickets
  const textSimplified = isProblema ? [
    `**Progresso de execução:**`,
    `% Conclusão Desenvolvimento: ${pctDev}`,
    '',
    `**Impedida**: ${impedido}`,
    `**Motivo / Observação**: ${motivo}`,
    ...(pacote ? ['', `**Janela Prevista**(**): ${pacote}`] : []),
    ...linkedTicketLines,
  ].join('\\n') : [
    `**Progresso de execução:**`,
    `% Conclusão Desenvolvimento: ${pctDev}`,
    `% Teste Interno: ${pctTeste}`,
    '',
    `**Impedida**: ${impedido}`,
    `**Motivo / Observação**: ${motivo}`,
    ...(pacote ? ['', `**Janela Prevista**(**): ${pacote}`] : []),
  ].join('\\n');

  // ── Texto COMPLETO ──────────────────────────────────────────
  // PROBLEMA: remove Data Fim Teste Interno e Data Fim Teste (QA) CPFL; adds Data Entrega RCA + Ticket Vinculado
  const linkedTicketLines = isProblema && linkedTickets.length > 0 ? [
    '',
    `**Tickets Vinculados:**`,
    ...linkedTickets.map(tv => {
      const parts = [tv.issueKey || ''];
      if (tv.impedimento) parts.push('⚠ Impedido');
      if (tv.status) parts.push(tv.status);
      if (tv.pacote) parts.push(tv.pacote);
      return parts.filter(Boolean).join(' | ');
    }),
  ] : [];"""

good = """  // ── Linked ticket lines (shared by both Simplificado and Completo) ──
  const linkedTicketLines = isProblema && linkedTickets.length > 0 ? [
    '',
    `**Tickets Vinculados:**`,
    ...linkedTickets.map(tv => {
      const parts = [tv.issueKey || ''];
      if (tv.impedimento) parts.push('⚠ Impedido');
      if (tv.status) parts.push(tv.status);
      if (tv.pacote) parts.push(tv.pacote);
      return parts.filter(Boolean).join(' | ');
    }),
  ] : [];

  // ── Texto SIMPLIFICADO ──────────────────────────────────────
  // PROBLEMA: remove % Teste Interno; adds linked tickets
  const textSimplified = isProblema ? [
    `**Progresso de execução:**`,
    `% Conclusão Desenvolvimento: ${pctDev}`,
    '',
    `**Impedida**: ${impedido}`,
    `**Motivo / Observação**: ${motivo}`,
    ...(pacote ? ['', `**Janela Prevista**(**): ${pacote}`] : []),
    ...linkedTicketLines,
  ].join('\\n') : [
    `**Progresso de execução:**`,
    `% Conclusão Desenvolvimento: ${pctDev}`,
    `% Teste Interno: ${pctTeste}`,
    '',
    `**Impedida**: ${impedido}`,
    `**Motivo / Observação**: ${motivo}`,
    ...(pacote ? ['', `**Janela Prevista**(**): ${pacote}`] : []),
  ].join('\\n');

  // ── Texto COMPLETO ──────────────────────────────────────────
  // PROBLEMA: remove Data Fim Teste Interno e Data Fim Teste (QA) CPFL; adds Data Entrega RCA + Ticket Vinculado"""

if bad in content:
    content = content.replace(bad, good)
    print('Fixed!')
else:
    print('Pattern not found - check manually')

with open('src/components/operacao/DemandaDetailsModal.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
