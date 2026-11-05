import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEK_DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const RELEASE_COLORS = [
  '#a78bfa', '#34d399', '#60a5fa', '#fbbf24', '#f87171',
  '#38bdf8', '#fb923c', '#4ade80', '#e879f9', '#94a3b8',
];

function isoToday() { return new Date().toISOString().slice(0, 10); }

function buildGrid(year, month) {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const g = [];
  for (let i = 0; i < first; i++) g.push(null);
  for (let d = 1; d <= days; d++)
    g.push({ day: d, iso: `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}` });
  return g;
}

export default function ReleaseCalendar({ releases }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const today = isoToday();
  const grid = buildGrid(year, month);

  const releaseColorMap = {};
  releases.forEach((rel, idx) => {
    releaseColorMap[rel.id] = RELEASE_COLORS[idx % RELEASE_COLORS.length];
  });

  const releasesByDate = {};
  releases.forEach(rel => {
    if (!rel.dataAlvo) return;
    const iso = rel.dataAlvo.slice(0, 10);
    if (!releasesByDate[iso]) releasesByDate[iso] = [];
    releasesByDate[iso].push(rel);
  });

  const janelasByDate = {};
  releases.forEach(rel => {
    (rel.janelas || []).forEach(j => {
      if (!janelasByDate[j.data]) janelasByDate[j.data] = [];
      janelasByDate[j.data].push({ ...j, releaseName: rel.nome });
    });
  });

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  return (
    <div style={{ flex: '0 0 auto', minWidth: 300, background: 'var(--gray-2)', border: '1px solid var(--gray-5)', borderRadius: 10, padding: 14 }}>
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-10)', display: 'flex', alignItems: 'center', padding: 4 }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-12)' }}>
          {MONTHS_PT[month]} {year}
        </span>
        <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-10)', display: 'flex', alignItems: 'center', padding: 4 }}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Week day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {WEEK_DAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--gray-9)', padding: '2px 0' }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {grid.map((cell, idx) => {
          if (!cell) return <div key={`pad-${idx}`} />;
          const isToday = cell.iso === today;
          const releasesOnDay = releasesByDate[cell.iso] || [];
          const janelasOnDay = janelasByDate[cell.iso] || [];

          return (
            <div
              key={cell.iso}
              title={[
                ...releasesOnDay.map(r => `🎯 ${r.nome}`),
                ...janelasOnDay.map(j => `${j.tipo === 'deploy' ? '🚀' : '📋'} ${j.releaseName}${j.hora ? ' ' + j.hora : ''}`),
              ].join('\n') || undefined}
              style={{
                padding: '4px 2px', borderRadius: 6,
                border: isToday ? '1px solid var(--indigo-7)' : '1px solid transparent',
                background: isToday ? 'rgba(99,102,241,0.08)' : 'transparent',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                minHeight: 34,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: isToday ? 800 : 500, color: isToday ? 'var(--indigo-11)' : 'var(--gray-12)' }}>
                {cell.day}
              </span>
              {releasesOnDay.length > 0 && (
                <div style={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {releasesOnDay.map(rel => (
                    <span key={rel.id} title={rel.nome} style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: releaseColorMap[rel.id], flexShrink: 0 }} />
                  ))}
                </div>
              )}
              {janelasOnDay.length > 0 && (
                <div style={{ display: 'flex', gap: 1 }}>
                  {janelasOnDay.slice(0, 3).map((j, i) => (
                    <span key={i} style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: j.tipo === 'deploy' ? '#22d3ee' : '#fb923c', flexShrink: 0, opacity: 0.7 }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--gray-4)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {releases.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {releases.map((rel, idx) => (
              <div key={rel.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: RELEASE_COLORS[idx % RELEASE_COLORS.length], flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: 'var(--gray-10)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{rel.nome}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: '#22d3ee', opacity: 0.7 }} />
            <span style={{ fontSize: 10, color: 'var(--gray-9)' }}>Deploy</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: '#fb923c', opacity: 0.7 }} />
            <span style={{ fontSize: 10, color: 'var(--gray-9)' }}>CAB</span>
          </div>
        </div>
      </div>
    </div>
  );
}
