import React, { useState, useCallback, useEffect, useRef } from 'react';
import { X, ChevronDown, History } from 'lucide-react';
import { collection, getDocs, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { PRIORIDADE_INTERNA_OPTIONS } from '../../services/operacaoRadarService';
import { stripNumericPrefix } from '../../utils/stripNumericPrefix';

function useSystems() {
  const [systems, setSystems] = useState([]);
  useEffect(() => {
    getDocs(query(collection(db, 'systems'), orderBy('createdAt', 'asc')))
      .then((snap) => setSystems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch(() => {});
  }, []);
  return systems;
}

function useSquads() {
  const [squads, setSquads] = useState([]);
  useEffect(() => {
    getDocs(query(collection(db, 'squads'), orderBy('createdAt', 'desc')))
      .then((snap) => setSquads(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch(() => {});
  }, []);
  return squads;
}

function getUserLabel(u) {
  return u?.displayName || u?.shortName || u?.name || u?.email || u?.id || '';
}

function useTeamMembers() {
  const [members, setMembers] = useState([]);
  useEffect(() => {
    getDocs(query(collection(db, 'users'), orderBy('displayName', 'asc')))
      .then((snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .map((u) => ({ id: u.id, label: getUserLabel(u) }))
          .filter((u) => u.label)
          .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
        setMembers(list);
      })
      .catch(() => {});
  }, []);
  return members;
}

const fmtDate = (v) => {
  if (!v) return '—';
  const s = String(v).slice(0, 10);
  if (s.length < 10) return String(v);
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
};

function FieldLabel({ children }) {
  return <span className="dmd-field-label">{children}</span>;
}

function ReadField({ label, value, wide, tall }) {
  const cls = `dmd-field${wide ? ' dmd-field--wide' : ''}${tall ? ' dmd-field--tall' : ''}`;
  return (
    <div className={cls}>
      <FieldLabel>{label}</FieldLabel>
      <div className="dmd-field-value">{value != null && value !== '' ? String(value) : '—'}</div>
    </div>
  );
}

function EditText({ label, fieldKey, value, onSave, wide }) {
  const [local, setLocal] = useState(value ?? '');
  useEffect(() => { setLocal(value ?? ''); }, [value]);
  return (
    <div className={`dmd-field${wide ? ' dmd-field--wide' : ''}`}>
      <FieldLabel>{label}</FieldLabel>
      <input
        className="dmd-input"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onSave(fieldKey, local)}
      />
    </div>
  );
}

function EditTextarea({ label, fieldKey, value, onSave }) {
  const [local, setLocal] = useState(value ?? '');
  useEffect(() => { setLocal(value ?? ''); }, [value]);
  return (
    <div className="dmd-field dmd-field--wide">
      <FieldLabel>{label}</FieldLabel>
      <textarea
        className="dmd-input dmd-textarea"
        value={local}
        rows={4}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onSave(fieldKey, local)}
      />
    </div>
  );
}

function EditNumber({ label, fieldKey, value, onSave }) {
  const [local, setLocal] = useState(value ?? '');
  useEffect(() => { setLocal(value ?? ''); }, [value]);
  return (
    <div className="dmd-field">
      <FieldLabel>{label}</FieldLabel>
      <input
        type="number"
        className="dmd-input"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onSave(fieldKey, local === '' ? null : Number(local))}
      />
    </div>
  );
}

function EditSelect({ label, fieldKey, options, value, onSave }) {
  return (
    <div className="dmd-field">
      <FieldLabel>{label}</FieldLabel>
      <select
        className="dmd-input"
        value={value ?? ''}
        onChange={(e) => onSave(fieldKey, e.target.value === '' ? null : e.target.value)}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function EditToggle({ label, fieldKey, value, onSave }) {
  const [local, setLocal] = useState(value === true || value === 'true');
  useEffect(() => { setLocal(value === true || value === 'true'); }, [value]);
  const handleToggle = () => {
    const next = !local;
    setLocal(next);
    onSave(fieldKey, next);
  };
  return (
    <div className="dmd-field">
      <FieldLabel>{label}</FieldLabel>
      <button
        type="button"
        className={`dmd-toggle${local ? ' dmd-toggle--on' : ''}`}
        onClick={handleToggle}
      >
        {local ? 'Sim' : 'Não'}
      </button>
    </div>
  );
}

function EditDate({ label, fieldKey, value, onSave }) {
  const [local, setLocal] = useState(value ? String(value).slice(0, 10) : '');
  useEffect(() => { setLocal(value ? String(value).slice(0, 10) : ''); }, [value]);
  return (
    <div className="dmd-field">
      <FieldLabel>{label}</FieldLabel>
      <input
        type="date"
        className="dmd-input"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onSave(fieldKey, local || null)}
      />
    </div>
  );
}

const PRIO_OPTIONS = (PRIORIDADE_INTERNA_OPTIONS || []).map((p) => ({
  value: String(p.value),
  label: p.description ? `${p.label} — ${p.description}` : p.label,
}));

function EditPersonCombobox({ label, fieldKey, value, onSave, members }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = search
    ? members.filter((m) => m.label.toLowerCase().includes(search.toLowerCase()))
    : members;

  const handleSelect = (m) => {
    onSave(fieldKey, m ? m.label : null);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="dmd-field dmd-field--wide" ref={wrapRef} style={{ position: 'relative' }}>
      <FieldLabel>{label}</FieldLabel>
      <button
        type="button"
        className="dmd-combobox-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={value ? 'dmd-combobox-value' : 'dmd-combobox-placeholder'}>
          {value || 'Selecionar...'}
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="dmd-combobox-dropdown">
          <input
            autoFocus
            className="dmd-combobox-search"
            placeholder="Pesquisar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          />
          <div className="dmd-combobox-list">
            <button type="button" className="dmd-combobox-item dmd-combobox-item--clear" onClick={() => handleSelect(null)}>
              — Nenhum
            </button>
            {filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`dmd-combobox-item${value === m.label ? ' dmd-combobox-item--selected' : ''}`}
                onClick={() => handleSelect(m)}
              >
                {m.label}
              </button>
            ))}
            {filtered.length === 0 && (
              <span className="dmd-combobox-empty">Nenhum resultado</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const TICKETS_GLOBAL = 'tickets_global';

function useReplanningLog(ticketDocId) {
  const [log, setLog] = useState([]);
  useEffect(() => {
    if (!ticketDocId) return;
    const q = query(
      collection(db, TICKETS_GLOBAL, ticketDocId, 'replanningLog'),
      orderBy('changedAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setLog(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return unsub;
  }, [ticketDocId]);
  return log;
}

const fmtLogDate = (ts) => {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const fmtIsoDate = (v) => {
  if (!v) return '—';
  const s = String(v).slice(0, 10);
  if (s.length < 10) return v;
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
};

function ReplanningLog({ ticketDocId }) {
  const log = useReplanningLog(ticketDocId);
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginTop: 20, borderTop: '1px solid var(--gray-5)', paddingTop: 14 }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '4px 0', color: 'var(--gray-10)', fontSize: 12, fontWeight: 700,
          letterSpacing: '0.05em', textTransform: 'uppercase',
        }}
      >
        <History size={13} />
        HISTÓRICO DE REPLANEJAMENTO
        {log.length > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '1px 6px',
            borderRadius: 10, background: 'rgba(251,146,60,0.2)',
            color: '#fb923c', border: '1px solid rgba(251,146,60,0.35)',
          }}>{log.length}</span>
        )}
        <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div style={{ marginTop: 10 }}>
          {log.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--gray-9)', margin: 0 }}>Nenhuma alteração registrada.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ color: 'var(--gray-9)', textAlign: 'left' }}>
                  <th style={{ padding: '4px 8px', fontWeight: 700, borderBottom: '1px solid var(--gray-5)' }}>Campo</th>
                  <th style={{ padding: '4px 8px', fontWeight: 700, borderBottom: '1px solid var(--gray-5)' }}>De</th>
                  <th style={{ padding: '4px 8px', fontWeight: 700, borderBottom: '1px solid var(--gray-5)' }}>Para</th>
                  <th style={{ padding: '4px 8px', fontWeight: 700, borderBottom: '1px solid var(--gray-5)' }}>Por</th>
                  <th style={{ padding: '4px 8px', fontWeight: 700, borderBottom: '1px solid var(--gray-5)' }}>Quando</th>
                </tr>
              </thead>
              <tbody>
                {log.map(entry => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--gray-4)' }}>
                    <td style={{ padding: '5px 8px', color: 'var(--gray-11)', fontWeight: 600 }}>{entry.fieldLabel || entry.field}</td>
                    <td style={{ padding: '5px 8px', color: '#f87171' }}>{fmtIsoDate(entry.oldValue)}</td>
                    <td style={{ padding: '5px 8px', color: '#4ade80' }}>{fmtIsoDate(entry.newValue)}</td>
                    <td style={{ padding: '5px 8px', color: 'var(--gray-10)' }}>{entry.changedBy || '—'}</td>
                    <td style={{ padding: '5px 8px', color: 'var(--gray-9)' }}>{fmtLogDate(entry.changedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function PlanRow({ left, right }) {
  return (
    <div className="dmd-plan-row">
      <div className="dmd-plan-cell">{left || null}</div>
      <div className="dmd-plan-cell">{right || null}</div>
    </div>
  );
}

export default function DemandaDetailsModal({ ticket, mode, onClose, onSave, ticketDocId: ticketDocIdProp }) {
  const [activeTab, setActiveTab] = useState('geral');
  const [squadPrincipal, setSquadPrincipal] = useState(ticket?.squadPrincipal ?? null);
  const isEdit = mode === 'edit';
  const teamMembers = useTeamMembers();
  const systems = useSystems();
  const squads = useSquads();

  useEffect(() => { setActiveTab('geral'); }, [ticket?.issueKey]);
  useEffect(() => { setSquadPrincipal(ticket?.squadPrincipal ?? null); }, [ticket?.squadPrincipal]);

  const save = useCallback(
    (field, value) => {
      if (!ticket?.issueKey) return;
      onSave(ticket.issueKey, field, value);
    },
    [ticket, onSave]
  );

  if (!ticket) return null;

  const prioLabel = (() => {
    if (ticket.prioridadeInterna != null) {
      const found = (PRIORIDADE_INTERNA_OPTIONS || []).find(
        (p) => String(p.value) === String(ticket.prioridadeInterna)
      );
      if (found) return found.description ? `${found.label} — ${found.description}` : found.label;
      return String(ticket.prioridadeInterna);
    }
    return ticket.priority || '—';
  })();

  const squadLabel = stripNumericPrefix(ticket.grupoSuporte) || ticket.squad || '—';
  const statusLabel = ticket.status || '—';

  return (
    <div className="dmd-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dmd-modal">
        {/* ── HEADER ── */}
        <div className="dmd-modal-header">
          <div className="dmd-modal-header-left">
            <span className="dmd-modal-issue-key">{ticket.issueKey}</span>
            <span className="dmd-badge dmd-badge--squad">{squadLabel}</span>
            <span className="dmd-badge dmd-badge--status">{statusLabel}</span>
            {/* Squad tags derivadas dos sistemas impactados — clicáveis em modo edição */}
            {(() => {
              if (!ticket.sistemasImpactados || !systems.length || !squads.length) return null;
              const sysNames = String(ticket.sistemasImpactados).split(',').map((s) => s.trim()).filter(Boolean);
              const squadIds = [...new Set(
                sysNames
                  .map((name) => systems.find((s) => s.name?.trim().toLowerCase() === name.toLowerCase())?.squadId)
                  .filter(Boolean)
              )];
              if (!squadIds.length) return null;
              const squadNames = squadIds
                .map((id) => squads.find((sq) => sq.id === id)?.name)
                .filter(Boolean);
              if (!squadNames.length) return null;
              return squadNames.map((name, idx) => {
                const isPrincipal = squadPrincipal === name;
                if (isEdit) {
                  return (
                    <button
                      key={idx}
                      type="button"
                      title={isPrincipal ? 'Squad principal selecionada' : 'Clique para definir como squad principal'}
                      onClick={() => {
                        const next = isPrincipal ? null : name;
                        setSquadPrincipal(next);
                        save('squadPrincipal', next);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        background: isPrincipal ? 'rgba(16,185,129,0.35)' : 'rgba(16,185,129,0.08)',
                        border: isPrincipal ? '2px solid rgba(16,185,129,0.9)' : '1px dashed rgba(16,185,129,0.4)',
                        borderRadius: 999,
                        padding: '3px 12px',
                        fontSize: 12,
                        fontWeight: 700,
                        color: isPrincipal ? '#34d399' : '#6ee7b7',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        outline: 'none',
                      }}
                    >
                      {isPrincipal ? '★ ' : ''}{name}
                    </button>
                  );
                }
                return (
                  <span
                    key={idx}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: isPrincipal ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.15)',
                      border: isPrincipal ? '1px solid rgba(16,185,129,0.7)' : '1px solid rgba(16,185,129,0.4)',
                      borderRadius: 999,
                      padding: '3px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#6ee7b7',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isPrincipal ? '★ ' : ''}{name}
                  </span>
                );
              });
            })()}
          </div>
          <button className="dmd-close-btn" onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </div>

        {/* ── TABS ── */}
        <div className="dmd-tabs">
          <button
            className={`dmd-tab${activeTab === 'geral' ? ' dmd-tab--active' : ''}`}
            onClick={() => setActiveTab('geral')}
          >
            GERAL
          </button>
          <button
            className={`dmd-tab${activeTab === 'planejamento' ? ' dmd-tab--active' : ''}`}
            onClick={() => setActiveTab('planejamento')}
          >
            PLANEJAMENTO
          </button>
        </div>

        {/* ── BODY ── */}
        <div className="dmd-modal-body">
          {activeTab === 'geral' ? (
            <div className="dmd-tab-content">
              {/* Row 1: ISSUE_KEY + SUMMARY (sempre somente-leitura) */}
              <div className="dmd-row">
                <div className="dmd-field">
                  <FieldLabel>ISSUE_KEY</FieldLabel>
                  <div className="dmd-field-value dmd-field-value--key">{ticket.issueKey}</div>
                </div>
                <ReadField label="SUMMARY" value={ticket.summary} wide />
              </div>

              {/* Row 2: PRIORIDADE + EST MACRO + EST TOTAL + NATUREZA */}
              <div className="dmd-row">
                {isEdit ? (
                  <EditSelect
                    label="PRIORIDADE"
                    fieldKey="prioridadeInterna"
                    options={PRIO_OPTIONS}
                    value={ticket.prioridadeInterna != null ? String(ticket.prioridadeInterna) : ''}
                    onSave={(field, val) => save(field, val)}
                  />
                ) : (
                  <ReadField label="PRIORIDADE" value={prioLabel} />
                )}
                <ReadField label="ESTIMATIVA MACRO" value={ticket.estimativaMacro} />
                <ReadField label="ESTIMATIVA TOTAL" value={ticket.estimativaTotal} />
                <ReadField label="NATUREZA DA OPERAÇÃO" value={ticket.naturezaOperacao} />
              </div>

              {/* Row 2b: ESTIMATIVA INTERNA + CICLO */}
              <div className="dmd-row">
                {isEdit ? (
                  <EditNumber label="ESTIMATIVA INTERNA (h)" fieldKey="estimativaInterna" value={ticket.estimativaInterna} onSave={save} />
                ) : (
                  <ReadField label="ESTIMATIVA INTERNA (h)" value={ticket.estimativaInterna} />
                )}
                <div className="dmd-field">
                  <FieldLabel>CICLO</FieldLabel>
                  {Array.isArray(ticket.ciclos) && ticket.ciclos.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: 4 }}>
                      {ticket.ciclos.map((c, i) => (
                        <span
                          key={i}
                          style={{
                            background: 'rgba(99,102,241,0.18)',
                            color: '#a5b4fc',
                            border: '1px solid rgba(99,102,241,0.35)',
                            borderRadius: 6,
                            padding: '2px 10px',
                            fontSize: 12,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {c.nome || c}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: '#6b7280', fontSize: 13 }}>—</span>
                  )}
                </div>
              </div>

              {/* Row 3: SISTEMAS IMPACTADOS — tags (somente leitura) */}
              <div className="dmd-row">
                <div className="dmd-field dmd-field--wide">
                  <FieldLabel>SISTEMAS IMPACTADOS</FieldLabel>
                  {ticket.sistemasImpactados && String(ticket.sistemasImpactados).trim() !== '' ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: 4 }}>
                      {String(ticket.sistemasImpactados)
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .map((sys, idx) => (
                          <span
                            key={idx}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              background: 'rgba(99,102,241,0.12)',
                              border: '1px solid rgba(99,102,241,0.35)',
                              borderRadius: 6,
                              padding: '4px 10px',
                              fontSize: 13,
                              fontWeight: 600,
                              color: '#a5b4fc',
                              letterSpacing: '0.01em',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {sys}
                          </span>
                        ))}
                    </div>
                  ) : (
                    <div className="dmd-field-value">—</div>
                  )}
                </div>
              </div>

              {/* Row 3b: SQUAD PRINCIPAL */}
              <div className="dmd-row">
                {isEdit ? (
                  <div className="dmd-field">
                    <FieldLabel>SQUAD PRINCIPAL</FieldLabel>
                    <select
                      className="dmd-input"
                      value={squadPrincipal ?? ''}
                      onChange={(e) => {
                        const next = e.target.value === '' ? null : e.target.value;
                        setSquadPrincipal(next);
                        save('squadPrincipal', next);
                      }}
                    >
                      <option value="">— Nenhuma —</option>
                      {squads
                        .slice()
                        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'))
                        .map((sq) => (
                          <option key={sq.id} value={sq.name}>{sq.name}</option>
                        ))}
                    </select>
                  </div>
                  ) : (
                    <div className="dmd-field">
                    <FieldLabel>SQUAD PRINCIPAL</FieldLabel>
                    {squadPrincipal ? (
                      <div style={{ display: 'flex', alignItems: 'center', paddingTop: 4 }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          background: 'rgba(16,185,129,0.13)',
                          border: '1px solid rgba(16,185,129,0.4)',
                          borderRadius: 6,
                          padding: '4px 12px',
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#6ee7b7',
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap',
                        }}>
                          {squadPrincipal}
                        </span>
                      </div>
                    ) : (
                      <div className="dmd-field-value">—</div>
                    )}
                  </div>
                )}
              </div>


              {/* Row 4: IMPEDIDO + MOTIVO IMPEDIMENTO */}
              <div className="dmd-row">
                {isEdit ? (
                  <EditToggle label="IMPEDIDO" fieldKey="impedimento" value={ticket.impedimento} onSave={save} />
                ) : (
                  <ReadField label="IMPEDIDO" value={ticket.impedimento ? 'Sim' : 'Não'} />
                )}
                {isEdit ? (
                  <EditText label="MOTIVO IMPEDIMENTO" fieldKey="observacaoAdicional" value={ticket.observacaoAdicional} onSave={save} wide />
                ) : (
                  <ReadField label="MOTIVO IMPEDIMENTO" value={ticket.observacaoAdicional} wide />
                )}
              </div>

              {/* Row 5: RESPONSÁVEIS */}
              <div className="dmd-row">
                {isEdit ? (
                  <EditPersonCombobox
                    label="RESPONSÁVEL DESENVOLVIMENTO"
                    fieldKey="responsavelDesenvolvimento"
                    value={ticket.responsavelDesenvolvimento}
                    onSave={save}
                    members={teamMembers}
                  />
                ) : (
                  <ReadField label="RESPONSÁVEL DESENVOLVIMENTO" value={ticket.responsavelDesenvolvimento} wide />
                )}
                {isEdit ? (
                  <EditPersonCombobox
                    label="RESPONSÁVEL TESTE INTERNO"
                    fieldKey="responsavelTesteInterno"
                    value={ticket.responsavelTesteInterno}
                    onSave={save}
                    members={teamMembers}
                  />
                ) : (
                  <ReadField label="RESPONSÁVEL TESTE INTERNO" value={ticket.responsavelTesteInterno} wide />
                )}
              </div>

              {/* Row 6: OBSERVAÇÃO */}
              <div className="dmd-row">
                {isEdit ? (
                  <EditTextarea label="OBSERVAÇÃO" fieldKey="observacao" value={ticket.observacao} onSave={save} />
                ) : (
                  <ReadField label="OBSERVAÇÃO" value={ticket.observacao} wide tall />
                )}
              </div>
            </div>
          ) : (
            <div className="dmd-tab-content dmd-plan-tab">
              <div className="dmd-plan-header-row">
                <div className="dmd-plan-header">JIRA</div>
                <div className="dmd-plan-header">INTERNO</div>
              </div>

              <PlanRow
                left={<ReadField label="DATA APROVACAO EF SR" value={fmtDate(ticket.dataAprovacaoEfsr)} />}
                right={null}
              />
              <PlanRow
                left={<ReadField label="DATA INICIO ATEND PLAN" value={fmtDate(ticket.dataInicioAtendimentoPlanejada)} />}
                right={null}
              />
              <PlanRow
                left={<ReadField label="DATA INICIO DO ATENDIMENTO" value={fmtDate(ticket.dataInicioAtendimento)} />}
                right={
                  isEdit ? (
                    <EditDate label="DATA FIM DESENVOLVIMENTO" fieldKey="dataFimDesenvolvimento" value={ticket.dataFimDesenvolvimento} onSave={save} />
                  ) : (
                    <ReadField label="DATA FIM DESENVOLVIMENTO" value={fmtDate(ticket.dataFimDesenvolvimento)} />
                  )
                }
              />
              <PlanRow
                left={null}
                right={
                  isEdit ? (
                    <EditDate label="DATA FIM TESTE INTERNO" fieldKey="dataFimTesteInterno" value={ticket.dataFimTesteInterno} onSave={save} />
                  ) : (
                    <ReadField label="DATA FIM TESTE INTERNO" value={fmtDate(ticket.dataFimTesteInterno)} />
                  )
                }
              />
              <PlanRow
                left={<ReadField label="DATA APROVACAO QA" value={fmtDate(ticket.dataAprovacaoQaPlanejada)} />}
                right={
                  isEdit ? (
                    <EditDate label="DATA FIM TESTE (QA)" fieldKey="dataFimTesteQa" value={ticket.dataFimTesteQa} onSave={save} />
                  ) : (
                    <ReadField label="DATA FIM TESTE (QA)" value={fmtDate(ticket.dataFimTesteQa)} />
                  )
                }
              />
              <PlanRow
                left={<ReadField label="DATA INICIO HML PLAN" value={fmtDate(ticket.dataInicioHomologacaoPlanejada)} />}
                right={null}
              />
              <PlanRow
                left={<ReadField label="DATA FIM HML PLAN" value={fmtDate(ticket.dataFimHomologacaoPlanejada)} />}
                right={
                  isEdit ? (
                    <EditDate label="DATA FIM HOMOLOGAÇÃO" fieldKey="dataFimHomologacao" value={ticket.dataFimHomologacao} onSave={save} />
                  ) : (
                    <ReadField label="DATA FIM HOMOLOGAÇÃO" value={fmtDate(ticket.dataFimHomologacao)} />
                  )
                }
              />
              <PlanRow
                left={<ReadField label="DATA ENTREGA EM PRODUÇÃO PREVISTA" value={fmtDate(ticket.dataEntregaProducaoPrevista)} />}
                right={
                  isEdit ? (
                    <EditDate label="DATA CONCLUSÃO" fieldKey="dataConclusao" value={ticket.dataConclusao} onSave={save} />
                  ) : (
                    <ReadField label="DATA CONCLUSÃO" value={fmtDate(ticket.dataConclusao)} />
                  )
                }
              />

              {/* ── Histórico de replanejamento ── */}
              <div style={{ padding: '0 0 8px' }}>
                <ReplanningLog ticketDocId={ticketDocIdProp || ticket.id} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
