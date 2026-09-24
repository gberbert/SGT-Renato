import React, { useState } from 'react';
import { ChevronDown, ChevronRight, MoveRight, MoveLeft, CalendarDays, Pencil, Trash2, Calendar } from 'lucide-react';
import { updateCiclo, deleteCiclo } from '../services/cicloService';
import { stripNumericPrefix } from '../utils/stripNumericPrefix';

export const ESCOPOS_ALVO = ['DEMANDA', 'DEMANDA FAST', 'PROBLEMAS'];
export const ESCOPO_META = {
  DEMANDA: { color: '#3b82f6', short: 'DEM' },
  'DEMANDA FAST': { color: '#f59e0b', short: 'FAST' },
  PROBLEMAS: { color: '#ef4444', short: 'PROB' },
};
export const CICLO_STATUS_META = {
  planejamento: { label: 'Planejamento', color: '#6b7280' },
  ativo: { label: 'Ativo', color: '#22c55e' },
  concluido: { label: 'Concluido', color: '#8b5cf6' },
};

export function getStatusColor(s) {
  if (!s) return '#6b7280';
  const l = String(s).toLowerCase();
  if (l.includes('conclu') || l.includes('done') || l.includes('resolvid')) return '#22c55e';
  if (l.includes('andament') || l.includes('progress')) return '#3b82f6';
  if (l.includes('block') || l.includes('impedi')) return '#ef4444';
  if (l.includes('analis') || l.includes('review')) return '#8b5cf6';
  if (l.includes('aguard') || l.includes('pendente')) return '#f59e0b';
  return '#6b7280';
}

export const DATE_FIELD_OPTIONS = [
  { value: 'none', label: 'Nenhuma data' },
  { value: 'dataFimDesenvolvimento', label: 'Fim Desenvolvimento' },
  { value: 'dataFimTesteInterno', label: 'Fim Teste Interno' },
  { value: 'dataFimTesteQa', label: 'Fim Teste (QA)' },
  { value: 'dataFimHomologacao', label: 'Fim Homologação' },
  { value: 'dataConclusao', label: 'Conclusão' },
];

