import React from 'react';
import { Box, Flex, Text } from '@radix-ui/themes';
import { Loader2, Eye, Pencil } from 'lucide-react';
import { stripNumericPrefix } from '../../utils/stripNumericPrefix';

export function OperacaoProgressHistoryTable({ historyMap, rows, squadMap, modalLoadingKey, onView, onEdit }) {
  if (!historyMap || !rows.length) return null;

  const allV = [...historyMap.values()];
  const devDs = [...new Set(allV.flatMap(h => h.dev.map(e => e.date.toISOString().slice(0, 10))))].sort();
  const tstDs = [...new Set(allV.flatMap(h => h.teste.map(e => e.date.toISOString().slice(0, 10))))].sort();

  if (!devDs.length && !tstDs.length) {
    return (
      <Box mt="2" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8 }}>
        <Text size="2" color="gray">Nenhuma alteração de % Conclusão registrada no statusChangeLog.</Text>
      </Box>
    );
  }

  const fD = (iso) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y.slice(2)}`; };
  const devByKey = new Map();
  const tstByKey = new Map();
  const maxDevByKey = new Map();
  const maxTstByKey = new Map();
  for (const [key, hist] of historyMap) {
    const dm = new Map(); for (const e of hist.dev) dm.set(e.date.toISOString().slice(0, 10), e.value); devByKey.set(key, dm);
    const tm = new Map(); for (const e of hist.teste) tm.set(e.date.toISOString().slice(0, 10), e.value); tstByKey.set(key, tm);
    const maxD = hist.dev.length ? Math.max(...hist.dev.map(e => Number(e.value) || 0)) : null;
    const maxT = hist.teste.length ? Math.max(...hist.teste.map(e => Number(e.value) || 0)) : null;
    maxDevByKey.set(key, maxD);
    maxTstByKey.set(key, maxT);
  }

  return (
    <Box mt="2" className="operacao-radar-tickets-panel">
      <Flex align="center" justify="between" mb="2" wrap="wrap" gap="2">
        <Box>
          <Text size="3" weight="bold">Histórico de % Conclusão — Linha do Tempo</Text>
          <Text size="1" color="gray">Cada coluna = data de uma alteração registrada no statusChangeLog</Text>
        </Box>
      </Flex>
      <Box className="operacao-radar-tickets-table-wrap">
        <table className="operacao-radar-tickets-table">
          <colgroup>
            <col className="col-num" /><col className="col-acoes" /><col className="col-key" />
            <col className="col-status" /><col className="col-squad" /><col style={{ minWidth: 72 }} />
            {devDs.map(d => <col key={`dc-${d}`} style={{ minWidth: 64 }} />)}
            {tstDs.map(d => <col key={`tc-${d}`} style={{ minWidth: 64 }} />)}
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2}>#</th>
              <th rowSpan={2}>AÇÕES</th>
              <th rowSpan={2}>ISSUE_KEY</th>
              <th rowSpan={2}>STATUS</th>
              <th rowSpan={2}>SQUAD</th>
              <th rowSpan={2} style={{ textAlign: 'center', color: '#4ade80', background: 'rgba(74,222,128,0.06)', whiteSpace: 'nowrap' }}>AVANÇO</th>
              {devDs.length > 0 && <th colSpan={devDs.length} style={{ color: '#818cf8', textAlign: 'center', background: 'rgba(129,140,248,0.06)', borderBottom: '2px solid rgba(129,140,248,0.3)' }}>% CONCLUSÃO</th>}
              {tstDs.length > 0 && <th colSpan={tstDs.length} style={{ color: '#f59e0b', textAlign: 'center', background: 'rgba(245,158,11,0.06)', borderBottom: '2px solid rgba(245,158,11,0.3)' }}>% CONCLUSÃO TESTE</th>}
            </tr>
            <tr>
              {devDs.map(d => {
                const isBase = d === '2026-10-10';
                return <th key={d} style={{ color: isBase ? 'rgba(129,140,248,0.55)' : '#818cf8', fontSize: 11, fontWeight: 700, textAlign: 'center', padding: '4px 6px', background: isBase ? 'rgba(129,140,248,0.02)' : 'rgba(129,140,248,0.04)', whiteSpace: 'nowrap', borderRight: isBase ? '2px dashed rgba(129,140,248,0.3)' : undefined }}>{isBase ? `📌 ${fD(d)}` : fD(d)}</th>;
              })}
              {tstDs.map(d => {
                const isBase = d === '2026-10-10';
                return <th key={d} style={{ color: isBase ? 'rgba(245,158,11,0.55)' : '#f59e0b', fontSize: 11, fontWeight: 700, textAlign: 'center', padding: '4px 6px', background: isBase ? 'rgba(245,158,11,0.02)' : 'rgba(245,158,11,0.04)', whiteSpace: 'nowrap', borderRight: isBase ? '2px dashed rgba(245,158,11,0.3)' : undefined }}>{isBase ? `📌 ${fD(d)}` : fD(d)}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((ticket, idx) => {
              const dm = devByKey.get(ticket.issueKey) || new Map();
              const tm = tstByKey.get(ticket.issueKey) || new Map();
              const sq = squadMap.get(ticket.issueKey);
              return (
                <tr key={ticket.issueKey}>
                  <td className="operacao-radar-tickets-num">{idx + 1}</td>
                  <td className="operacao-radar-tickets-acoes">
                    <button type="button" className="operacao-radar-tickets-action-btn action-view" title="Ver detalhes" disabled={modalLoadingKey === ticket.issueKey} onClick={() => onView(ticket)}>
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
                      ? <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: 'rgba(16,185,129,0.13)', border: '1px solid rgba(16,185,129,0.35)', color: '#6ee7b7', whiteSpace: 'nowrap' }}>{sq}</span>
                      : (stripNumericPrefix(ticket.grupoSuporte) || '—')}
                  </td>
                  <td style={{ textAlign: 'center', padding: '4px 8px' }}>
                    {(() => {
                      const maxD = maxDevByKey.get(ticket.issueKey);
                      const maxT = maxTstByKey.get(ticket.issueKey);
                      if (maxD == null && maxT == null) return <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>—</span>;
                      const a = ((maxD ?? 0) + (maxT ?? 0)) / 2;
                      const rounded = Math.round(a * 10) / 10;
                      const color = rounded >= 75 ? '#4ade80' : rounded >= 40 ? '#fbbf24' : '#f87171';
                      return (
                        <span style={{ fontWeight: 800, fontSize: 13, color }} title={`Max dev: ${maxD ?? '—'}% | Max teste: ${maxT ?? '—'}%`}>
                          {rounded}%
                        </span>
                      );
                    })()}
                  </td>
                  {devDs.map(d => {
                    const isBase = d === '2026-10-10';
                    return (
                      <td key={d} style={{ textAlign: 'center', padding: '4px 6px', background: dm.has(d) ? (isBase ? 'rgba(129,140,248,0.04)' : 'rgba(129,140,248,0.08)') : undefined, borderRight: isBase ? '2px dashed rgba(129,140,248,0.2)' : undefined }}>
                        {dm.has(d)
                          ? <span style={{ fontWeight: 700, fontSize: 12, color: isBase ? 'rgba(129,140,248,0.6)' : '#818cf8' }}>{dm.get(d)}%</span>
                          : <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11 }}>—</span>}
                      </td>
                    );
                  })}
                  {tstDs.map(d => {
                    const isBase = d === '2026-10-10';
                    return (
                      <td key={d} style={{ textAlign: 'center', padding: '4px 6px', background: tm.has(d) ? (isBase ? 'rgba(245,158,11,0.04)' : 'rgba(245,158,11,0.08)') : undefined, borderRight: isBase ? '2px dashed rgba(245,158,11,0.2)' : undefined }}>
                        {tm.has(d)
                          ? <span style={{ fontWeight: 700, fontSize: 12, color: isBase ? 'rgba(245,158,11,0.6)' : '#f59e0b' }}>{tm.get(d)}%</span>
                          : <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11 }}>—</span>}
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
