import sys

with open('src/components/CicloPdfExport.jsx', 'r') as f:
    src = f.read()

orig = src

# 1. Add PAC_W constant
src = src.replace(
    'const PCH_W  = 30; // % Conclusao Homologacao',
    'const PCH_W  = 30; // % Conclusao Homologacao\nconst PAC_W  = 90; // Pacote (Release)'
)
src = src.replace(
    'const PCH_W  = 30; // % Conclusão Homologação',
    'const PCH_W  = 30; // % Conclusão Homologação\nconst PAC_W  = 90; // Pacote (Release)'
)

# 2. TicketRow signature
src = src.replace(
    'function TicketRow({ ticket, rowBg, includeObservacao, includePlanoTeste }) {',
    'function TicketRow({ ticket, rowBg, includeObservacao, includePlanoTeste, includeRelease }) {'
)

# 3. Pacote cell before Natureza da Iniciativa
NAT_OLD = "      {/* Natureza da Iniciativa */}\n      <div style={{ ...cellBase, width:NI_W, padding:'0 3px' }}>"
NAT_NEW = (
    "      {/* Pacote (Release) */}\n"
    "      {includeRelease && (\n"
    "        <div style={{ ...cellBase, width:PAC_W, padding:'0 3px' }}>\n"
    "          {ticket.pacote\n"
    "            ? <span style={{ fontSize:6.5, fontWeight:700, color:'#a5b4fc', background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.35)', borderRadius:3, padding:'1px 4px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:PAC_W-8 }}>{trunc(ticket.pacote, 14)}</span>\n"
    "            : <span style={{ fontSize:7, color:'#94a3b8' }}>\u2014</span>\n"
    "          }\n"
    "        </div>\n"
    "      )}\n"
    "      {/* Natureza da Iniciativa */}\n"
    "      <div style={{ ...cellBase, width:NI_W, padding:'0 3px' }}>"
)
src = src.replace(NAT_OLD, NAT_NEW)

# 4. ColHeaders signature
src = src.replace(
    'function ColHeaders({ includeObservacao, includePlanoTeste }) {',
    'function ColHeaders({ includeObservacao, includePlanoTeste, includeRelease }) {'
)

# 5. Pacote header cell after DC
DC_OLD = "        {hCell(DC_W,'Data','Conclusão')}\n        {hCell(NI_W,'Nat.','Iniciativa')}"
DC_NEW = "        {hCell(DC_W,'Data','Conclusão')}\n        {includeRelease && hCell(PAC_W,'Pacote','Release')}\n        {hCell(NI_W,'Nat.','Iniciativa')}"
src = src.replace(DC_OLD, DC_NEW)

# 6. PdfContent signature
src = src.replace(
    'function PdfContent({ groups, filteredTickets, exportedAt, activeTab, escopoFilter, includeObservacao, includePlanoTeste }) {',
    'function PdfContent({ groups, filteredTickets, exportedAt, activeTab, escopoFilter, includeObservacao, includePlanoTeste, includeRelease }) {'
)

# 7. ColHeaders call in PdfContent
src = src.replace(
    '      <ColHeaders includeObservacao={includeObservacao} includePlanoTeste={includePlanoTeste}/>',
    '      <ColHeaders includeObservacao={includeObservacao} includePlanoTeste={includePlanoTeste} includeRelease={includeRelease}/>'
)

# 8. TicketRow calls in groups
src = src.replace(
    "            <TicketRow key={ticket.issueKey||ticket.id||ti} ticket={ticket} rowBg={ti%2===0?'#ffffff':'#f8fafc'} includeObservacao={includeObservacao} includePlanoTeste={includePlanoTeste}/>",
    "            <TicketRow key={ticket.issueKey||ticket.id||ti} ticket={ticket} rowBg={ti%2===0?'#ffffff':'#f8fafc'} includeObservacao={includeObservacao} includePlanoTeste={includePlanoTeste} includeRelease={includeRelease}/>"
)