function fmtDateShort(val) {
  if (!val) return null;
  const s = String(val);
  // ISO yyyy-mm-dd or yyyy-mm-ddTHH...
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

export function TicketRow({ ticket, cicloId, ciclos, onMoveToCiclo, onMoveToBacklog, onTicketClick, dateField }) {
  const [open, setOpen] = useState(false);
  const em = ESCOPO_META[ticket.escopo] || { color: '#6b7280', short: (ticket.escopo || '?').slice(0, 4) };
  const sc = getStatusColor(ticket.status);
  const tkey = ticket.issueKey || ticket.id;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, background: 'var(--color-surface)', border: '1px solid var(--gray-4)', marginBottom: 3 }}>
      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 5px', borderRadius: 4, background: em.color, color: '#fff', flexShrink: 0, minWidth: 34, textAlign: 'center' }}>{em.short}</span>
      <button
        onClick={() => onTicketClick && onTicketClick(ticket)}
        title="Ver detalhes"
        style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-9)', flexShrink: 0, minWidth: 88, fontFamily: 'monospace', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textUnderlineOffset: 2 }}
      >
        {tkey}
      </button>
      <span style={{ flex: 1, fontSize: 13, color: 'var(--gray-12)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ticket.summary}>{ticket.summary || '(sem titulo)'}</span>
      {ticket.issueType && (
        <span style={{ fontSize: 11, color: 'var(--gray-10)', flexShrink: 0, maxWidth: 88, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.issueType}</span>
      )}
      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: sc + '22', color: sc, flexShrink: 0, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.status || 'Sem status'}</span>
      {(() => {
        const squadName = ticket._resolvedSquad || ticket.squadPrincipal || stripNumericPrefix(ticket.grupoSuporte) || ticket.squad || null;
        if (!squadName) return null;
        return (
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)', flexShrink: 0, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={squadName}>
            {squadName}
          </span>
        );
      })()}
      {ticket.estimativaInterna && (
        <span
          title={`Estimativa interna: ${ticket.estimativaInterna}`}
          style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 12, background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.35)', flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          ⏱ {ticket.estimativaInterna}
        </span>
      )}
      {dateField && dateField !== 'none' && (() => {
        const dateVal = ticket[dateField];
        const label = DATE_FIELD_OPTIONS.find(o => o.value === dateField)?.label || dateField;
        return (
          <span
            title={`${label}: ${dateVal || '—'}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 3,
              fontSize: 11, fontWeight: 600,
              padding: '2px 8px', borderRadius: 12,
              background: dateVal ? 'rgba(251,191,36,0.12)' : 'rgba(107,114,128,0.1)',
              color: dateVal ? '#fbbf24' : 'var(--gray-8)',
              border: `1px solid ${dateVal ? 'rgba(251,191,36,0.35)' : 'var(--gray-5)'}`,
              flexShrink: 0, whiteSpace: 'nowrap',
            }}
          >
            <Calendar size={10} />
            {fmtDateShort(dateVal) || '—'}
          </span>
        );
      })()}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setOpen(!open)}
          style={{ background: 'none', border: '1px solid var(--gray-5)', borderRadius: 6, padding: '3px 7px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, color: 'var(--gray-11)', fontSize: 12 }}
        >
          <MoveRight size={12} />
        </button>
        {open && (
          <div
            onMouseLeave={() => setOpen(false)}
            style={{ position: 'absolute', right: 0, top: '110%', zIndex: 200, background: 'var(--color-panel-solid)', border: '1px solid var(--gray-5)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.3)', minWidth: 175, overflow: 'hidden' }}
          >
            <div style={{ padding: '5px 10px', fontSize: 11, fontWeight: 700, color: 'var(--gray-9)', borderBottom: '1px solid var(--gray-4)', textTransform: 'uppercase' }}>Mover para</div>
            {cicloId && (
              <div
                onClick={() => { onMoveToBacklog(); setOpen(false); }}
                style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 7 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--gray-3)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <MoveLeft size={12} /> Backlog
              </div>
            )}
            {ciclos.filter(c => c.id !== cicloId).map(c => (
              <div
                key={c.id}
                onClick={() => { onMoveToCiclo(c.id); setOpen(false); }}
                style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 7 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--gray-3)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <MoveRight size={12} /> {c.nome}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CicloSection({ ciclo, tickets, allCiclos, onMoveToCiclo, onMoveToBacklog, onTicketClick, dateField }) {
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editNome, setEditNome] = useState(ciclo.nome);
  const [editInicio, setEditInicio] = useState(ciclo.dataInicio || '');
  const [editFim, setEditFim] = useState(ciclo.dataFim || '');
  const meta = CICLO_STATUS_META[ciclo.status] || CICLO_STATUS_META.planejamento;

  const saveEdit = async () => {
    if (!editNome.trim()) return;
    await updateCiclo(ciclo.id, { nome: editNome.trim(), dataInicio: editInicio || null, dataFim: editFim || null });
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('Excluir "' + ciclo.nome + '"? Tickets voltarao ao Backlog.')) return;
    if ((ciclo.ticketKeys || []).length) await updateCiclo(ciclo.id, { ticketKeys: [] });
    await deleteCiclo(ciclo.id);
  };

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: 'var(--gray-3)', borderRadius: collapsed ? 8 : '8px 8px 0 0', border: '1px solid var(--gray-5)', borderBottom: collapsed ? '1px solid var(--gray-5)' : 'none', userSelect: 'none' }}>
        <span onClick={() => setCollapsed(!collapsed)} style={{ cursor: 'pointer', color: 'var(--gray-9)', display: 'flex' }}>
          {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
        </span>
        {editing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, flexWrap: 'wrap' }}>
            <input
              value={editNome}
              onChange={e => setEditNome(e.target.value)}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false); }}
              style={{ fontSize: 14, fontWeight: 700, background: 'var(--gray-1)', border: '1px solid var(--accent-8)', borderRadius: 4, padding: '2px 8px', color: 'var(--gray-12)', minWidth: 130 }}
            />
            <input type="date" value={editInicio} onChange={e => setEditInicio(e.target.value)} style={{ fontSize: 12, background: 'var(--gray-1)', border: '1px solid var(--gray-5)', borderRadius: 4, padding: '2px 5px', color: 'var(--gray-12)' }} />
            <span style={{ fontSize: 12, color: 'var(--gray-9)' }}>ate</span>
            <input type="date" value={editFim} onChange={e => setEditFim(e.target.value)} style={{ fontSize: 12, background: 'var(--gray-1)', border: '1px solid var(--gray-5)', borderRadius: 4, padding: '2px 5px', color: 'var(--gray-12)' }} />
            <button onClick={saveEdit} style={{ padding: '3px 10px', background: 'var(--accent-9)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Salvar</button>
            <button onClick={() => setEditing(false)} style={{ padding: '3px 10px', background: 'var(--gray-5)', color: 'var(--gray-12)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Cancelar</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, cursor: 'pointer' }} onClick={() => setCollapsed(!collapsed)}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-12)' }}>{ciclo.nome}</span>
            {(ciclo.dataInicio || ciclo.dataFim) && (
              <span style={{ fontSize: 12, color: 'var(--gray-9)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <CalendarDays size={11} /> {ciclo.dataInicio || '?'} - {ciclo.dataFim || '?'}
              </span>
            )}
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: meta.color + '22', color: meta.color }}>{meta.label}</span>
            <span style={{ fontSize: 12, color: 'var(--gray-10)' }}>({tickets.length} tickets)</span>
            {(() => {
              const total = tickets.reduce((acc, t) => acc + (Number(t.estimativaInterna) || 0), 0);
              if (!total) return null;
              return (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 10, background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)', marginLeft: 2 }}>
                  ⏱ {total}h
                </span>
              );
            })()}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          {ciclo.status === 'planejamento' && (
            <button
              onClick={() => updateCiclo(ciclo.id, { status: 'ativo' })}
              style={{ padding: '3px 10px', fontSize: 12, fontWeight: 600, background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e55', borderRadius: 4, cursor: 'pointer' }}
            >
              Iniciar
            </button>
          )}
          {ciclo.status === 'ativo' && (
            <button
              onClick={() => updateCiclo(ciclo.id, { status: 'concluido' })}
              style={{ padding: '3px 10px', fontSize: 12, fontWeight: 600, background: '#8b5cf622', color: '#8b5cf6', border: '1px solid #8b5cf655', borderRadius: 4, cursor: 'pointer' }}
            >
              Concluir
            </button>
          )}
          <button
            onClick={() => setEditing(true)}
            style={{ padding: '3px 7px', background: 'none', border: '1px solid var(--gray-5)', borderRadius: 4, cursor: 'pointer', color: 'var(--gray-10)', display: 'flex', alignItems: 'center' }}
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={handleDelete}
            style={{ padding: '3px 7px', background: 'none', border: '1px solid var(--gray-5)', borderRadius: 4, cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {/* Body */}
      {!collapsed && (
        <div style={{ border: '1px solid var(--gray-5)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '8px 10px', background: 'var(--color-background)' }}>
          {tickets.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--gray-9)', fontSize: 13, padding: '16px 0' }}>Nenhum ticket neste ciclo</div>
          ) : (
            tickets.map(t => (
              <TicketRow
                key={t.issueKey || t.id}
                ticket={t}
                cicloId={ciclo.id}
                ciclos={allCiclos}
                onMoveToCiclo={destId => onMoveToCiclo(t, ciclo.id, destId)}
                onMoveToBacklog={() => onMoveToBacklog(t, ciclo.id)}
                onTicketClick={onTicketClick}
                dateField={dateField}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
