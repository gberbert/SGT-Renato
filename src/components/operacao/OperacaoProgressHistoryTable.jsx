import React, { useState } from 'react';
import { Box, Flex, Text } from '@radix-ui/themes';
import { Loader2, Eye, Pencil, ChevronRight, ChevronDown } from 'lucide-react';
import { stripNumericPrefix } from '../../utils/stripNumericPrefix';

// Returns the last known value in a sorted date→value Map at or before targetDate
function lastKnownVal(dateMap, targetDate) {
  let last = null;
  for (const [d, v] of dateMap) {
    if (d <= targetDate) last = v;
    else break;
  }
  return last;
}

function avancoColor(pct) {
  if (pct >= 75) return '#4ade80';
  if (pct >= 40) return '#fbbf24';
  return '#f87171';
}

export function OperacaoProgressHistoryTable({ historyMap, rows, squadMap, modalLoadingKey, onView, onEdit }) {
  const [showDev, setShowDev] = useState(false);
  const [showTeste, setShowTeste] = useState(false);

  if (!historyMap || !rows.length) return null;

  const allV = [...historyMap.values()];
  const devDs = [...new Set(allV.flatMap(h => h.dev.map(e => e.date.toISOString().slice(0, 10))))].sort();
  const tstDs = [...new Set(allV.flatMap(h => h.teste.map(e => e.date.toISOString().slice(0, 10))))].sort();
  // All dates combined (for per-date avanço columns)
  const allDates = [...new Set([...devDs, ...tstDs])].sort();

  if (!allDates.length) {
    return (
      <Box mt="2" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8 }}>
        <Text size="2" color="gray">Nenhuma alteração de % Conclusão registrada no statusChangeLog.</Text>
      </Box>
    );
  }

  const fD = (iso) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y.slice(2)}`; };
  const devByKey = new Map();
  const tstByKey = new Map();
  for (const [key, hist] of historyMap) {
    const dm = new Map();
    for (const e of hist.dev) dm.set(e.date.toISOString().slice(0, 10), e.value);
    devByKey.set(key, dm);
    const tm = new Map();
    for (const e of hist.teste) tm.set(e.date.toISOString().slice(0, 10), e.value);
    tstByKey.set(key, tm);
  }

  return (
    <Box mt="2" className="operacao-radar-tickets-panel">
      <Flex align="center" justify="between" mb="2" wrap="wrap" gap="2">
        <Box>
          <Text size="3" weight="bold">Histórico de % Conclusão — Linha do Tempo</Text>
          <Text size="1" color="gray">Cada coluna = data de uma alteração registrada no statusChangeLog</Text>
        </Box>
        <Flex gap="2">
          <button type="button" onClick={() => setShowDev(v => !v)}
            style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:6, cursor:'pointer', border:'1px solid rgba(129,140,248,0.4)', background: showDev?'rgba(129,140,248,0.15)':'rgba(129,140,248,0.06)', color:'#818cf8' }}>
            {showDev ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
            % Conclusão ({devDs.length})
          </button>
          <button type="button" onClick={() => setShowTeste(v => !v)}
            style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:6, cursor:'pointer', border:'1px solid rgba(245,158,11,0.4)', background: showTeste?'rgba(245,158,11,0.15)':'rgba(245,158,11,0.06)', color:'#f59e0b' }}>
            {showTeste ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
            % Conclusão Teste ({tstDs.length})
          </button>
        </Flex>
      </Flex>
      <Box className="operacao-radar-tickets-table-wrap">
        <table className="operacao-radar-tickets-table">
          <colgroup>
            <col className="col-num" />
            <col className="col-acoes" />
            <col className="col-key" />
            <col className="col-status" />
            <col className="col-squad" />
            {/* Avanço per-date columns */}
            {allDates.map(d => <col key={`ac-${d}`} style={{ minWidth: 68 }} />)}
            {/* Dev detail columns (collapsible) */}
            {showDev && devDs.map(d => <col key={`dc-${d}`} style={{ minWidth: 64 }} />)}
            {/* Teste detail columns (collapsible) */}
            {showTeste && tstDs.map(d => <col key={`tc-${d}`} style={{ minWidth: 64 }} />)}
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2}>#</th>
              <th rowSpan={2}>AÇÕES</th>
              <th rowSpan={2}>ISSUE_KEY</th>
              <th rowSpan={2}>STATUS</th>
              <th rowSpan={2}>SQUAD</th>
              {allDates.length > 0 && (
                <th colSpan={allDates.length} style={{ color:'#4ade80', textAlign:'center', background:'rgba(74,222,128,0.06)', borderBottom:'2px solid rgba(74,222,128,0.3)' }}>
                  AVANÇO
                </th>
              )}
              {showDev && devDs.length > 0 && (
                <th colSpan={devDs.length} style={{ color:'#818cf8', textAlign:'center', background:'rgba(129,140,248,0.06)', borderBottom:'2px solid rgba(129,140,248,0.3)' }}>
                  % CONCLUSÃO
                </th>
              )}
              {showTeste && tstDs.length > 0 && (
                <th colSpan={tstDs.length} style={{ color:'#f59e0b', textAlign:'center', background:'rgba(245,158,11,0.06)', borderBottom:'2px solid rgba(245,158,11,0.3)' }}>
                  % CONCLUSÃO TESTE
                </th>
              )}
            </tr>
            <tr>
              {/* Avanço date headers */}
              {allDates.map(d => {
                const isBase = d === '2026-10-10';
                return (
                  <th key={`ah-${d}`} style={{ color: isBase ? 'rgba(74,222,128,0.55)' : '#4ade80', fontSize:11, fontWeight:700, textAlign:'center', padding:'4px 6px', background: isBase ? 'rgba(74,222,128,0.02)' : 'rgba(74,222,128,0.04)', whiteSpace:'nowrap', borderRight: isBase ? '2px dashed rgba(74,222,128,0.3)' : undefined }}>
                    {isBase ? `📌 ${fD(d)}` : fD(d)}
                  </th>
                );
              })}
              {/* Dev date headers */}
              {showDev && devDs.map(d => {
                const isBase = d === '2026-10-10';
                return <th key={`dh-${d}`} style={{ color: isBase?'rgba(129,140,248,0.55)':'#818cf8', fontSize:11, fontWeight:700, textAlign:'center', padding:'4px 6px', background: isBase?'rgba(129,140,248,0.02)':'rgba(129,140,248,0.04)', whiteSpace:'nowrap', borderRight: isBase?'2px dashed rgba(129,140,248,0.3)':undefined }}>{isBase?`📌 ${fD(d)}`:fD(d)}</th>;
              })}
              {showTeste && tstDs.map(d => {
                const isBase = d === '2026-10-10';
                return <th key={`th-${d}`} style={{ color: isBase?'rgba(245,158,11,0.55)':'#f59e0b', fontSize:11, fontWeight:700, textAlign:'center', padding:'4px 6px', background: isBase?'rgba(245,158,11,0.02)':'rgba(245,158,11,0.04)', whiteSpace:'nowrap', borderRight: isBase?'2px dashed rgba(245,158,11,0.3)':undefined }}>{isBase?`📌 ${fD(d)}`:fD(d)}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((ticket, idx) => {
              const dm = devByKey.get(ticket.issueKey) || new Map();
              const tm = tstByKey.get(ticket.issueKey) || new Map();
              const sq = squadMap.get(ticket.issueKey);
              // Current values as fallback when no history exists
              const curDev = ticket.percentualConclusao != null ? Number(ticket.percentualConclusao) : null;
              const curTeste = ticket.percentualConclusaoTesteInterno != null ? Number(ticket.percentualConclusaoTesteInterno) : null;
              return (
                <tr key={ticket.issueKey}>
                  <td className="operacao-radar-tickets-num">{idx + 1}</td>
                  <td className="operacao-radar-tickets-acoes">
                    <button type="button" className="operacao-radar-tickets-action-btn action-view" title="Ver" disabled={modalLoadingKey === ticket.issueKey} onClick={() => onView(ticket)}>
                      {modalLoadingKey === ticket.issueKey ? <Loader2 size={14} className="spin" /> : <Eye size={14} />}
                    </button>
                    <button type="button" className="operacao-radar-tickets-action-btn action-edit" title="Editar" disabled={modalLoadingKey === ticket.issueKey} onClick={() => onEdit(ticket)}>
                      <Pencil size={14} />
                    </button>
                  </td>
                  <td className="operacao-radar-tickets-key-cell">
                    <div className="operacao-radar-tickets-key-inner">
                      <span className="operacao-radar-tickets-expand placeholder" aria-hidden="true" />
                      {ticket.issueUrl
                        ? <a className="operacao-radar-tickets-key" href={ticket.issueUrl} target="_blank" rel="noopener noreferrer">{ticket.issueKey}</a>
                        : ticket.issueKey}
                    </div>
                  </td>
                  <td>{ticket.status || '—'}</td>
                  <td>
                    {sq
                      ? <span style={{ fontSize:12, fontWeight:600, padding:'2px 8px', borderRadius:5, background:'rgba(16,185,129,0.13)', border:'1px solid rgba(16,185,129,0.35)', color:'#6ee7b7', whiteSpace:'nowrap' }}>{sq}</span>
                      : (stripNumericPrefix(ticket.grupoSuporte) || '—')}
                  </td>
                  {/* Avanço per-date cells */}
                  {allDates.map(d => {
                    const hasChange = dm.has(d) || tm.has(d);
                    if (!hasChange) return <td key={`av-${d}`} style={{ textAlign:'center', padding:'4px 6px' }}><span style={{ color:'rgba(255,255,255,0.12)', fontSize:11 }}>—</span></td>;
                    const devV = lastKnownVal(dm, d);
                    const testeV = lastKnownVal(tm, d);
                    const isBaselineDate = d === '2026-10-10';
                    // At baseline (10/10), value=0 means "not recorded before tracking started"
                    // → substitute with the current field value as best approximation
                    const devEff = (devV != null && (devV > 0 || !isBaselineDate)) ? devV : (curDev ?? 0);
                    const testeEff = (testeV != null && (testeV > 0 || !isBaselineDate)) ? testeV : (curTeste ?? 0);
                    const avg = (devEff + testeEff) / 2;
                    const rounded = Math.round(avg * 10) / 10;
                    const isBase = d === '2026-10-10';
                    return (
                      <td key={`av-${d}`} style={{ textAlign:'center', padding:'4px 6px', background:'rgba(74,222,128,0.06)', borderRight: isBase?'2px dashed rgba(74,222,128,0.2)':undefined }}>
                        <span style={{ fontWeight:800, fontSize:12, color: avancoColor(rounded) }}
                          title={`Dev: ${devEff}% | Teste: ${testeEff}%`}>
                          {rounded}%
                        </span>
                      </td>
                    );
                  })}
                  {/* Dev detail cells */}
                  {showDev && devDs.map(d => {
                    const isBase = d === '2026-10-10';
                    return (
                      <td key={`dv-${d}`} style={{ textAlign:'center', padding:'4px 6px', background: dm.has(d)?(isBase?'rgba(129,140,248,0.04)':'rgba(129,140,248,0.08)'):undefined, borderRight: isBase?'2px dashed rgba(129,140,248,0.2)':undefined }}>
                        {dm.has(d)
                          ? <span style={{ fontWeight:700, fontSize:12, color: isBase?'rgba(129,140,248,0.6)':'#818cf8' }}>{dm.get(d)}%</span>
                          : <span style={{ color:'rgba(255,255,255,0.15)', fontSize:11 }}>—</span>}
                      </td>
                    );
                  })}
                  {/* Teste detail cells */}
                  {showTeste && tstDs.map(d => {
                    const isBase = d === '2026-10-10';
                    return (
                      <td key={`tv-${d}`} style={{ textAlign:'center', padding:'4px 6px', background: tm.has(d)?(isBase?'rgba(245,158,11,0.04)':'rgba(245,158,11,0.08)'):undefined, borderRight: isBase?'2px dashed rgba(245,158,11,0.2)':undefined }}>
                        {tm.has(d)
                          ? <span style={{ fontWeight:700, fontSize:12, color: isBase?'rgba(245,158,11,0.6)':'#f59e0b' }}>{tm.get(d)}%</span>
                          : <span style={{ color:'rgba(255,255,255,0.15)', fontSize:11 }}>—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Box>
    </Box>
  );
}

export default OperacaoProgressHistoryTable;
