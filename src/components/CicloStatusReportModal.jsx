import React, { useMemo } from 'react';
import { X, CheckCircle2, AlertCircle, TrendingUp, BarChart2, Users, Layers } from 'lucide-react';

function sqName(t) { return t._resolvedSquad || t.squadPrincipal || t.squad || null; }
function getPct(t) { const v = t.percentualConclusao; if (v == null || v === '') return 0; return Math.min(100, Math.max(0, Number(v))); }
function isDone(t) { const s = (t.status || '').toLowerCase(); return s.includes('conclu') || s === 'done' || s.includes('fechad') || s.includes('resolvid'); }
function isHighPrio(t) { const p = t.prioridadeInterna; if (p == null) return false; const ps = String(p).toLowerCase(); return ps === '1' || ps.includes('alta') || ps.includes('criti') || ps.includes('urgent'); }
function countBy(arr, fn) { const m = {}; arr.forEach(t => { const k = fn(t) || '—'; m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); }
function sColor(s) { if (!s) return '#6b7280'; const l = s.toLowerCase(); if (l.includes('conclu') || l.includes('fechad') || l.includes('resolvid')) return '#22c55e'; if (l.includes('execu') || l.includes('andament')) return '#3b82f6'; if (l.includes('homolog')) return '#8b5cf6'; if (l.includes('revis')) return '#a78bfa'; if (l.includes('aguard') || l.includes('muda')) return '#f59e0b'; if (l.includes('teste')) return '#06b6d4'; if (l.includes('analis') || l.includes('t-shirt')) return '#f97316'; return '#6b7280'; }
function eColor(e) { if (!e) return '#6b7280'; const u = e.toUpperCase(); if (u === 'DEMANDA') return '#3b82f6'; if (u === 'DEMANDA FAST') return '#f59e0b'; if (u === 'PROBLEMAS') return '#ef4444'; return '#6b7280'; }
function qColor(sq) { const p = ['#6366f1','#22d3ee','#f59e0b','#22c55e','#ec4899','#f97316','#a78bfa','#84cc16']; if (!sq) return p[0]; let h = 0; for (let i = 0; i < sq.length; i++) h = (h * 31 + sq.charCodeAt(i)) % p.length; return p[h]; }

function Bars({ entries, maxBars = 12, colorFn }) {
  const shown = entries.slice(0, maxBars);
  const maxVal = shown.length ? shown[0][1] : 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {shown.map(([label, count]) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 130, fontSize: 11, color: 'var(--gray-11)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0, textAlign: 'right' }} title={label}>{label}</span>
          <div style={{ flex: 1, height: 16, borderRadius: 4, background: 'var(--gray-4)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: ((count / maxVal) * 100) + '%', background: colorFn ? colorFn(label) : '#6366f1', borderRadius: 4, minWidth: count > 0 ? 4 : 0 }} />
          </div>
          <span style={{ width: 24, fontSize: 11, fontWeight: 700, color: 'var(--gray-11)', textAlign: 'right', flexShrink: 0 }}>{count}</span>
        </div>
      ))}
    </div>
  );
}

function KpiCard({ icon, label, value, sub, color }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: 145, background: color + '0f', border: '1px solid ' + color + '44', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--gray-9)', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--gray-9)' }}>{sub}</div>}
    </div>
  );
}

function Hdr({ icon, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
      <span style={{ color: 'var(--gray-8)' }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.07em', color: 'var(--gray-9)', textTransform: 'uppercase' }}>{title}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--gray-5)' }} />
    </div>
  );
}

function CBox({ icon, title, entries, colorFn }) {
  return (
    <div style={{ background: 'var(--gray-2)', border: '1px solid var(--gray-4)', borderRadius: 10, padding: '14px 16px' }}>
      <Hdr icon={icon} title={title} />
      {entries.length === 0
        ? <p style={{ fontSize: 12, color: 'var(--gray-9)', margin: 0 }}>Sem dados</p>
        : <Bars entries={entries} maxBars={12} colorFn={colorFn} />}
    </div>
  );
}