# 9. Release section before FOOTER
FOOTER_OLD = "      {/* FOOTER */}\n      <div style={{ padding:'8px 12px 10px',borderTop:'3px solid #1e40af',background:'#f8fafc',display:'flex',flexDirection:'column',gap:4,marginTop:4 }}>"
RELEASE_SECTION = (
    "      {/* GESTAO DE RELEASE - tabela agrupada por pacote */}\n"
    "      {includeRelease && (() => {\n"
    "        const withPacote = filteredTickets.filter(t => t.pacote);\n"
    "        const byPacote = new Map();\n"
    "        withPacote.forEach(t => {\n"
    "          if (!byPacote.has(t.pacote)) byPacote.set(t.pacote, []);\n"
    "          byPacote.get(t.pacote).push(t);\n"
    "        });\n"
    "        if (byPacote.size === 0) return null;\n"
    "        return (\n"
    "          <div style={{ marginTop: 24 }}>\n"
    "            <div style={{ padding:'6px 12px', background:'rgba(99,102,241,0.12)', borderTop:'2px solid rgba(99,102,241,0.5)', borderBottom:'2px solid rgba(99,102,241,0.5)', marginBottom:4 }}>\n"
    "              <span style={{ fontSize:10, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'0.06em' }}>GESTAO DE RELEASE &mdash; Agrupamento por Pacote</span>\n"
    "            </div>\n"
    "            <ColHeaders includeObservacao={includeObservacao} includePlanoTeste={includePlanoTeste} includeRelease={true}/>\n"
    "            {[...byPacote.entries()].sort(([a],[b])=>a.localeCompare(b,'pt-BR')).map(([pacote, tks]) => (\n"
    "              <div key={pacote}>\n"
    "                <div style={{ display:'flex', alignItems:'center', background:'rgba(99,102,241,0.08)', borderBottom:'1px solid rgba(99,102,241,0.25)', borderTop:'1px solid rgba(99,102,241,0.15)', minHeight:20, padding:'0 6px' }}>\n"
    "                  <span style={{ fontSize:8.5, fontWeight:800, color:'#a5b4fc', textTransform:'uppercase', letterSpacing:'0.04em' }}>PACOTE: {pacote}</span>\n"
    "                  <span style={{ fontSize:7.5, color:'#818cf8', marginLeft:8 }}>({tks.length} ticket{tks.length!==1?'s':''})</span>\n"
    "                </div>\n"
    "                {tks.map((ticket, ti) => (\n"
    "                  <TicketRow key={ticket.issueKey||ticket.id||ti} ticket={ticket} rowBg={ti%2===0?'#ffffff':'#f0f4ff'} includeObservacao={includeObservacao} includePlanoTeste={includePlanoTeste} includeRelease={true}/>\n"
    "                ))}\n"
    "              </div>\n"
    "            ))}\n"
    "          </div>\n"
    "        );\n"
    "      })()}\n\n"
    "      {/* FOOTER */}\n"
    "      <div style={{ padding:'8px 12px 10px',borderTop:'3px solid #1e40af',background:'#f8fafc',display:'flex',flexDirection:'column',gap:4,marginTop:4 }}>"
)
src = src.replace(FOOTER_OLD, RELEASE_SECTION)

# 10. exportCicloPdf signature
src = src.replace(
    "export async function exportCicloPdf({ ciclos = [], getCicloTickets, filteredTickets = [], backlogTickets = [], activeTab = 'ciclos', escopoFilter, includeObservacao = false, includePlanoTeste = false }) {",
    "export async function exportCicloPdf({ ciclos = [], getCicloTickets, filteredTickets = [], backlogTickets = [], activeTab = 'ciclos', escopoFilter, includeObservacao = false, includePlanoTeste = false, includeRelease = false }) {"
)

# 11. Pass includeRelease in PdfContent render call
src = src.replace(
    "        includeObservacao={includeObservacao}\n        includePlanoTeste={includePlanoTeste}\n      />",
    "        includeObservacao={includeObservacao}\n        includePlanoTeste={includePlanoTeste}\n        includeRelease={includeRelease}\n      />"
)

if src == orig:
    print("WARNING: no replacements made - check search strings", file=sys.stderr)
    sys.exit(1)

with open('src/components/CicloPdfExport.jsx', 'w') as f:
    f.write(src)

print("OK - all patches applied")
