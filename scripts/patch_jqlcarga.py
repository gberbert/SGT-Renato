#!/usr/bin/env python3
"""Patch functions/index.js: add NULL_SAFE + SGT_ONLY protection in jqlCarga handler."""
import os, sys, re

fpath = os.path.join(os.getcwd(), 'functions', 'index.js')
content = open(fpath, encoding='utf-8').read()

tickets_key = "collection('tickets')"
print('File size:', len(content))
print('jqlCarga present:', 'jqlCarga' in content)
print('existingData present:', 'existingData' in content)
print('tickets collection present:', tickets_key in content)

m = re.search(
    r"const ticketRef = db\.collection\('tickets'\)\.doc\(issue\.key\);\s*"
    r"const existingSnap = await ticketRef\.get\(\);\s*"
    r"const existingData = existingSnap\.exists \? existingSnap\.data\(\) : \{\};\s*"
    r"const merged = \{ \.\.\.existingData, \.\.\.parsed \};\s*"
    r"await ticketRef\.set\(merged\);",
    content
)

if not m:
    print("PATTERN NOT FOUND - showing jqlCarga context:")
    idx = content.find('jqlCarga')
    if idx >= 0:
        print(repr(content[idx:idx+2000]))
    sys.exit(1)

line_no = content[:m.start()].count('\n') + 1
print('Pattern found at char', m.start(), 'line', line_no)

OLD = m.group(0)
I = "                "  # 16 spaces

NULL_SAFE = "['sistemasImpactados','percentualConclusao','percentualConclusaoTesteInterno','percentualConclusaoHomologacao','dataFimTesteInterno','dataFimHomologacao','impedimento','motivoImpedimento','ciclo','grupoSuporte','squadPrincipal','estimativaMacro','estimativaTotal','prioridadeInterna','severidade','naturezaIniciativa','naturezaOperacao']"
SGT_ONLY = "['ptAprovados','ptReprovados','ptBloqueados','ptAtencao','ptNaoAplicavel','ptNaoExecutado','observacao','observacaoAdicional','cicloAtribuido','cicloId','radarFieldsUpdatedAt','prioridadeManual','prioridadeRodada','responsavelDesenvolvimento','responsavelTesteInterno','dataFimDesenvolvimento','dataFimTesteQa','ticketsVinculados']"

NEW = (
    I + "const ticketRef = db.collection('tickets').doc(issue.key);\n" +
    I + "const existingSnap = await ticketRef.get();\n" +
    I + "const existingData = existingSnap.exists ? existingSnap.data() : {};\n" +
    I + "const merged = { ...existingData, ...parsed };\n" +
    I + "// NULL_SAFE: preserva valor SGT quando Jira retorna null/vazio\n" +
    I + "const NULL_SAFE_F = " + NULL_SAFE + ";\n" +
    I + "for (const f of NULL_SAFE_F) { const pv = parsed[f]; if ((pv === null || pv === '' || pv === undefined) && existingData[f] != null && existingData[f] !== '') merged[f] = existingData[f]; }\n" +
    I + "// SGT_ONLY: nunca sobrescrever (pt* Plano de Teste, observacoes, etc.)\n" +
    I + "const SGT_ONLY_F = " + SGT_ONLY + ";\n" +
    I + "for (const f of SGT_ONLY_F) { if (existingData[f] !== undefined) merged[f] = existingData[f]; else delete merged[f]; }\n" +
    I + "if (!parsed.status && existingData.status) merged.status = existingData.status;\n" +
    I + "await ticketRef.set(merged);"
)

patched = content.replace(OLD, NEW, 1)

if 'NULL_SAFE_F' not in patched:
    print("REPLACE FAILED")
    sys.exit(1)

open(fpath, 'w', encoding='utf-8').write(patched)
print("PATCHED OK")
print("NULL_SAFE_F in file:", 'NULL_SAFE_F' in patched)
print("SGT_ONLY_F in file:", 'SGT_ONLY_F' in patched)
