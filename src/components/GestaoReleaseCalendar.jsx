import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Package } from 'lucide-react';

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEK_DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

// Colour palette — one per release (cycles)
const RELEASE_COLORS = [
  '#a78bfa', // violet
  '#34d399', // emerald
  '#60a5fa', // blue
  '#fbbf24', // amber
  '#f87171', // red
  '#38bdf8', // sky
  '#fb923c', // orange
  '#4ade80', // green
  '#e879f9', // fuchsia
  '#94a3b8', // slate
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

function fmtBr(iso) {
  if (!iso) return '—';
  const p = String(iso).split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

function AmbienteBadge({ ambiente }) {
  if (!ambiente) return null;
  const h = ambiente === 'Homologação';
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8, whiteSpace: 'nowrap',
      background: h ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.15)',
      color: h ? '#fbbf24' : '#f87171',
      border: `1px solid ${h ? 'rgba(251,191,36,0.4)' : 'rgba(239,68,68,0.4)'}`,
    }}>{ambiente}</span>
  );
}

function TipoBadge({ tipo }) {
  if (!tipo) return null;
  const f = tipo === 'Janela Fixa';
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8, whiteSpace: 'nowrap',
      background: f ? 'rgba(99,102,241,0.15)' : 'rgba(6,182,212,0.15)',
      color: f ? '#a5b4fc' : '#22d3ee',
      border: `1px solid ${f ? 'rgba(99,102,241,0.35)' : 'rgba(6,182,212,0.35)'}`,
    }}>{tipo}</span>
  );
}

