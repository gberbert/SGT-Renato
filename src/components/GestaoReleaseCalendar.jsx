import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { removeJanela } from '../services/releaseService';
import { AddJanelaModal } from './GestaoReleaseModals';

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEK_DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function isoToday() { return new Date().toISOString().slice(0, 10); }

function buildGrid(year, month) {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const g = [];
  for (let i = 0; i < first; i++) g.push(null);
  for (let d = 1; d <= days; d++)
    g.push({ day: d, iso: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
  return g;
}

function EventDot({ tipo }) {
  const color = tipo === 'deploy' ? '#22d3ee' : '#fb923c';
  return <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />;
}

export default function ReleaseCalendar({ releases }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [addModal, setAddModal] = useState(null); // { release, date }
  const [selectedDay, setSelectedDay] = useState(null);
  const today = isoToday();
  const grid = buildGrid(year, month);

  // Build a map: iso-date → [{...janela, releaseName, releaseId}]
  const eventsByDay = {};
  releases.forEach(rel => {
    (rel.janelas || []).forEach(j => {
      if (!eventsByDay[j.data]) eventsByDay[j.data] = [];
      eventsByDay[j.data].push({ ...j, releaseName: rel.nome, releaseId: rel.id });
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

  const selectedEvents = selectedDay ? (eventsByDay[selectedDay] || []) : [];

  // Find a release that has events on selectedDay, or default to first release
  const defaultRelease = releases[0] || null;

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {/* ── Calendar grid ── */}
      <div style={{ flex: '0 0 auto', minWidth: 300, background: 'var(--gray-2)', border: '1px solid var(--gray-5)', borderRadius: 10, padding: 14 }}>
        {/* Header: month navigation */}
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

        {/* Week headers */}
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
            const events = eventsByDay[cell.iso] || [];
            const hasDeploy = events.some(e => e.tipo === 'deploy');
            const hasCab = events.some(e => e.tipo === 'cab');
            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => setSelectedDay(isSelected ? null : cell.iso)}
                style={{
                  padding: '4px 2px', borderRadius: 6, cursor: 'pointer',
                  border: isSelected ? '2px solid var(--indigo-9)' : isToday ? '1px solid var(--indigo-7)' : '1px solid transparent',
                  background: isSelected ? 'rgba(99,102,241,0.2)' : isToday ? 'rgba(99,102,241,0.08)' : 'transparent',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  minHeight: 34,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: isToday ? 800 : 500, color: isToday ? 'var(--indigo-11)' : 'var(--gray-12)' }}>
                  {cell.day}
                </span>
                {(hasDeploy || hasCab) && (
                  <div style={{ display: 'flex', gap: 2 }}>
                    {hasDeploy && <EventDot tipo="deploy" />}
                    {hasCab && <EventDot tipo="cab" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--gray-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <EventDot tipo="deploy" />
            <span style={{ fontSize: 11, color: 'var(--gray-9)' }}>Deploy</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <EventDot tipo="cab" />
            <span style={{ fontSize: 11, color: 'var(--gray-9)' }}>CAB</span>
          </div>
        </div>
      </div>

      {/* ── Day detail panel ── */}
      <div style={{ flex: 1, minWidth: 260 }}>
        {selectedDay ? (
          <div style={{ background: 'var(--gray-2)', border: '1px solid var(--gray-5)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--gray-4)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-12)' }}>
                {(() => { const p = selectedDay.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; })()}
              </span>
              {defaultRelease && (
                <button
                  type="button"
                  onClick={() => setAddModal({ release: defaultRelease, date: selectedDay })}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--indigo-7)', background: 'rgba(99,102,241,0.12)', color: 'var(--indigo-11)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  <Plus size={13} /> Registrar
                </button>
              )}
            </div>
            {selectedEvents.length === 0 ? (
              <div style={{ padding: '20px 14px', textAlign: 'center', fontSize: 12, color: 'var(--gray-9)' }}>
                Nenhum evento neste dia.
              </div>
            ) : (
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selectedEvents.map((ev, i) => (
                  <div key={ev.id || i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: ev.tipo === 'deploy' ? 'rgba(34,211,238,0.08)' : 'rgba(251,146,60,0.08)', border: `1px solid ${ev.tipo === 'deploy' ? 'rgba(34,211,238,0.3)' : 'rgba(251,146,60,0.3)'}` }}>
                    <EventDot tipo={ev.tipo} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: ev.tipo === 'deploy' ? '#22d3ee' : '#fb923c' }}>
                        {ev.tipo === 'deploy' ? '🚀 Deploy' : '📋 CAB'}
                        {ev.hora && <span style={{ fontWeight: 400, color: 'var(--gray-9)', marginLeft: 6 }}>{ev.hora}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--gray-10)', marginTop: 1 }}>{ev.releaseName}</div>
                      {ev.descricao && <div style={{ fontSize: 11, color: 'var(--gray-9)', marginTop: 1, fontStyle: 'italic' }}>{ev.descricao}</div>}
                    </div>
                    <button
                      type="button"
                      title="Remover"
                      onClick={() => removeJanela(ev.releaseId, { id: ev.id, tipo: ev.tipo, data: ev.data, hora: ev.hora, descricao: ev.descricao })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red-9)', padding: 3, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '24px 14px', textAlign: 'center', fontSize: 12, color: 'var(--gray-9)', background: 'var(--gray-2)', border: '1px solid var(--gray-5)', borderRadius: 10 }}>
            Clique em um dia para ver ou registrar eventos.
          </div>
        )}
      </div>

      {/* Add modal */}
      {addModal && (
        <AddJanelaModal
          release={addModal.release}
          initialDate={addModal.date}
          onClose={() => setAddModal(null)}
        />
      )}
    </div>
  );
}
