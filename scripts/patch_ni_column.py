import sys

with open('src/components/CicloPdfExport.jsx', 'r') as f:
    src = f.read()

orig = src

# 1. Remove NI cell from current position (before IMP icon block)
NI_CELL = (
    "      {/* Natureza da Iniciativa */}\n"
    "      <div style={{ ...cellBase, width:NI_W, padding:'0 3px' }}>\n"
    "        <span style={{ fontSize:6.5, color:'#374151', textAlign:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:NI_W-6 }}>"
    "{trunc(ticket.naturezaIniciativa||ticket.naturezaOperacao||'',20)}</span>\n"
    "      </div>"
)
if NI_CELL not in src:
    print("ERROR: NI_CELL not found", file=sys.stderr)
    sys.exit(1)
src = src.replace(NI_CELL, "", 1)

# 2. Insert NI cell right after Prioridade cell in TicketRow
PR_CELL = (
    "      {/* Prioridade \u2014 moved after Squad */}\n"
    "      <div style={{ ...cellBase, width:PR_W, padding:'0 2px' }}>\n"
    "        {pb && <span style={{ fontSize:7, fontWeight:700, background:pb.bg, color:pb.color, padding:'1px 3px', borderRadius:3, whiteSpace:'nowrap' }}>{pb.label}</span>}\n"
    "      </div>"
)
if PR_CELL not in src:
    print("ERROR: PR_CELL not found", file=sys.stderr)
    sys.exit(1)
src = src.replace(
    PR_CELL,
    PR_CELL + "\n" + NI_CELL,
    1
)

# 3. Remove NI header from its current position in ColHeaders
NI_HDR = "        {hCell(NI_W,'Nat.','Iniciativa')}"
if NI_HDR not in src:
    print("ERROR: NI_HDR not found", file=sys.stderr)
    sys.exit(1)
src = src.replace(NI_HDR, "", 1)

# 4. Insert NI header right after Prio header
PR_HDR = "        {hCell(PR_W,'Prio',null)}"
if PR_HDR not in src:
    print("ERROR: PR_HDR not found", file=sys.stderr)
    sys.exit(1)
src = src.replace(
    PR_HDR,
    PR_HDR + "\n" + NI_HDR,
    1
)

if src == orig:
    print("ERROR: nothing changed", file=sys.stderr)
    sys.exit(1)

with open('src/components/CicloPdfExport.jsx', 'w') as f:
    f.write(src)
print("OK - NI column moved after Prio")
