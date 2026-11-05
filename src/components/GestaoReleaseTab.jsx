import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Package } from 'lucide-react';
import { subscribeToReleases, deleteRelease } from '../services/releaseService';
import { NewReleaseModal, AddJanelaModal } from './GestaoReleaseModals';
import ReleaseCalendar from './GestaoReleaseCalendar';

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
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap',
      background: h ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.15)',
      color: h ? '#fbbf24' : '#f87171',
      border: `1px solid ${h ? 'rgba(251,191,36,0.45)' : 'rgba(239,68,68,0.45)'}`,
    }}>{ambiente}</span>
  );
}

function TipoBadge({ tipo }) {
  if (!tipo) return null;
  const f = tipo === 'Janela Fixa';
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap',
      background: f ? 'rgba(99,102,241,0.15)' : 'rgba(6,182,212,0.15)',
      color: f ? '#a5b4fc' : '#22d3ee',
      border: `1px solid ${f ? 'rgba(99,102,241,0.4)' : 'rgba(6,182,212,0.4)'}`,
    }}>{tipo}</span>
  );
}

export default function GestaoReleaseTab() {
  const [releases, setReleases] = useState([]);
  const [showNewRelease, setShowNewRelease] = useState(false);
  const [addJanelaFor, setAddJanelaFor] = useState(null); // release object
  const [selectedRelease, setSelectedRelease] = useState(null); // id

  useEffect(() => {
    return subscribeToReleases(list => {
      setReleases(list);
      // Auto-select first release if none selected
      setSelectedRelease(prev => {
        if (prev) return prev;
        return list[0]?.id || null;
      });
    });
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir esta release?')) return;
    try { await deleteRelease(id); } catch (e) { console.error(e); }
  };

  const selected = releases.find(r => r.id === selectedRelease) || null;
  // For calendar: show all releases (or only selected one)
  const calendarReleases = selected ? [selected] : releases;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Section header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Package size={18} color="var(--indigo-11)" />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--gray-12)' }}>
            Gestão de Release
          </h3>
          {releases.length > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'rgba(99,102,241,0.15)', color: 'var(--indigo-11)', border: '1px solid rgba(99,102,241,0.3)' }}>
              {releases.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowNewRelease(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--indigo-9)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          <Plus size={14} /> Nova Release
        </button>
      </div>

      {/* ── Releases list ── */}
      {releases.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--gray-9)', fontSize: 13 }}>
          Nenhuma release cadastrada. Clique em <strong>Nova Release</strong> para começar.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {releases.map(rel => {
            const isSelected = rel.id === selectedRelease;
            const janelaCount = (rel.janelas || []).length;
            return (
              <div
                key={rel.id}
                onClick={() => setSelectedRelease(isSelected ? null : rel.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
                  borderRadius: 10, cursor: 'pointer', flexWrap: 'wrap',
                  border: isSelected ? '1px solid rgba(99,102,241,0.6)' : '1px solid var(--gray-5)',
                  background: isSelected ? 'rgba(99,102,241,0.07)' : 'var(--gray-2)',
                  transition: 'all 0.12s',
                }}
              >
                <Package size={15} color={isSelected ? 'var(--indigo-11)' : 'var(--gray-9)'} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-12)', marginRight: 4 }}>
                  {rel.nome}
                </span>
                <AmbienteBadge ambiente={rel.ambiente} />
                <TipoBadge tipo={rel.tipo} />
                {rel.dataAlvo && (
                  <span style={{ fontSize: 11, color: 'var(--gray-9)', whiteSpace: 'nowrap' }}>
                    🎯 {fmtBr(rel.dataAlvo)}
                  </span>
                )}
                {/* Janelas chips — inline with other badges */}
                {(rel.janelas || [])
                  .slice()
                  .sort((a, b) => (a.data > b.data ? 1 : -1))
                  .map((j, i) => {
                    const isDeploy = j.tipo === 'deploy';
                    const color = isDeploy ? '#22d3ee' : '#fb923c';
                    const bg = isDeploy ? 'rgba(34,211,238,0.10)' : 'rgba(251,146,60,0.10)';
                    const border = isDeploy ? 'rgba(34,211,238,0.3)' : 'rgba(251,146,60,0.3)';
                    const p = j.data ? j.data.split('-') : [];
                    const dateFmt = p.length === 3 ? `${p[2]}/${p[1]}` : j.data;
                    return (
                      <span
                        key={j.id || i}
                        title={`${isDeploy ? 'Deploy' : 'CAB'}${j.hora ? ' · ' + j.hora : ''}${j.descricao ? ' — ' + j.descricao : ''}`}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          fontSize: 10, fontWeight: 700, padding: '2px 7px',
                          borderRadius: 8, whiteSpace: 'nowrap',
                          background: bg, color, border: `1px solid ${border}`,
                          flexShrink: 0,
                        }}
                      >
                        {isDeploy ? '🚀' : '📋'} {dateFmt}{j.hora ? ` ${j.hora}` : ''}
                      </span>
                    );
                  })}
                {/* Spacer pushes action buttons to the right */}
                <span style={{ flex: 1 }} />
                <button
                  type="button"
                  title="Adicionar janela/CAB"
                  onClick={e => { e.stopPropagation(); setAddJanelaFor(rel); }}
                  style={{ background: 'none', border: '1px solid var(--gray-5)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: 'var(--gray-10)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, flexShrink: 0 }}
                >
                  <Plus size={11} /> Janela
                </button>
                <button
                  type="button"
                  title="Excluir release"
                  onClick={e => { e.stopPropagation(); handleDelete(rel.id); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red-9)', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Calendar section ── */}
      {releases.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--gray-5)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-10)', letterSpacing: '0.05em' }}>
              CALENDÁRIO DE JANELAS E CABs
            </span>
            {selected && (
              <span style={{ fontSize: 11, color: 'var(--indigo-11)', fontWeight: 600 }}>
                — {selected.nome}
              </span>
            )}
            {!selected && (
              <span style={{ fontSize: 11, color: 'var(--gray-9)' }}>
                (selecione uma release acima para filtrar)
              </span>
            )}
          </div>
          <ReleaseCalendar releases={calendarReleases} />
        </div>
      )}

      {/* ── Modals ── */}
      {showNewRelease && <NewReleaseModal onClose={() => setShowNewRelease(false)} />}
      {addJanelaFor && (
        <AddJanelaModal
          release={addJanelaFor}
          onClose={() => setAddJanelaFor(null)}
        />
      )}
    </div>
  );
}
