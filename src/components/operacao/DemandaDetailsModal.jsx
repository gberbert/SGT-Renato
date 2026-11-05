import React, { useState, useCallback, useEffect, useRef } from 'react';
import { X, ChevronDown, History } from 'lucide-react';
import { collection, getDocs, query, orderBy, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { PRIORIDADE_INTERNA_OPTIONS } from '../../services/operacaoRadarService';
import { stripNumericPrefix } from '../../utils/stripNumericPrefix';
import { getStatusColor } from '../PlanejamentoCicloHelpers';
import { subscribeToReleases } from '../../services/releaseService';

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

function useReleases() {
  const [releases, setReleases] = useState([]);
  useEffect(() => {
    return subscribeToReleases(setReleases);
  }, []);
  return releases;
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
  const s = String(v).trim();
  // Full ISO: yyyy-mm-dd (optionally followed by time)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  // Partial Jira format: mm-dd or mm-ddThh:mm:ss (no year prefix) — assume current year
  const mmdd = s.match(/^(\d{2})-(\d{2})/);
  if (mmdd) return `${mmdd[2]}/${mmdd[1]}/${new Date().getFullYear()}`;
  // Already dd/mm/yyyy
  if (s.match(/^\d{2}\/\d{2}\/\d{4}/)) return s.slice(0, 10);
  return s;
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

function EditSelect({ label, fieldKey, options, value, onSave, placeholder }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = options.find((o) => String(o.value) === String(value ?? ''));

  return (
    <div className="dmd-field" ref={wrapRef} style={{ position: 'relative' }}>
      <FieldLabel>{label}</FieldLabel>
      <button
        type="button"
        className="dmd-combobox-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={selected ? 'dmd-combobox-value' : 'dmd-combobox-placeholder'}>
          {selected ? selected.label : (placeholder || '—')}
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="dmd-combobox-dropdown">
          <div className="dmd-combobox-list">
            <button type="button" className="dmd-combobox-item dmd-combobox-item--clear"
              onClick={() => { onSave(fieldKey, null); setOpen(false); }}>
              {placeholder || '—'}
            </button>
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`dmd-combobox-item${selected?.value === String(o.value) ? ' dmd-combobox-item--selected' : ''}`}
                onClick={() => { onSave(fieldKey, o.value); setOpen(false); }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
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

function ReadPercent({ label, value }) {
  const pct = value != null && value !== '' ? Math.min(100, Math.max(0, Number(value))) : null;
  return (
    <div className="dmd-field">
      <FieldLabel>{label}</FieldLabel>
      {pct != null ? (
        <div style={{ paddingTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              flex: 1, height: 8, borderRadius: 99,
              background: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${pct}%`,
                borderRadius: 99,
                background: pct >= 100
                  ? '#4ade80'
                  : pct >= 75
                    ? '#22d3ee'
                    : pct >= 40
                      ? '#fbbf24'
                      : '#f87171',
                transition: 'width 0.3s ease',
              }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-11)', minWidth: 38, textAlign: 'right' }}>
              {pct}%
            </span>
          </div>
        </div>
      ) : (
        <div className="dmd-field-value">—</div>
      )}
    </div>
  );
}

function EditPercent({ label, fieldKey, value, onSave }) {
  const [local, setLocal] = useState(value != null && value !== '' ? Number(value) : '');
  useEffect(() => { setLocal(value != null && value !== '' ? Number(value) : ''); }, [value]);
  const pct = local !== '' ? Math.min(100, Math.max(0, Number(local))) : null;
  return (
    <div className="dmd-field">
      <FieldLabel>{label}</FieldLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="number"
            min={0}
            max={100}
            className="dmd-input"
            style={{ width: 72 }}
            value={local}
            onChange={(e) => setLocal(e.target.value === '' ? '' : Number(e.target.value))}
            onBlur={() => onSave(fieldKey, local === '' ? null : Math.min(100, Math.max(0, Number(local))))}
          />
          <span style={{ fontSize: 13, color: 'var(--gray-10)', fontWeight: 600 }}>%</span>
        </div>
        {pct != null && (
          <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', width: '100%' }}>
            <div style={{
              height: '100%',
              width: `${pct}%`,
              borderRadius: 99,
              background: pct >= 100
                ? '#4ade80'
                : pct >= 75
                  ? '#22d3ee'
                  : pct >= 40
                    ? '#fbbf24'
                    : '#f87171',
              transition: 'width 0.2s ease',
            }} />
          </div>
        )}
      </div>
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

function useStatusChangeLog(ticketDocId) {
  const [log, setLog] = useState([]);
  useEffect(() => {
    if (!ticketDocId) return;
    const q = query(
      collection(db, TICKETS_GLOBAL, ticketDocId, 'statusChangeLog'),
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

function fmtStatusValue(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (v === '') return '—';
  return String(v);
}

function StatusChangeLog({ ticketDocId }) {
  const log = useStatusChangeLog(ticketDocId);
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
        HISTÓRICO DE STATUS
        {log.length > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '1px 6px',
            borderRadius: 10, background: 'rgba(99,102,241,0.2)',
            color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.35)',
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
                  <th style={{ padding: '4px 8px', fontWeight: 700, borderBottom: '1px solid var(--gray-5)' }}>Origem</th>
                </tr>
              </thead>
              <tbody>
                {log.map(entry => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--gray-4)' }}>
                    <td style={{ padding: '5px 8px', color: 'var(--gray-11)', fontWeight: 600 }}>{entry.fieldLabel || entry.field}</td>
                    <td style={{ padding: '5px 8px', color: '#f87171' }}>{fmtStatusValue(entry.oldValue)}</td>
                    <td style={{ padding: '5px 8px', color: '#4ade80' }}>{fmtStatusValue(entry.newValue)}</td>
                    <td style={{ padding: '5px 8px', color: 'var(--gray-10)' }}>{entry.changedBy || '—'}</td>
                    <td style={{ padding: '5px 8px', color: 'var(--gray-9)' }}>{fmtLogDate(entry.changedAt)}</td>
                    <td style={{ padding: '5px 8px' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
                        background: entry.source === 'sync' ? 'rgba(56,189,248,0.15)' : 'rgba(99,102,241,0.15)',
                        color: entry.source === 'sync' ? '#38bdf8' : '#a5b4fc',
                        border: `1px solid ${entry.source === 'sync' ? 'rgba(56,189,248,0.4)' : 'rgba(99,102,241,0.35)'}`,
                      }}>
                        {entry.source === 'sync' ? 'carga' : 'usuário'}
                      </span>
                    </td>
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

function SquadSelect({ label, value, squads, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const sorted = squads.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));

  return (
    <div className="dmd-field" ref={wrapRef} style={{ position: 'relative' }}>
      <FieldLabel>{label}</FieldLabel>
      <button
        type="button"
        className="dmd-combobox-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={value ? 'dmd-combobox-value' : 'dmd-combobox-placeholder'}>
          {value || '— Nenhuma —'}
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="dmd-combobox-dropdown">
          <div className="dmd-combobox-list">
            <button
              type="button"
              className="dmd-combobox-item dmd-combobox-item--clear"
              onClick={() => { onChange(null); setOpen(false); }}
            >
              — Nenhuma —
            </button>
            {sorted.map((sq) => (
              <button
                key={sq.id}
                type="button"
                className={`dmd-combobox-item${value === sq.name ? ' dmd-combobox-item--selected' : ''}`}
                onClick={() => { onChange(sq.name); setOpen(false); }}
              >
                {sq.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PacoteSelect({ value, releases, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="dmd-combobox-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={value ? 'dmd-combobox-value' : 'dmd-combobox-placeholder'}>
          {value || '— Nenhum pacote —'}
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="dmd-combobox-dropdown">
          <div className="dmd-combobox-list">
            <button
              type="button"
              className="dmd-combobox-item dmd-combobox-item--clear"
              onClick={() => { onChange(null); setOpen(false); }}
            >
              — Nenhum pacote —
            </button>
            {releases.length === 0 && (
              <span className="dmd-combobox-empty" style={{ fontSize: 11, color: 'var(--gray-9)', padding: '6px 12px', display: 'block' }}>
                Nenhuma release cadastrada
              </span>
            )}
            {releases.map((rel) => (
              <button
                key={rel.id}
                type="button"
                className={`dmd-combobox-item${value === rel.nome ? ' dmd-combobox-item--selected' : ''}`}
                onClick={() => { onChange(rel.nome); setOpen(false); }}
              >
                <span style={{ flex: 1 }}>{rel.nome}</span>
                {rel.ambiente && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 6, marginLeft: 6,
                    background: rel.ambiente === 'Homologação' ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.15)',
                    color: rel.ambiente === 'Homologação' ? '#fbbf24' : '#f87171',
                  }}>
                    {rel.ambiente}
                  </span>
                )}
              </button>
            ))}
          </div>
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
  const [pendingChanges, setPendingChanges] = useState({});
  const [saving, setSaving] = useState(false);
  const isEdit = mode === 'edit';
  const teamMembers = useTeamMembers();
  const systems = useSystems();
  const squads = useSquads();
  const releases = useReleases();
  const hasPending = Object.keys(pendingChanges).length > 0;

  useEffect(() => { setActiveTab('geral'); setSquadPrincipal(ticket?.squadPrincipal ?? null); setPendingChanges({}); }, [ticket?.issueKey]);

  // Buffer edits locally — nothing goes to Firestore until SALVAR
  const save = useCallback(
    (field, value) => {
      if (!ticket?.issueKey) return;
      setPendingChanges((prev) => ({ ...prev, [field]: value }));
    },
    [ticket]
  );

const handleSave = useCallback(async () => {
    if (!ticket?.issueKey || saving) return;
    setSaving(true);
    try {
      if (Object.keys(pendingChanges).length > 0) {
        // setDoc com merge:true cria ou atualiza tickets_global/{issueKey}
        // usando issueKey como docId (mesmo padrão do sync Jira)
        await setDoc(
          doc(db, 'tickets_global', ticket.issueKey),
          { ...pendingChanges, radarFieldsUpdatedAt: serverTimestamp() },
          { merge: true }
        );
      }
      // Notifica parent para atualizar estado local
      for (const [field, value] of Object.entries(pendingChanges)) {
        try { await onSave(ticket.issueKey, field, value); } catch { /* parent state update only */ }
      }
      setPendingChanges({});
      onClose();
    } finally {
      setSaving(false);
    }
  }, [ticket, pendingChanges, onSave, onClose, saving]);

  const handleCancel = useCallback(() => {
    setPendingChanges({});
    onClose();
  }, [onClose]);

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

  const squadLabel = stripNumericPrefix(ticket.grupoSolucionador || ticket.grupoSuporte) || ticket.squad || '—';
  const statusLabel = ticket.status || '—';
  const statusColor = getStatusColor(ticket.status);

  return (
    <div className="dmd-overlay">
      <div className="dmd-modal">
        {/* ── HEADER ── */}
        <div className="dmd-modal-header">
          <div className="dmd-modal-header-left">
            <span className="dmd-modal-issue-key">{ticket.issueKey}</span>
            {ticket.escopo && (() => {
              const ESCOPO_COLORS = {
                'PROBLEMAS':     '#ff4d4f',
                'DEMANDA':       '#1f77b4',
                'DEMANDA FAST':  '#ff9f43',
                'INCIDENTE':     '#2ecc71',
                'SOLICITACAO':   '#00c2ff',
                'CATALOGO':      '#a855f7',
                'PRECIFICACAO DEMANDAS': '#f472b6',
              };
              const key = String(ticket.escopo).trim().toUpperCase().replace(/_/g, ' ');
              const c = ESCOPO_COLORS[key] || '#6b7280';
              return (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: c + '22',
                    border: '1px solid ' + c + '66',
                    borderRadius: 999,
                    padding: '3px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: c,
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {ticket.escopo}
                </span>
              );
            })()}
            <span className="dmd-badge dmd-badge--squad">{squadLabel}</span>
            <span
              className="dmd-badge"
              style={{
                background: statusColor + '22',
                color: statusColor,
                border: `1px solid ${statusColor}55`,
              }}
            >{statusLabel}</span>
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
          <button className="dmd-close-btn" onClick={handleCancel} title="Fechar">
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
            className={`dmd-tab${activeTab === 'plano' ? ' dmd-tab--active' : ''}`}
            onClick={() => setActiveTab('plano')}
          >
            PLANO DE AÇÃO
          </button>
          <button
            className={`dmd-tab${activeTab === 'planejamento' ? ' dmd-tab--active' : ''}`}
            onClick={() => setActiveTab('planejamento')}
          >
            PLANEJAMENTO
          </button>
          <button
            className={`dmd-tab${activeTab === 'planoTeste' ? ' dmd-tab--active' : ''}`}
            onClick={() => setActiveTab('planoTeste')}
          >
            PLANO DE TESTE
          </button>
        </div>

        {/* ── BODY ── */}
        <div className="dmd-modal-body">
          {activeTab === 'geral' ? (
            <div className="dmd-tab-content">
              {/* Row 1: ISSUE_KEY + DATA CRIAÇÃO + SUMMARY (sempre somente-leitura) */}
              <div className="dmd-row">
                <div className="dmd-field">
                  <FieldLabel>ISSUE_KEY</FieldLabel>
                  <div className="dmd-field-value dmd-field-value--key">{ticket.issueKey}</div>
                </div>
                <ReadField
                  label="DATA CRIAÇÃO"
                  value={fmtDate(
                    ticket.createdAt?.toDate
                      ? ticket.createdAt.toDate().toISOString()
                      : ticket.createdAt
                  )}
                />
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
                    placeholder={ticket.priority || '—'}
                  />
                ) : (
                  <ReadField label="PRIORIDADE" value={prioLabel} />
                )}
                <ReadField label="ESTIMATIVA MACRO" value={ticket.estimativaMacro ?? ticket.estimativaMacroJira} />
                <ReadField label="ESTIMATIVA TOTAL" value={ticket.estimativaTotal} />
                <ReadField label="NATUREZA DA OPERAÇÃO" value={ticket.naturezaOperacao} />
                <ReadField label="SEVERIDADE" value={ticket.severidade} />
              </div>

              {/* Row 2b: % CONCLUSÃO + % CONCLUSÃO TESTE INTERNO + CICLO */}
              <div className="dmd-row">
                {isEdit ? (
                  <EditPercent label="% CONCLUSÃO" fieldKey="percentualConclusao" value={ticket.percentualConclusao} onSave={save} />
                ) : (
                  <ReadPercent label="% CONCLUSÃO" value={ticket.percentualConclusao} />
                )}
                {isEdit ? (
                  <EditPercent label="% CONCLUSÃO TESTE INTERNO" fieldKey="percentualConclusaoTesteInterno" value={ticket.percentualConclusaoTesteInterno} onSave={save} />
                ) : (
                  <ReadPercent label="% CONCLUSÃO TESTE INTERNO" value={ticket.percentualConclusaoTesteInterno} />
                )}
                {isEdit ? (
                  <EditPercent label="% CONCLUSÃO HOMOLOGAÇÃO" fieldKey="percentualConclusaoHomologacao" value={ticket.percentualConclusaoHomologacao} onSave={save} />
                ) : (
                  <ReadPercent label="% CONCLUSÃO HOMOLOGAÇÃO" value={ticket.percentualConclusaoHomologacao} />
                )}
                {/* AVANÇO — média aritmética de % Conclusão e % Conclusão Teste Interno */}
                {(() => {
                  const dev = ticket.percentualConclusao != null ? Number(ticket.percentualConclusao) : null;
                  const teste = ticket.percentualConclusaoTesteInterno != null ? Number(ticket.percentualConclusaoTesteInterno) : null;
                  if (dev == null && teste == null) return null;
                  const avg = Math.round(((dev ?? 0) * 0.7 + (teste ?? 0) * 0.3) * 10) / 10;
                  const color = avg >= 75 ? '#4ade80' : avg >= 40 ? '#fbbf24' : '#f87171';
                  return (
                    <div className="dmd-field">
                      <FieldLabel>AVANÇO</FieldLabel>
                      <div style={{ paddingTop: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(100, avg)}%`, borderRadius: 99, background: color, transition: 'width 0.3s ease' }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 800, color, minWidth: 46, textAlign: 'right' }}
                            title={`% Conclusão: ${dev ?? '—'}% · % Teste Interno: ${teste ?? '—'}%`}>
                            {avg}%
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--gray-8)', marginTop: 3 }}>
                          {dev ?? '—'} × 0,7 + {teste ?? '—'} × 0,3
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Row 2c: PLANEJAMENTO HORAS DEMANDA FAST + DEMANDA VULNERABILIDADE + CICLO */}
              <div className="dmd-row">
                <ReadField label="PLAN. HORAS DEMANDA FAST" value={ticket.planejamentoHorasDemandaFast} />
                {isEdit ? (
                  <EditSelect
                    label="DEMANDA VULNERABILIDADE"
                    fieldKey="demandaVulnerabilidade"
                    options={[{ value: 'Sim', label: 'Sim' }, { value: 'Não', label: 'Não' }]}
                    value={ticket.demandaVulnerabilidade || ''}
                    onSave={save}
                    placeholder="—"
                  />
                ) : (
                  <ReadField label="DEMANDA VULNERABILIDADE" value={ticket.demandaVulnerabilidade} />
                )}
                <div className="dmd-field">
                  <FieldLabel>CICLO</FieldLabel>
                  {Array.isArray(ticket.ciclos) && ticket.ciclos.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: 4 }}>
                      {ticket.ciclos.map((c, i) => (
                        <span
                          key={i}
                          style={{
                            background: 'rgba(6,182,212,0.15)',
                            color: '#22d3ee',
                            border: '1px solid rgba(6,182,212,0.35)',
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

              {/* Row 2d: PACOTE (release) */}
              <div className="dmd-row">
                <div className="dmd-field" style={{ position: 'relative' }}>
                  <FieldLabel>PACOTE (RELEASE)</FieldLabel>
                  {isEdit ? (
                    <PacoteSelect
                      value={pendingChanges.pacote !== undefined ? pendingChanges.pacote : (ticket.pacote ?? null)}
                      releases={releases}
                      onChange={(v) => save('pacote', v)}
                    />
                  ) : (
                    <div className="dmd-field-value">
                      {ticket.pacote ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center',
                          background: 'rgba(99,102,241,0.12)',
                          border: '1px solid rgba(99,102,241,0.35)',
                          borderRadius: 6, padding: '3px 10px',
                          fontSize: 12, fontWeight: 600, color: '#a5b4fc',
                        }}>{ticket.pacote}</span>
                      ) : '—'}
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2e: ADOÇÃO DE IA */}
              <div className="dmd-row">
                <div className="dmd-field">
                  <FieldLabel>ADOÇÃO DE IA</FieldLabel>
                  {isEdit ? (
                    <EditToggle label="" fieldKey="adocaoIa" value={pendingChanges.adocaoIa !== undefined ? pendingChanges.adocaoIa : (ticket.adocaoIa ?? false)} onSave={save} />
                  ) : (
                    <div className="dmd-field-value">
                      {ticket.adocaoIa ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.35)', borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 700, color: '#a5b4fc' }}>
                          🤖 Sim
                        </span>
                      ) : (
                        <span style={{ color: '#6b7280', fontSize: 13 }}>Não</span>
                      )}
                    </div>
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
                  <SquadSelect
                    label="SQUAD PRINCIPAL"
                    value={squadPrincipal}
                    squads={squads}
                    onChange={(next) => { setSquadPrincipal(next); save('squadPrincipal', next); }}
                  />
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


              {/* Row 3c: TICKETS VINCULADOS */}
              <div className="dmd-row">
                {isEdit ? (
                  <EditText
                    label="TICKETS VINCULADOS"
                    fieldKey="ticketsVinculados"
                    value={ticket.ticketsVinculados}
                    onSave={save}
                    wide
                  />
                ) : (
                  <div className="dmd-field dmd-field--wide">
                    <FieldLabel>TICKETS VINCULADOS</FieldLabel>
                    {ticket.ticketsVinculados && String(ticket.ticketsVinculados).trim() !== '' ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: 4 }}>
                        {String(ticket.ticketsVinculados)
                          .split(',')
                          .map((k) => k.trim())
                          .filter(Boolean)
                          .map((key, idx) => (
                            <span
                              key={idx}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                background: 'rgba(6,182,212,0.12)',
                                border: '1px solid rgba(6,182,212,0.35)',
                                borderRadius: 6,
                                padding: '4px 10px',
                                fontSize: 12,
                                fontWeight: 700,
                                color: '#22d3ee',
                                letterSpacing: '0.03em',
                                fontFamily: 'monospace',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {key}
                            </span>
                          ))}
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

              {/* ── Histórico de Status ── */}
              <StatusChangeLog ticketDocId={ticketDocIdProp || ticket.id} />
            </div>
          ) : activeTab === 'plano' ? (
            <div className="dmd-tab-content">
              <div style={{ padding: '12px 0 4px', fontSize: 11, fontWeight: 700, color: 'var(--gray-9)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--gray-4)', marginBottom: 12 }}>
                Estimativas & Execução
              </div>
              <div className="dmd-row">
                {isEdit ? (
                  <EditNumber label="ESTIMATIVA INTERNA (h)" fieldKey="estimativaInterna" value={ticket.estimativaInterna} onSave={save} />
                ) : (
                  <ReadField label="ESTIMATIVA INTERNA (h)" value={ticket.estimativaInterna} />
                )}
              </div>
            </div>
          ) : activeTab === 'planoTeste' ? (
            <div className="dmd-tab-content">
              <div style={{ padding: '12px 0 4px', fontSize: 11, fontWeight: 700, color: 'var(--gray-9)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--gray-4)', marginBottom: 16 }}>
                Resultados de Teste
              </div>
              {(() => {
                const aprovados      = Number(pendingChanges.ptAprovados      ?? ticket.ptAprovados      ?? 0);
                const reprovados     = Number(pendingChanges.ptReprovados     ?? ticket.ptReprovados     ?? 0);
                const bloqueados     = Number(pendingChanges.ptBloqueados     ?? ticket.ptBloqueados     ?? 0);
                const atencao        = Number(pendingChanges.ptAtencao        ?? ticket.ptAtencao        ?? 0);
                const naoAplicavel   = Number(pendingChanges.ptNaoAplicavel   ?? ticket.ptNaoAplicavel   ?? 0);
                const naoExecutado   = Number(pendingChanges.ptNaoExecutado   ?? ticket.ptNaoExecutado   ?? 0);
                const totalCasos     = aprovados + reprovados + bloqueados + atencao + naoAplicavel + naoExecutado;

                const fieldStyle = {
                  display: 'flex', flexDirection: 'column', gap: 6,
                  background: 'rgba(255,255,255,.03)',
                  border: '1px solid rgba(255,255,255,.08)',
                  borderRadius: 10, padding: '14px 16px', minWidth: 160,
                };
                const labelStyle = { fontSize: 11, fontWeight: 700, color: 'var(--gray-9)', textTransform: 'uppercase', letterSpacing: '0.06em' };
                const inputStyle = {
                  background: 'var(--gray-3)', border: '1px solid var(--gray-6)',
                  borderRadius: 6, padding: '6px 10px', fontSize: 15,
                  fontWeight: 700, color: 'var(--gray-12)', outline: 'none', width: '100%',
                };
                const readStyle = { fontSize: 22, fontWeight: 800, color: 'var(--gray-12)', paddingTop: 2 };

                const FIELDS = [
                  { key: 'ptAprovados',    label: 'Aprovados',      color: '#4ade80', val: aprovados },
                  { key: 'ptReprovados',   label: 'Reprovados',     color: '#f87171', val: reprovados },
                  { key: 'ptBloqueados',   label: 'Bloqueados',     color: '#fb923c', val: bloqueados },
                  { key: 'ptAtencao',      label: 'Atenção',        color: '#fbbf24', val: atencao },
                  { key: 'ptNaoAplicavel', label: 'Não Aplicável',  color: '#94a3b8', val: naoAplicavel },
                  { key: 'ptNaoExecutado', label: 'Não Executado',  color: '#64748b', val: naoExecutado },
                ];

                return (
                  <>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'stretch' }}>
                    {/* Total — read-only, auto-sum */}
                    <div style={{ ...fieldStyle, border: '1px solid rgba(99,102,241,.35)', background: 'rgba(99,102,241,.07)', flex: '0 0 auto', marginBottom: 0 }}>
                      <span style={{ ...labelStyle, color: '#a5b4fc' }}>Casos de Teste (total)</span>
                      <span style={{ fontSize: 28, fontWeight: 800, color: '#a5b4fc' }}>{totalCasos}</span>
                    </div>
                    {/* Estimativa de Esforço */}
                    {(() => {
                      const esf = Number(pendingChanges?.ptEsforcoPorCenario ?? ticket.ptEsforcoPorCenario ?? 0);
                      const tot = totalCasos * esf;
                      const d = tot > 0 ? (tot / 8) : 0;
                      const f = v => v % 1 === 0 ? v : v.toFixed(1);
                      return (
                        <div style={{ flex: 1, border: '1px solid rgba(99,102,241,.35)',
                          background: 'rgba(99,102,241,.05)', borderRadius: 8, padding: '10px 14px' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#a5b4fc',
                            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                            Estimativa de Esforço
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 6 }}>
                            <div>
                              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-9)',
                                display: 'block', marginBottom: 4 }}>Esforço (h) / cenário</label>
                              <input type="number" min="0" step="0.5"
                                value={pendingChanges?.ptEsforcoPorCenario ?? ticket.ptEsforcoPorCenario ?? ''}
                                onChange={e => setPendingChanges(p => ({ ...p,
                                  ptEsforcoPorCenario: e.target.value === '' ? null : Number(e.target.value) }))}
                                style={{ width: 100, padding: '4px 8px', borderRadius: 6,
                                  border: '1px solid rgba(99,102,241,0.4)',
                                  background: 'var(--gray-1)', color: 'var(--gray-12)', fontSize: 13 }}
                                placeholder="0" />
                            </div>
                            <div style={{ padding: '5px 10px', borderRadius: 8,
                              background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)' }}>
                              <div style={{ fontSize: 18, fontWeight: 900, color: '#6366f1' }}>{f(tot)}</div>
                              <div style={{ fontSize: 8, color: 'var(--gray-9)' }}>Total (h)</div>
                              <div style={{ fontSize: 7, color: 'var(--gray-8)' }}>{totalCasos}×{esf}h</div>
                            </div>
                            <div style={{ padding: '5px 10px', borderRadius: 8,
                              background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
                              <div style={{ fontSize: 18, fontWeight: 900, color: '#10b981' }}>{f(d)}</div>
                              <div style={{ fontSize: 8, color: 'var(--gray-9)' }}>Dias</div>
                              <div style={{ fontSize: 7, color: 'var(--gray-8)' }}>{f(tot)}h÷8</div>
                            </div>
                          </div>
                          <div style={{ fontSize: 8, color: 'var(--gray-8)', fontStyle: 'italic' }}>
                            Total=Casos×h/cenário · Dias=Total÷8
                          </div>
                        </div>
                      );
                    })()}
                    </div>

                    {/* Progresso do Teste: (Aprovados + Atenção + Não Aplicável) / Casos de Teste */}
                    {(() => {
                      const progressoPct = totalCasos > 0
                        ? Math.min(100, Math.round(((aprovados + atencao + naoAplicavel) / totalCasos) * 1000) / 10)
                        : 0;
                      const progressoColor = progressoPct >= 75 ? '#4ade80' : progressoPct >= 40 ? '#fbbf24' : '#f87171';
                      return (
                        <div style={{ ...fieldStyle, border: '1px solid rgba(74,222,128,.35)', background: 'rgba(74,222,128,.05)', marginBottom: 18 }}>
                          <span style={{ ...labelStyle, color: '#4ade80' }}>PROGRESSO DO TESTE</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
                            <div style={{ flex: 1, height: 10, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', width: `${progressoPct}%`, borderRadius: 99,
                                background: progressoColor, transition: 'width 0.3s ease',
                              }} />
                            </div>
                            <span style={{ fontSize: 20, fontWeight: 800, color: progressoColor, minWidth: 52, textAlign: 'right' }}>
                              {progressoPct}%
                            </span>
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--gray-8)', marginTop: 3 }}>
                            ({aprovados} Aprov. + {atencao} Atenção + {naoAplicavel} N.Apl.) / {totalCasos} casos
                          </div>
                        </div>
                      );
                    })()}

                    {/* 6 editable fields in a 3×2 grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
                      {FIELDS.map(f => (
                        <div key={f.key} style={{ ...fieldStyle, borderColor: f.color + '44' }}>
                          <span style={{ ...labelStyle, color: f.color }}>{f.label}</span>
                          {isEdit ? (
                            <input
                              type="number"
                              min={0}
                              step={1}
                              style={{ ...inputStyle, color: f.color }}
                              value={pendingChanges[f.key] ?? ticket[f.key] ?? ''}
                              onChange={e => save(f.key, e.target.value === '' ? 0 : Math.max(0, Math.floor(Number(e.target.value))))}
                            />
                          ) : (
                            <span style={{ ...readStyle, color: f.color }}>{f.val}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
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
                right={
                  isEdit ? (
                    <EditDate label="DATA INÍCIO HOMOLOGAÇÃO" fieldKey="dataInicioHomologacao" value={ticket.dataInicioHomologacao} onSave={save} />
                  ) : (
                    <ReadField label="DATA INÍCIO HOMOLOGAÇÃO" value={fmtDate(ticket.dataInicioHomologacao)} />
                  )
                }
              />
              <PlanRow
                left={(() => {
                  const _da = ticket.dataInicioHomologacaoPlanejada ? new Date(ticket.dataInicioHomologacaoPlanejada) : null;
                  const _db = ticket.dataFimHomologacaoPlanejada ? new Date(ticket.dataFimHomologacaoPlanejada) : null;
                  let _bd = null;
                  if (_da && _db && _db > _da) {
                    let n = 0, cur = new Date(_da); cur.setDate(cur.getDate()+1);
                    while (cur <= _db) { if (cur.getDay()!==0 && cur.getDay()!==6) n++; cur.setDate(cur.getDate()+1); }
                    _bd = n;
                  }
                  return (<div style={{display:"flex",alignItems:"center",gap:6}}>
                    <ReadField label="DATA FIM HML PLAN" value={fmtDate(ticket.dataFimHomologacaoPlanejada)} />
                    {_bd!=null && <><span title="Dias úteis (Fim HML - Ini HML)" style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:8,background:"rgba(251,191,36,0.15)",color:"#fbbf24",border:"1px solid rgba(251,191,36,0.35)",whiteSpace:"nowrap"}}>⏱ {_bd}du</span><span title="Dias corridos" style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:8,background:"rgba(156,163,175,0.15)",color:"#9ca3af",border:"1px solid rgba(156,163,175,0.3)",whiteSpace:"nowrap"}}>📅 {Math.round((_db-_da)/86400000)}dc</span></>
                    }
                  </div>);
                })()}
                right={
                  isEdit ? (
                    <EditDate label="DATA FIM HOMOLOGAÇÃO" fieldKey="dataFimHomologacao" value={ticket.dataFimHomologacao} onSave={save} />
                  ) : (
                    <ReadField label="DATA FIM HOMOLOGAÇÃO" value={fmtDate(ticket.dataFimHomologacao)} />
                  )
                }
              />
              <PlanRow
                left={(() => {
                  const _da = ticket.dataFimHomologacaoPlanejada ? new Date(ticket.dataFimHomologacaoPlanejada) : null;
                  const _db = ticket.dataEntregaProducaoPrevista ? new Date(ticket.dataEntregaProducaoPrevista) : null;
                  let _bd = null;
                  if (_da && _db && _db > _da) {
                    let n = 0, cur = new Date(_da); cur.setDate(cur.getDate()+1);
                    while (cur <= _db) { if (cur.getDay()!==0 && cur.getDay()!==6) n++; cur.setDate(cur.getDate()+1); }
                    _bd = n;
                  }
                  return (<div style={{display:"flex",alignItems:"center",gap:6}}>
                    <ReadField label="DATA ENTREGA EM PRODUÇÃO PREVISTA" value={fmtDate(ticket.dataEntregaProducaoPrevista)} />
                    {_bd!=null && <><span title="Dias úteis (Entrega - Fim HML)" style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:8,background:"rgba(251,191,36,0.15)",color:"#fbbf24",border:"1px solid rgba(251,191,36,0.35)",whiteSpace:"nowrap"}}>⏱ {_bd}du</span><span title="Dias corridos" style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:8,background:"rgba(156,163,175,0.15)",color:"#9ca3af",border:"1px solid rgba(156,163,175,0.3)",whiteSpace:"nowrap"}}>📅 {Math.round((_db-_da)/86400000)}dc</span></>
                    }
                  </div>);
                })()}
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

        {/* ── FOOTER ── */}
        {isEdit && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
            padding: '12px 20px',
            borderTop: '1px solid var(--gray-5)',
            background: 'var(--color-panel-solid)',
            borderRadius: '0 0 14px 14px',
            flexShrink: 0,
          }}>
            {hasPending && (
              <span style={{ fontSize: 11, color: '#fb923c', fontWeight: 600, marginRight: 'auto' }}>
                ● {Object.keys(pendingChanges).length} alteração(ões) não salva(s)
              </span>
            )}
            <button
              type="button"
              onClick={handleCancel}
              style={{
                padding: '7px 20px', borderRadius: 8, border: '1px solid var(--gray-6)',
                background: 'var(--gray-3)', color: 'var(--gray-11)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Cancelar
            </button>            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !hasPending}
              style={{
                padding: '7px 22px', borderRadius: 8, border: 'none',
                background: hasPending ? 'var(--indigo-9)' : 'var(--gray-5)',
                color: hasPending ? '#fff' : 'var(--gray-9)',
                fontSize: 13, fontWeight: 700, cursor: hasPending ? 'pointer' : 'default',
                transition: 'background 0.15s',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
