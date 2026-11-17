import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Package, Pencil, Save, X, Layers } from 'lucide-react';
import { subscribeToReleases, deleteRelease } from '../services/releaseService';
import { NewReleaseModal, AddJanelaModal } from './GestaoReleaseModals';
import ReleaseCalendar from './GestaoReleaseCalendar';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs, serverTimestamp } from 'firebase/firestore';

const SISTEMAS_COL = 'sistemas_alterados';
const CATEGORIAS = ['Modernizado', 'Legado'];
function catStyle(c) { return c === 'Modernizado' ? { color: '#22d3ee', bg: 'rgba(34,211,238,0.1)', border: 'rgba(34,211,238,0.35)' } : { color: '#fb923c', bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.35)' }; }

function SistemasAlteradosSection() {
  const [sistemas, setSistemas] = useState([]);
  const [squads, setSquads] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ nome: '', categoria: 'Modernizado', squadId: '', squadNome: '' });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  useEffect(() => { const q = query(collection(db, SISTEMAS_COL), orderBy('createdAt', 'asc')); return onSnapshot(q, snap => setSistemas(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {}); }, []);
  useEffect(() => { getDocs(query(collection(db, 'squads'), orderBy('createdAt', 'desc'))).then(snap => setSquads(snap.docs.map(d => ({ id: d.id, ...d.data() })))).catch(() => {}); }, []);
  const startNew = () => { setForm({ nome: '', categoria: 'Modernizado', squadId: '', squadNome: '' }); setEditingId('new'); };
  const startEdit = s => { setForm({ nome: s.nome || '', categoria: s.categoria || 'Modernizado', squadId: s.squadId || '', squadNome: s.squadNome || '' }); setEditingId(s.id); };
  const cancel = () => { setEditingId(null); setForm({ nome: '', categoria: 'Modernizado', squadId: '', squadNome: '' }); };
  const onSquad = e => { const sq = squads.find(s => s.id === e.target.value); setForm(p => ({ ...p, squadId: e.target.value, squadNome: sq?.name || '' })); };
  const handleSave = async () => {
    if (!form.nome.trim()) return; setSaving(true);
    try {
      const d = { nome: form.nome.trim(), categoria: form.categoria, squadId: form.squadId, squadNome: form.squadNome };
      if (editingId === 'new') await addDoc(collection(db, SISTEMAS_COL), { ...d, createdAt: serverTimestamp() });
      else await updateDoc(doc(db, SISTEMAS_COL, editingId), { ...d, updatedAt: serverTimestamp() });
      cancel();
    } catch { } finally { setSaving(false); }
  };
  const handleDel = async id => {
    if (!window.confirm('Excluir este sistema?')) return; setDeletingId(id);
    try { await deleteDoc(doc(db, SISTEMAS_COL, id)); } catch { } finally { setDeletingId(null); }
  };
  const inp = { padding: '5px 9px', borderRadius: 6, border: '1px solid var(--gray-6)', background: 'var(--gray-1)', color: 'var(--gray-12)', fontSize: 12, outline: 'none' };
  return (
    <div style={{ marginTop: 24, borderTop: '2px solid var(--gray-5)', paddingTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={14} color="var(--indigo-11)" />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-10)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Sistemas Alterados</span>
          {sistemas.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 8, background: 'rgba(99,102,241,0.15)', color: 'var(--indigo-11)', border: '1px solid rgba(99,102,241,0.3)' }}>{sistemas.length}</span>}
        </div>
        {editingId === null && <button type="button" onClick={startNew} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: 'none', background: 'var(--indigo-9)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}><Plus size={12} /> Novo Sistema</button>}
      </div>
      {editingId === 'new' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '10px 12px', borderRadius: 9, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.3)', marginBottom: 8 }}>
          <input autoFocus value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') cancel(); }} placeholder="Nome do sistema *" style={{ ...inp, flex: 2, minWidth: 160, border: '1px solid rgba(99,102,241,0.5)', background: 'rgba(99,102,241,0.05)' }} />
          <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} style={{ ...inp, minWidth: 130, cursor: 'pointer' }}>{CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}</select>
          <select value={form.squadId} onChange={onSquad} style={{ ...inp, minWidth: 160, cursor: 'pointer' }}><option value="">— Squad —</option>{squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <button type="button" onClick={handleSave} disabled={saving || !form.nome.trim()} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 14px', borderRadius: 6, border: 'none', background: 'var(--indigo-9)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: (!form.nome.trim() || saving) ? 0.6 : 1 }}><Save size={12} /> {saving ? '...' : 'Salvar'}</button>
          <button type="button" onClick={cancel} style={{ display: 'flex', alignItems: 'center', padding: '5px 10px', borderRadius: 6, border: '1px solid var(--gray-6)', background: 'var(--gray-3)', color: 'var(--gray-11)', fontSize: 12, cursor: 'pointer' }}><X size={12} /></button>
        </div>
      )}
      {sistemas.length === 0 && editingId === null ? (
        <div style={{ padding: '20px 14px', textAlign: 'center', fontSize: 12, color: 'var(--gray-9)', background: 'var(--gray-2)', border: '1px solid var(--gray-5)', borderRadius: 9 }}>Nenhum sistema cadastrado. Clique em <strong>Novo Sistema</strong> para comecar.</div>
      ) : sistemas.length > 0 ? (
        <div style={{ borderRadius: 9, border: '1px solid var(--gray-5)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--gray-3)' }}>{['NOME','CATEGORIA','SQUAD',''].map((h,i) => <th key={i} style={{ padding: '7px 12px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--gray-9)', textAlign: i===3?'center':'left', borderBottom: '1px solid var(--gray-5)' }}>{h}</th>)}</tr></thead>
            <tbody>{sistemas.map((s, idx) => {
              const cc = catStyle(s.categoria); const isEdit = editingId === s.id;
              return (
                <tr key={s.id} style={{ borderBottom: idx < sistemas.length-1 ? '1px solid var(--gray-4)' : 'none', background: isEdit ? 'rgba(99,102,241,0.04)' : idx%2!==0 ? 'var(--gray-1)' : undefined }}>
                  <td style={{ padding: '7px 12px', fontSize: 13, color: 'var(--gray-12)', fontWeight: 600 }}>
                    {isEdit ? <input autoFocus value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} onKeyDown={e => { if (e.key==='Enter') handleSave(); if (e.key==='Escape') cancel(); }} style={{ ...inp, width: '100%', border: '1px solid rgba(99,102,241,0.5)' }} /> : (s.nome||'—')}
                  </td>
                  <td style={{ padding: '7px 12px' }}>
                    {isEdit ? <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}>{CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}</select>
                    : <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 7, background: cc.bg, border: `1px solid ${cc.border}`, color: cc.color, whiteSpace: 'nowrap' }}>{s.categoria||'—'}</span>}
                  </td>
                  <td style={{ padding: '7px 12px' }}>
                    {isEdit ? <select value={form.squadId} onChange={onSquad} style={{ ...inp, cursor: 'pointer' }}><option value="">— Squad —</option>{squads.map(sq => <option key={sq.id} value={sq.id}>{sq.name}</option>)}</select>
                    : s.squadNome ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 7, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7', whiteSpace: 'nowrap' }}>{s.squadNome}</span> : <span style={{ fontSize: 11, color: 'var(--gray-7)' }}>—</span>}
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {isEdit ? (
                      <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
                        <button type="button" onClick={handleSave} disabled={saving||!form.nome.trim()} style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:6, border:'none', background:'var(--indigo-9)', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', opacity:(!form.nome.trim()||saving)?0.6:1 }}><Save size={11}/> {saving?'...':'Ok'}</button>
                        <button type="button" onClick={cancel} style={{ display:'flex', alignItems:'center', padding:'4px 7px', borderRadius:6, border:'1px solid var(--gray-6)', background:'var(--gray-3)', color:'var(--gray-11)', fontSize:11, cursor:'pointer' }}><X size={11}/></button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <button type="button" onClick={() => startEdit(s)} style={{ padding:'4px 7px', borderRadius:6, border:'1px solid var(--indigo-6)', background:'var(--indigo-3)', color:'var(--indigo-11)', cursor:'pointer', display:'flex', alignItems:'center' }}><Pencil size={12}/></button>
                        <button type="button" disabled={deletingId===s.id} onClick={() => handleDel(s.id)} style={{ padding:'4px 7px', borderRadius:6, border:'1px solid var(--red-6)', background:'var(--red-3)', color:'var(--red-10)', cursor:'pointer', display:'flex', alignItems:'center', opacity:deletingId===s.id?0.5:1 }}><Trash2 size={12}/></button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
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

export default function GestaoReleaseTab({ tickets = [] }) {
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
  // Tickets vinculados ao pacote selecionado
  const releaseTickets = selected
    ? tickets.filter(t => t.pacote && t.pacote === selected.nome)
    : [];

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

      {/* ── Calendar + Tickets section ── */}
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

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Calendar */}
            <ReleaseCalendar releases={calendarReleases} />

            {/* Tickets do pacote selecionado */}
            {selected && (
              <div style={{ flex: 1, minWidth: 280 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-9)', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  TICKETS DO PACOTE
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 8, background: 'rgba(99,102,241,0.15)', color: 'var(--indigo-11)', border: '1px solid rgba(99,102,241,0.3)' }}>
                    {releaseTickets.length}
                  </span>
                </div>
                {releaseTickets.length === 0 ? (
                  <div style={{ padding: '20px 14px', textAlign: 'center', fontSize: 12, color: 'var(--gray-9)', background: 'var(--gray-2)', border: '1px solid var(--gray-5)', borderRadius: 10 }}>
                    Nenhum ticket com pacote <strong>{selected.nome}</strong>.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 460, overflowY: 'auto' }}>
                    {releaseTickets.map(t => {
                      const pct = t.percentualConclusao != null ? Number(t.percentualConclusao) : null;
                      const pctColor = pct == null ? '#6b7280' : pct >= 100 ? '#4ade80' : pct >= 75 ? '#22d3ee' : pct >= 40 ? '#fbbf24' : '#f87171';
                      return (
                        <div key={t.issueKey || t.id} style={{
                          padding: '8px 12px', borderRadius: 8,
                          background: 'var(--gray-2)', border: '1px solid var(--gray-5)',
                          display: 'flex', flexDirection: 'column', gap: 4,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--indigo-11)', fontFamily: 'monospace', flexShrink: 0 }}>
                              {t.issueKey}
                            </span>
                            {t.status && (
                              <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 6, background: 'var(--gray-4)', color: 'var(--gray-10)', whiteSpace: 'nowrap' }}>
                                {t.status}
                              </span>
                            )}
                            {(t._resolvedSquad || t.squadPrincipal) && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 6, background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)', whiteSpace: 'nowrap' }}>
                                {t._resolvedSquad || t.squadPrincipal}
                              </span>
                            )}
                            {pct != null && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: `${pctColor}18`, color: pctColor, border: `1px solid ${pctColor}44`, marginLeft: 'auto', flexShrink: 0 }}>
                                {pct}%
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--gray-11)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.summary}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Sistemas Alterados ── */}
      <SistemasAlteradosSection />

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
