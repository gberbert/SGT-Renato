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
  for (const [key, hist] of historyMap) {
    const dm = new Map(); for (const e of hist.dev) dm.set(e.date.toISOString().slice(0, 10), e.value); devByKey.set(key, dm);
    const tm = new Map(); for (const e of hist.teste) tm.set(e.date.toISOString().slice(0, 10), e.value); tstByKey.set(key, tm);
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
            <col className="col-status" /><col className="col-type" /><col className="col-summary" /><col className="col-squad" />
            {devDs.map(d => <col key={`dc-${d}`} style={{ minWidth: 64 }} />)}
            {tstDs.map(d => <col key={`tc-${d}`} style={{ minWidth: 64 }} />)}
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2}>#</th>
              <th rowSpan={2}>AÇÕES</th>
              <th rowSpan={2}>ISSUE_KEY</th>
              <th rowSpan={2}>STATUS</th>
              <th rowSpan={2}>ISSUETYPE</th>
              <th rowSpan={2}>SUMMARY</th>
              <th rowSpan={2}>SQUAD</th>
              {devDs.length > 0 && <th colSpan={devDs.length} style={{ color: '#818cf8', textAlign: 'center', background: 'rgba(129,140,248,0.06)', borderBottom: '2px solid rgba(129,140,248,0.3)' }}>% CONCLUSÃO</th>}
              {tstDs.length > 0 && <th colSpan={tstDs.length} style={{ color: '#f59e0b', textAlign: 'center', background: 'rgba(245,158,11,0.06)', borderBottom: '2px solid rgba(245,158,11,0.3)' }}>% CONCLUSÃO TESTE</th>}
            </tr>
            <tr>
              {devDs.map(d => <th key={d} style={{ color: '#818cf8', fontSize: 11, fontWeight: 700, textAlign: 'center', padding: '4px 6px', background: 'rgba(129,140,248,0.04)', whiteSpace: 'nowrap' }}>{fD(d)}</th>)}
              {tstDs.map(d => <th key={d} style={{ color: '#f59e0b', fontSize: 11, fontWeight: 700, textAlign: 'center', padding: '4px 6px', background: 'rgba(245,158,11,0.04)', whiteSpace: 'nowrap' }}>{fD(d)}</th>)}
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
                  <td>{ticket.issueType || '—'}</td>
                  <td className="operacao-radar-tickets-summary">{ticket.summary || '—'}</td>
                  <td>
                    {sq
                      ? <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: 'rgba(16,185,129,0.13)', border: '1px solid rgba(16,185,129,0.35)', color: '#6ee7b7', whiteSpace: 'nowrap' }}>{sq}</span>
                      : (stripNumericPrefix(ticket.grupoSuporte) || '—')}
                  </td>
                  {devDs.map(d => (
                    <td key={d} style={{ textAlign: 'center', padding: '4px 6px', background: dm.has(d) ? 'rgba(129,140,248,0.08)' : undefined }}>
                      {dm.has(d)
                        ? <span style={{ fontWeight: 700, fontSize: 12, color: '#818cf8' }}>{dm.get(d)}%</span>
                        : <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11 }}>—</span>}
                    </td>
                  ))}
                  {tstDs.map(d => (
                    <td key={d} style={{ textAlign: 'center', padding: '4px 6px', background: tm.has(d) ? 'rgba(245,158,11,0.08)' : undefined }}>
                      {tm.has(d)
                        ? <span style={{ fontWeight: 700, fontSize: 12, color: '#f59e0b' }}>{tm.get(d)}%</span>
                        : <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11 }}>—</span>}
                    </td>
                  ))}
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
