import React, { useState, useCallback, useEffect, useRef } from 'react';
import { X, ChevronDown, Save } from 'lucide-react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { PRIORIDADE_INTERNA_OPTIONS } from '../../services/operacaoRadarService';
import { stripNumericPrefix } from '../../utils/stripNumericPrefix';

function useSystems() {
  const [v, set] = useState([]);
  useEffect(() => { getDocs(query(collection(db, 'systems'), orderBy('createdAt', 'asc'))).then(s => set(s.docs.map(d => ({ id: d.id, ...d.data() })))).catch(() => {}); }, []);
  return v;
}
function useSquads() {
  const [v, set] = useState([]);
  useEffect(() => { getDocs(query(collection(db, 'squads'), orderBy('name', 'asc'))).then(s => { set(s.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.name).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))); }).catch(() => {}); }, []);
  return v;
}
function useTeamMembers() {
  const [v, set] = useState([]);
  useEffect(() => {
    getDocs(query(collection(db, 'users'), orderBy('displayName', 'asc'))).then(s => {
      set(s.docs.map(d => ({ id: d.id, ...d.data() }))
        .map(u => ({ id: u.id, label: u.displayName || u.shortName || u.name || u.email || u.id || '' }))
        .filter(u => u.label).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')));
    }).catch(() => {});
  }, []);
  return v;
}

const fmtDate = v => { if (!v) return '—'; const s = String(v).slice(0, 10); if (s.length < 10) return String(v); const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };

function FL({ children }) { return <span className="dmd-field-label">{children}</span>; }

function ReadField({ label, value, wide, tall }) {
  return (
    <div className={`dmd-field${wide ? ' dmd-field--wide' : ''}${tall ? ' dmd-field--tall' : ''}`}>
      <FL>{label}</FL>
      <div className="dmd-field-value">{value != null && value !== '' ? String(value) : '—'}</div>
    </div>
  );
}

function EditText({ label, fieldKey, value, onChange, wide }) {
  const [l, sl] = useState(value ?? '');
  useEffect(() => sl(value ?? ''), [value]);
  return (
    <div className={`dmd-field${wide ? ' dmd-field--wide' : ''}`}>
      <FL>{label}</FL>
      <input className="dmd-input" value={l} onChange={e => sl(e.target.value)} onBlur={() => onChange(fieldKey, l)} />
    </div>
  );
}

function EditTextarea({ label, fieldKey, value, onChange }) {
  const [l, sl] = useState(value ?? '');
  useEffect(() => sl(value ?? ''), [value]);
  return (
    <div className="dmd-field dmd-field--wide">
      <FL>{label}</FL>
      <textarea className="dmd-input dmd-textarea" value={l} rows={4} onChange={e => sl(e.target.value)} onBlur={() => onChange(fieldKey, l)} />
    </div>
  );
}

function EditNumber({ label, fieldKey, value, onChange }) {
  const [l, sl] = useState(value ?? '');
  useEffect(() => sl(value ?? ''), [value]);
  return (
    <div className="dmd-field">
      <FL>{label}</FL>
      <input type="number" className="dmd-input" value={l} onChange={e => { sl(e.target.value); onChange(fieldKey, e.target.value === '' ? null : Number(e.target.value)); }} />
    </div>
  );
}

function EditSelect({ label, fieldKey, options, value, onChange }) {
  return (
    <div className="dmd-field">
      <FL>{label}</FL>
      <select className="dmd-input" value={value ?? ''} onChange={e => onChange(fieldKey, e.target.value === '' ? null : e.target.value)}>
        <option value="">—</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function EditToggle({ label, fieldKey, value, onChange }) {
  const [l, sl] = useState(value === true || value === 'true');
  useEffect(() => sl(value === true || value === 'true'), [value]);
  const tog = () => { const n = !l; sl(n); onChange(fieldKey, n); };
  return (
    <div className="dmd-field">
      <FL>{label}</FL>
      <button type="button" className={`dmd-toggle${l ? ' dmd-toggle--on' : ''}`} onClick={tog}>{l ? 'Sim' : 'Não'}</button>
    </div>
  );
}

function EditDate({ label, fieldKey, value, onChange }) {
  const [l, sl] = useState(value ? String(value).slice(0, 10) : '');
  useEffect(() => sl(value ? String(value).slice(0, 10) : ''), [value]);
  return (
    <div className="dmd-field">
      <FL>{label}</FL>
      <input type="date" className="dmd-input" value={l} onChange={e => sl(e.target.value)} onBlur={() => onChange(fieldKey, l || null)} />
    </div>
  );
}

const PRIO_OPTIONS = (PRIORIDADE_INTERNA_OPTIONS || []).map(p => ({ value: String(p.value), label: p.description ? `${p.label} — ${p.description}` : p.label }));

function EditPersonCombobox({ label, fieldKey, value, onChange, members }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  useEffect(() => { if (!open) setSearch(''); }, [open]);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const filtered = search ? members.filter(m => m.label.toLowerCase().includes(search.toLowerCase())) : members;
  const pick = m => { onChange(fieldKey, m ? m.label : null); setOpen(false); setSearch(''); };
  return (
    <div className="dmd-field dmd-field--wide" ref={ref} style={{ position: 'relative' }}>
      <FL>{label}</FL>
      <button type="button" className="dmd-combobox-trigger" onClick={() => setOpen(v => !v)}>
        <span className={value ? 'dmd-combobox-value' : 'dmd-combobox-placeholder'}>{value || 'Selecionar...'}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="dmd-combobox-dropdown">
          <input autoFocus className="dmd-combobox-search" placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Escape' && setOpen(false)} />
          <div className="dmd-combobox-list">
            <button type="button" className="dmd-combobox-item dmd-combobox-item--clear" onClick={() => pick(null)}>— Nenhum</button>
            {filtered.map(m => <button key={m.id} type="button" className={`dmd-combobox-item${value === m.label ? ' dmd-combobox-item--selected' : ''}`} onClick={() => pick(m)}>{m.label}</button>)}
            {filtered.length === 0 && <span className="dmd-combobox-empty">Nenhum resultado</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function PlanRow({ left, right }) {
  return <div className="dmd-plan-row"><div className="dmd-plan-cell">{left || null}</div><div className="dmd-plan-cell">{right || null}</div></div>;
}

export default function DemandaDetailsModal({ ticket, mode, onClose, onSave }) {
  const [activeTab, setActiveTab] = useState('geral');
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const isEdit = mode === 'edit';
  const teamMembers = useTeamMembers();
  const systems = useSystems();
  const squads = useSquads();

  useEffect(() => { setActiveTab('geral'); setDraft({}); }, [ticket?.issueKey]);

  const val = useCallback((field) => (field in draft ? draft[field] : (ticket?.[field] ?? null)), [draft, ticket]);
  const handleChange = useCallback((field, value) => setDraft(prev => ({ ...prev, [field]: value })), []);

  const handleSaveAll = useCallback(async () => {
    if (!ticket?.issueKey) return;
    const entries = Object.entries(draft);
    if (!entries.length) { onClose(); return; }
    setSaving(true);
    try {
      for (const [field, value] of entries) { if (onSave) await onSave(ticket.issueKey, field, value); }
      setDraft({});
      onClose();
    } catch (e) {
      console.error('[DemandaDetailsModal] save error:', e);
    } finally { setSaving(false); }
  }, [ticket, draft, onSave, onClose]);

  const handleCancel = useCallback(() => { setDraft({}); onClose(); }, [onClose]);
  const isDirty = Object.keys(draft).length > 0;

  if (!ticket) return null;

  const squadPrincipal = val('squadPrincipal');
  const prioLabel = (() => {
    const prio = val('prioridadeInterna');
    if (prio != null) {
      const f = (PRIORIDADE_INTERNA_OPTIONS || []).find(p => String(p.value) === String(prio));
      if (f) return f.description ? `${f.label} — ${f.description}` : f.label;
      return `P${prio}`;
    }
    return ticket.priority || '—';
  })();

  const squadLabel = stripNumericPrefix(ticket.grupoSuporte) || ticket.squad || '—';
  const statusLabel = ticket.status || '—';

  const squadTags = (() => {
    if (!ticket.sistemasImpactados || !systems.length || !squads.length) return [];
    const sysNames = String(ticket.sistemasImpactados).split(',').map(s => s.trim()).filter(Boolean);
    const ids = [...new Set(sysNames.map(n => systems.find(s => s.name?.trim().toLowerCase() === n.toLowerCase())?.squadId).filter(Boolean))];
    return ids.map(id => squads.find(sq => sq.id === id)?.name).filter(Boolean);
  })();

  return (
    <div className="dmd-overlay" onClick={e => { if (e.target === e.currentTarget) handleCancel(); }}>
      <div className="dmd-modal">

        {/* HEADER */}
        <div className="dmd-modal-header">
          <div className="dmd-modal-header-left" style={{ flexWrap: 'wrap', gap: 6 }}>
            <span className="dmd-modal-issue-key">{ticket.issueKey}</span>
            <span className="dmd-badge dmd-badge--squad">{squadLabel}</span>
            <span className="dmd-badge dmd-badge--status">{statusLabel}</span>
            {squadTags.map((name, idx) => {
              const isPrincipal = squadPrincipal === name;
              return isEdit ? (
                <button
                  key={idx}
                  type="button"
                  title={isPrincipal ? 'Squad principal selecionada' : 'Clique para definir como squad principal'}
                  onClick={() => handleChange('squadPrincipal', isPrincipal ? null : name)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', cursor: 'pointer',
                    background: isPrincipal ? 'rgba(16,185,129,0.35)' : 'rgba(16,185,129,0.08)',
                    border: isPrincipal ? '2px solid rgba(16,185,129,0.9)' : '1px dashed rgba(16,185,129,0.4)',
                    borderRadius: 999, padding: '3px 12px', fontSize: 12,
                    color: isPrincipal ? 'rgb(16,185,129)' : 'rgba(16,185,129,0.7)',
                    fontWeight: isPrincipal ? 700 : 400,
                  }}
                >
                  {isPrincipal ? '★ ' : ''}{name}
                </button>
              ) : (
                <span
                  key={idx}
                  style={{
                    display: 'inline-flex', alignItems: 'center',
                    background: isPrincipal ? 'rgba(16,185,129,0.35)' : 'rgba(16,185,129,0.08)',
                    border: isPrincipal ? '2px solid rgba(16,185,129,0.9)' : '1px dashed rgba(16,185,129,0.4)',
                    borderRadius: 999, padding: '3px 12px', fontSize: 12,
                    color: isPrincipal ? 'rgb(16,185,129)' : 'rgba(16,185,129,0.7)',
                    fontWeight: isPrincipal ? 700 : 400,
                  }}
                >
                  {isPrincipal ? '★ ' : ''}{name}
                </span>
              );
            })}
          </div>
          <button className="dmd-modal-close" onClick={handleCancel} title="Fechar"><X size={18} /></button>
        </div>

        {/* TABS */}
        <div className="dmd-tabs">
          {['geral', 'planejamento'].map(tab => (
            <button
              key={tab}
              type="button"
              className={`dmd-tab${activeTab === tab ? ' dmd-tab--active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'geral' ? 'Geral' : 'Planejamento'}
            </button>
          ))}
        </div>

        {/* BODY */}
        <div className="dmd-modal-body">

          {/* ── TAB: GERAL ── */}
          {activeTab === 'geral' && (
            <div className="dmd-fields-grid">
              <ReadField label="Título" value={ticket.summary} wide />
              <ReadField label="Prioridade Jira" value={ticket.priority} />
              <ReadField label="Status" value={statusLabel} />
              <ReadField label="Criado em" value={fmtDate(ticket.created)} />
              <ReadField label="Atualizado em" value={fmtDate(ticket.updated)} />
              <ReadField label="Sistemas Impactados" value={ticket.sistemasImpactados} wide />
              <ReadField label="Grupo Suporte" value={ticket.grupoSuporte} />
              <ReadField label="Reporter" value={ticket.reporter} />
              <ReadField label="Assignee" value={ticket.assignee} />

              {isEdit ? (
                <EditSelect
                  label="Prioridade Interna"
                  fieldKey="prioridadeInterna"
                  options={PRIO_OPTIONS}
                  value={val('prioridadeInterna') != null ? String(val('prioridadeInterna')) : null}
                  onChange={handleChange}
                />
              ) : (
                <ReadField label="Prioridade Interna" value={prioLabel} />
              )}

              {isEdit ? (
                <EditText label="Escopo" fieldKey="escopo" value={val('escopo')} onChange={handleChange} />
              ) : (
                <ReadField label="Escopo" value={val('escopo')} />
              )}

              {isEdit ? (
                <EditToggle label="Visível no Roadmap" fieldKey="visivelRoadmap" value={val('visivelRoadmap')} onChange={handleChange} />
              ) : (
                <ReadField label="Visível no Roadmap" value={val('visivelRoadmap') ? 'Sim' : 'Não'} />
              )}

              {isEdit ? (
                <EditTextarea label="Observação" fieldKey="observacao" value={val('observacao')} onChange={handleChange} />
              ) : (
                <ReadField label="Observação" value={val('observacao')} wide tall />
              )}
            </div>
          )}

          {/* ── TAB: PLANEJAMENTO ── */}
          {activeTab === 'planejamento' && (
            <div className="dmd-fields-grid">
              <PlanRow
                left={isEdit
                  ? <EditNumber label="Estimativa Interna (h)" fieldKey="estimativaInterna" value={val('estimativaInterna')} onChange={handleChange} />
                  : <ReadField label="Estimativa Interna (h)" value={val('estimativaInterna')} />}
                right={isEdit
                  ? <EditNumber label="Tamanho T-Shirt" fieldKey="tshirtSize" value={val('tshirtSize')} onChange={handleChange} />
                  : <ReadField label="Tamanho T-Shirt" value={val('tshirtSize')} />}
              />
              <PlanRow
                left={isEdit
                  ? <EditDate label="Previsão Início" fieldKey="previsaoInicio" value={val('previsaoInicio')} onChange={handleChange} />
                  : <ReadField label="Previsão Início" value={fmtDate(val('previsaoInicio'))} />}
                right={isEdit
                  ? <EditDate label="Previsão Fim" fieldKey="previsaoFim" value={val('previsaoFim')} onChange={handleChange} />
                  : <ReadField label="Previsão Fim" value={fmtDate(val('previsaoFim'))} />}
              />
              <PlanRow
                left={isEdit
                  ? <EditDate label="Data Real Início" fieldKey="dataRealInicio" value={val('dataRealInicio')} onChange={handleChange} />
                  : <ReadField label="Data Real Início" value={fmtDate(val('dataRealInicio'))} />}
                right={isEdit
                  ? <EditDate label="Data Real Fim" fieldKey="dataRealFim" value={val('dataRealFim')} onChange={handleChange} />
                  : <ReadField label="Data Real Fim" value={fmtDate(val('dataRealFim'))} />}
              />
              {isEdit ? (
                <EditPersonCombobox
                  label="Responsável Desenvolvimento"
                  fieldKey="responsavelDesenvolvimento"
                  value={val('responsavelDesenvolvimento')}
                  onChange={handleChange}
                  members={teamMembers}
                />
              ) : (
                <ReadField label="Responsável Desenvolvimento" value={val('responsavelDesenvolvimento')} wide />
              )}
              {isEdit ? (
                <EditPersonCombobox
                  label="Responsável Teste Interno"
                  fieldKey="responsavelTesteInterno"
                  value={val('responsavelTesteInterno')}
                  onChange={handleChange}
                  members={teamMembers}
                />
              ) : (
                <ReadField label="Responsável Teste Interno" value={val('responsavelTesteInterno')} wide />
              )}
              {isEdit ? (
                <EditText label="Repositório" fieldKey="repositorio" value={val('repositorio')} onChange={handleChange} wide />
              ) : (
                <ReadField label="Repositório" value={val('repositorio')} wide />
              )}
              {isEdit ? (
                <EditTextarea label="Notas de Planejamento" fieldKey="notasPlanejamento" value={val('notasPlanejamento')} onChange={handleChange} />
              ) : (
                <ReadField label="Notas de Planejamento" value={val('notasPlanejamento')} wide tall />
              )}
            </div>
          )}
        </div>

        {/* FOOTER: Save / Cancel (edit mode only) */}
        {isEdit && (
          <div className="dmd-modal-footer">
            <button
              type="button"
              className="dmd-btn dmd-btn--secondary"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={`dmd-btn dmd-btn--primary${isDirty ? '' : ' dmd-btn--disabled'}`}
              onClick={handleSaveAll}
              disabled={saving}
              title={isDirty ? 'Salvar alterações' : 'Nenhuma alteração pendente'}
            >
              <Save size={14} />
              {saving ? 'Salvando…' : isDirty ? `Salvar (${Object.keys(draft).length})` : 'Salvar'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