function ABox({ color, bg, label, items, renderItem }) {
  if (!items.length) return null;
  return (
    <div style={{ background: bg, border: '1px solid ' + color + '44', borderRadius: 10, padding: '12px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color, letterSpacing: '0.06em', marginBottom: 8 }}>{label} ({items.length})</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 160, overflowY: 'auto' }}>
        {items.map((t, i) => renderItem(t, i))}
      </div>
    </div>
  );
}

export default function CicloStatusReportModal({ tickets, cicloLabel, onClose }) {
  const total = tickets.length;

  const stats = useMemo(() => {
    if (!total) return null;
    const done = tickets.filter(isDone);
    const blocked = tickets.filter(t => t.impedimento === true);
    const avgPct = Math.round(tickets.reduce((acc, t) => acc + getPct(t), 0) / total);
    return {
      done,
      blocked,
      avgPct,
      byStatus: countBy(tickets, t => t.status),
      bySquad: countBy(tickets, t => sqName(t)),
      byEscopo: countBy(tickets, t => t.escopo),
      zeroExec: tickets.filter(t => getPct(t) === 0 && (t.status || '').toLowerCase().includes('execu')),
      lowHighPrio: tickets.filter(t => getPct(t) < 30 && isHighPrio(t) && !isDone(t)),
    };
  }, [tickets, total]);

  if (!stats) {
    return (
      <div
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <div style={{ background: 'var(--color-panel-solid)', borderRadius: 14, padding: 40, color: 'var(--gray-10)' }}>
          Nenhum ticket para exibir.
          <button onClick={onClose} style={{ marginLeft: 12, cursor: 'pointer' }}>Fechar</button>
        </div>
      </div>
    );
  }

  const { done, blocked, avgPct, byStatus, bySquad, byEscopo, zeroExec, lowHighPrio } = stats;
  const geradoEm = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  const tRow = (t, i) => (
    <div key={i} style={{ fontSize: 12, color: 'var(--gray-12)', display: 'flex', gap: 8 }}>
      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#a5b4fc', flexShrink: 0 }}>
        {t.issueKey || t.id || '?'}
      </span>
      <div>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 500 }}>
          {t.summary || '(sem título)'}
        </div>
        {t.motivoImpedimento && (
          <div style={{ fontSize: 11, color: 'var(--gray-9)' }}>Motivo: {t.motivoImpedimento}</div>
        )}
        {t.responsavelDesenvolvimento && (
          <div style={{ fontSize: 11, color: 'var(--gray-9)' }}>Resp.: {t.responsavelDesenvolvimento}</div>
        )}
      </div>
    </div>
  );

  const pctLabel = avgPct + '%';
  const doneLabel = done.length + ' / ' + total;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}
    >
      <div style={{ background: 'var(--color-panel-solid)', border: '1px solid var(--gray-5)', borderRadius: 16, width: '100%', maxWidth: 900, boxShadow: '0 24px 72px rgba(0,0,0,0.55)', marginBottom: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--gray-4)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <BarChart2 size={18} color="#6366f1" />
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--gray-12)' }}>Status Report</h2>
              {cicloLabel && (
                <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.35)' }}>
                  {cicloLabel}
                </span>
              )}
            </div>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--gray-9)' }}>
              Visão executiva do ciclo · Gerado em {geradoEm}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: '1px solid var(--gray-5)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--gray-9)', display: 'flex', alignItems: 'center' }}
          >
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* KPIs */}
          <div>
            <Hdr icon={<TrendingUp size={14} />} title="Indicadores do Ciclo" />
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <KpiCard
                icon={<Layers size={16} />}
                label="Total de Tickets"
                value={total}
                sub="tickets no ciclo"
                color="#6366f1"
              />
              <KpiCard
                icon={<TrendingUp size={16} />}
                label="Conclusão Média"
                value={pctLabel}
                sub="percentual médio"
                color="#22c55e"
              />
              <KpiCard
                icon={<CheckCircle2 size={16} />}
                label="Concluídos"
                value={doneLabel}
                sub="tickets finalizados"
                color="#06b6d4"
              />
              <KpiCard
                icon={<AlertCircle size={16} />}
                label="Impedidos"
                value={blocked.length}
                sub="com impedimento"
                color="#ef4444"
              />
            </div>
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <CBox
              icon={<BarChart2 size={14} />}
              title="Por Status"
              entries={byStatus}
              colorFn={sColor}
            />
            <CBox
              icon={<Users size={14} />}
              title="Por Squad"
              entries={bySquad}
              colorFn={qColor}
            />
            <CBox
              icon={<Layers size={14} />}
              title="Por Escopo"
              entries={byEscopo}
              colorFn={eColor}
            />
          </div>

          {/* Attention points */}
          {(zeroExec.length > 0 || blocked.length > 0 || lowHighPrio.length > 0) && (
            <div>
              <Hdr icon={<AlertCircle size={14} />} title="Pontos de Atenção" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <ABox
                  color="#ef4444"
                  bg="rgba(239,68,68,0.05)"
                  label="IMPEDIDOS"
                  items={blocked}
                  renderItem={tRow}
                />
                <ABox
                  color="#f59e0b"
                  bg="rgba(245,158,11,0.05)"
                  label="EM EXECUÇÃO SEM PROGRESSO (0%)"
                  items={zeroExec}
                  renderItem={tRow}
                />
                <ABox
                  color="#f97316"
                  bg="rgba(249,115,22,0.05)"
                  label="ALTA PRIORIDADE COM BAIXO PROGRESSO"
                  items={lowHighPrio}
                  renderItem={tRow}
                />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
