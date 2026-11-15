import { readFileSync, writeFileSync } from 'fs';

let c = readFileSync('src/components/FinanceiroHorasEvolutivos.jsx', 'utf8');

// 1. Fix ativDe/ativAte initial state
c = c.replace(
  'const [ativDe, setAtivDe] = useState("");',
  'const [ativDe, setAtivDe] = useState(() => defaultFilters.ativDe || "");'
);
c = c.replace(
  'const [ativAte, setAtivAte] = useState("");',
  'const [ativAte, setAtivAte] = useState(() => defaultFilters.ativAte || "");'
);

// 2. Wrap Data Encerramento block with hideFilters check
// Find the Data Encerramento label (unique in filter bar)
const encLabel = '>Data Encerramento</span>';
const encIdx = c.indexOf(encLabel);
if (encIdx === -1) { console.log('ERROR: Data Encerramento label not found'); process.exit(1); }

// Find start of that div block (walk back from encIdx)
const divStart = c.lastIndexOf('\n        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>', encIdx);
if (divStart === -1) { console.log('ERROR: div start not found'); process.exit(1); }

// Find the closing of the encerramento block: the </div> after the ✕ button, then the separator div, then <div ref={resDropRef}
const afterEncErr = c.indexOf('<div ref={resDropRef}', encIdx);
if (afterEncErr === -1) { console.log('ERROR: div ref not found'); process.exit(1); }

// Find the last </div> separator before <div ref={resDropRef}
const sepDivEnd = c.lastIndexOf('        <div style={{ width: 1, height: 20, background: "var(--gray-5)", flexShrink: 0 }} />', afterEncErr);
const afterSep = sepDivEnd + '        <div style={{ width: 1, height: 20, background: "var(--gray-5)", flexShrink: 0 }} />'.length;

// Extract what's between divStart and afterSep
const encBlock = c.slice(divStart, afterSep);

// New wrapped block
const newEncBlock = `
        {!hideFilters.includes("dataEncerramento") && <>` + encBlock + `
        </>}`;

c = c.slice(0, divStart) + newEncBlock + c.slice(afterSep);

writeFileSync('src/components/FinanceiroHorasEvolutivos.jsx', c, 'utf8');
console.log('Done - patched ativDe/ativAte defaults and wrapped Data Encerramento');