export default function ReleaseCalendar({ releases }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const today = isoToday();
  const grid = buildGrid(year, month);

  // Map each release to a stable color by index in the original array
  const releaseColorMap = {};
  releases.forEach((rel, idx) => {
    releaseColorMap[rel.id] = RELEASE_COLORS[idx % RELEASE_COLORS.length];
  });

  // Build map: iso-date → [release] based on dataAlvo
  const releasesByDate = {};
  releases.forEach(rel => {
    if (!rel.dataAlvo) return;
    const iso = rel.dataAlvo.slice(0, 10);
    if (!releasesByDate[iso]) releasesByDate[iso] = [];
    releasesByDate[iso].push(rel);
  });

  // Also map janelas (deploy/CAB) per date for secondary indicator
  const janelasByDate = {};
  releases.forEach(rel => {
    (rel.janelas || []).forEach(j => {
      if (!janelasByDate[j.data]) janelasByDate[j.data] = [];
      janelasByDate[j.data].push({ ...j, releaseName: rel.nome, releaseId: rel.id });
    });
  });

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };

  const selectedReleases = selectedDay ? (releasesByDate[selectedDay] || []) : [];
  const selectedJanelas = selectedDay ? (janelasByDate[selectedDay] || []) : [];

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {/* ── Calendar grid ── */}
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
            const isSelected = cell.iso === selectedDay;
            const releasesOnDay = releasesByDate[cell.iso] || [];
            const janelasOnDay = janelasByDate[cell.iso] || [];
            const hasEvents = releasesOnDay.length > 0 || janelasOnDay.length > 0;

            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => setSelectedDay(isSelected ? null : cell.iso)}
                style={{
                  padding: '4px 2px', borderRadius: 6, cursor: hasEvents ? 'pointer' : 'default',
                  border: isSelected ? '2px solid var(--indigo-9)' : isToday ? '1px solid var(--indigo-7)' : '1px solid transparent',
                  background: isSelected ? 'rgba(99,102,241,0.2)' : isToday ? 'rgba(99,102,241,0.08)' : 'transparent',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  minHeight: 36,
                  transition: 'background 0.1s',
                }}
              >
                <span style={{ fontSize: 12, fontWeight: isToday ? 800 : 500, color: isToday ? 'var(--indigo-11)' : 'var(--gray-12)' }}>
                  {cell.day}
                </span>
                {/* Release dataAlvo indicators */}
                {releasesOnDay.length > 0 && (
                  <div style={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {releasesOnDay.map(rel => (
                      <span
                        key={rel.id}
                        title={rel.nome}
                        style={{
                          display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                          background: releaseColorMap[rel.id],
                          flexShrink: 0,
                        }}
                      />
                    ))}
                  </div>
                )}
                {/* Janela/CAB dots (smaller) */}
                {janelasOnDay.length > 0 && (
                  <div style={{ display: 'flex', gap: 1 }}>
                    {janelasOnDay.slice(0, 3).map((j, i) => (
                      <span key={i} style={{
                        display: 'inline-block', width: 4, height: 4, borderRadius: '50%',
                        background: j.tipo === 'deploy' ? '#22d3ee' : '#fb923c',
                        flexShrink: 0, opacity: 0.7,
                      }} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--gray-4)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Release colors legend */}
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
          {/* Janela dots legend */}
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

      {/* ── Day detail panel ── */}
      <div style={{ flex: 1, minWidth: 260 }}>
        {selectedDay ? (
          <div style={{ background: 'var(--gray-2)', border: '1px solid var(--gray-5)', borderRadius: 10, overflow: 'hidden' }}>
            {/* Day header */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--gray-4)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-12)' }}>
                {fmtBr(selectedDay)}
              </span>
            </div>

            {/* Releases with dataAlvo on this day */}
            {selectedReleases.length > 0 && (
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: selectedJanelas.length > 0 ? '1px solid var(--gray-4)' : 'none' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-9)', letterSpacing: '0.06em' }}>DATA ALVO DAS RELEASES</span>
                {selectedReleases.map(rel => (
                  <div key={rel.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                    borderRadius: 8, border: `1px solid ${releaseColorMap[rel.id]}44`,
                    background: `${releaseColorMap[rel.id]}11`,
                  }}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: releaseColorMap[rel.id], flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Package size={13} color={releaseColorMap[rel.id]} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-12)' }}>{rel.nome}</span>
                        <AmbienteBadge ambiente={rel.ambiente} />
                        <TipoBadge tipo={rel.tipo} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Janelas/CABs on this day */}
            {selectedJanelas.length > 0 && (
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-9)', letterSpacing: '0.06em' }}>JANELAS / CABs</span>
                {selectedJanelas.map((ev, i) => (
                  <div key={ev.id || i} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                    borderRadius: 8,
                    background: ev.tipo === 'deploy' ? 'rgba(34,211,238,0.07)' : 'rgba(251,146,60,0.07)',
                    border: `1px solid ${ev.tipo === 'deploy' ? 'rgba(34,211,238,0.25)' : 'rgba(251,146,60,0.25)'}`,
                  }}>
                    <span style={{ fontSize: 13 }}>{ev.tipo === 'deploy' ? '🚀' : '📋'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: ev.tipo === 'deploy' ? '#22d3ee' : '#fb923c' }}>
                        {ev.tipo === 'deploy' ? 'Deploy' : 'CAB'}
                        {ev.hora && <span style={{ fontWeight: 400, color: 'var(--gray-9)', marginLeft: 6 }}>{ev.hora}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--gray-10)' }}>{ev.releaseName}</div>
                      {ev.descricao && <div style={{ fontSize: 11, color: 'var(--gray-9)', fontStyle: 'italic' }}>{ev.descricao}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {selectedReleases.length === 0 && selectedJanelas.length === 0 && (
              <div style={{ padding: '20px 14px', textAlign: 'center', fontSize: 12, color: 'var(--gray-9)' }}>
                Nenhum evento neste dia.
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '24px 14px', textAlign: 'center', fontSize: 12, color: 'var(--gray-9)', background: 'var(--gray-2)', border: '1px solid var(--gray-5)', borderRadius: 10 }}>
            Clique em uma data para ver os planos de release.
          </div>
        )}
      </div>
    </div>
  );
}
