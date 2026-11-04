#!/usr/bin/env python3
"""Generates src/components/GestaoReleaseTab.jsx"""
import os

out = os.path.join(os.path.dirname(__file__), '..', 'src', 'components', 'GestaoReleaseTab.jsx')

jsx = r"""import React, { useState, useEffect } from 'react';
import { Plus, X, Trash2, ChevronLeft, ChevronRight, Package } from 'lucide-react';
import {
  subscribeToReleases, createRelease, deleteRelease, addJanela, removeJanela,
} from '../services/releaseService';

const MONTHS_PT = ['Janeiro','Fevereiro','\u00e7o','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEK_DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','S\u00e1b'];

function isoToday() { return new Date().toISOString().slice(0, 10); }

function fmtBr(iso) {
  if (!iso) return '\u2014';
  const p = String(iso).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
}

function buildGrid(year, month) {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const g = [];
  for (let i = 0; i < first; i++) g.push(null);
  for (let d = 1; d <= days; d++)
    g.push({ day: d, iso: year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0') });
  return g;
}

/* ── Badges ─────────────────────────────────────────────────── */
function AmbienteBadge({ ambiente }) {
  if (!ambiente) return null;
  const h = ambiente === 'Homologa\u00e7\u00e3o';
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap',
      background: h ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.15)',
      color: h ? '#fbbf24' : '#f87171',
      border: '1px solid ' + (h ? 'rgba(251,191,36,0.45)' : 'rgba(239,68,68,0.45)'),
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
      border: '1px solid ' + (f ? 'rgba(99,102,241,0.4)' : 'rgba(6,182,212,0.4)'),
    }}>{tipo}</span>
  );
}

/* ── New Release Modal ───────────────────────────────────────── */
function NewReleaseModal({ onClose }) {
  const [form, setForm] = useState({ nome: '', ambiente: '', tipo: '', dataAlvo: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.nome.trim()) { setError('Informe o nome da release.'); return; }
    setSaving(true);
    try {
      await createRelease({ nome: form.nome.trim(), ambiente: form.ambiente || null, tipo: form.tipo || null, dataAlvo: form.dataAlvo || null });
      onClose();
    } catch (e) { setError('Erro ao criar. Tente novamente.'); }
    finally { setSaving(false); }
  };

  const inp = { width: '100%', boxSizing: 'border-box', fontSize: 13, background: 'var(--gray-2)', border: '1px solid var(--gray-5)', borderRadius: 8, padding: '8px 12px', color: 'var(--gray-12)', outline: 'none' };
  const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--gray-9)', letterSpacing: '0.05em', marginBottom: 4, display: 'block' };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--color-panel-solid)', border: '1px solid var(--gray-5)', borderRadius: 14, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--gray-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Package size={18} color="var(--indigo-11)" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--gray-12)' }}>Nova Release</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--gray-5)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--gray-9)', display: 'flex', alignItems: 'center' }}><X size={14} /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={lbl}>NOME *</label>
            <input style={inp} placeholder="Ex: Release 2.4.0" value={form.nome} onChange={e => set('nome', e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} autoFocus />
          </div>
          <div>
            <label style={lbl}>AMBIENTE</label>
            <select style={{ ...inp, cursor: 'pointer' }} value={form.ambiente} onChange={e => set('ambiente', e.target.value)}>
              <option value="">— Selecione —</option>
              <option value="Homologa\u00e7\u00e3o">Homologa\u00e7\u00e3o</option>
              <option value="Produ\u00e7\u00e3o">Produ\u00e7\u00e3o</option>
            </select>
          </div>
          <div>
            <label style={lbl}>TIPO</label>
            <select style={{ ...inp, cursor: 'pointer' }} value={form.tipo} onChange={e => set('tipo', e.target.value)}>
              <option value="">— Selecione —</option>
              <option value="Janela Fixa">Janela Fixa</option>
              <option value="Janela Vari\u00e1vel">Janela Vari\u00e1vel</option>
            </select>
          </div>
          <div>
            <label style={lbl}>DATA ALVO</label>
            <input type="date" style={inp} value={form.dataAlvo} onChange={e => set('dataAlvo', e.target.value)} />
          </div>
          {error && <p style={{ margin: 0, fontSize: 12, color: '#f87171', background: 'rgba(239,68,68,0.1)', borderRadius: 6, padding: '8px 12px' }}>{error}</p>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--gray-4)' }}>
          <button onClick={onClose} style={{ padding: '7px 18px', borderRadius: 8, border: '1px solid var(--gray-5)', background: 'var(--gray-3)', color: 'var(--gray-11)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={submit} disabled={saving || !form.nome.trim()}
            style={{ padding: '7px 22px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: form.nome.trim() ? 'pointer' : 'default', opacity: saving ? 0.7 : 1, background: form.nome.trim() ? 'var(--indigo-9)' : 'var(--gray-5)', color: form.nome.trim() ? '#fff' : 'var(--gray-9)' }}>
            {saving ? 'Criando\u2026' : 'Criar Release'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Add Janela / CAB Modal ──────────────────────────────────── */
function AddJanelaModal({ release, initialDate, onClose }) {
  const [form, setForm] = useState({ tipo: 'deploy', data: initialDate || isoToday(), hora: '', descricao: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    setSaving(true);
    try { await addJanela(release.id, form); onClose(); }
    catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const inp = { width: '100%', boxSizing: 'border-box', fontSize: 13, background: 'var(--gray-2)', border: '1px solid var(--gray-5)', borderRadius: 8, padding: '8px 12px', color: 'var(--gray-12)', outline: 'none' };
  const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--gray-9)', letterSpacing: '0.05em', marginBottom: 4, display: 'block' };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 2100, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--color-panel-solid)', border: '1px solid var(--gray-5)', borderRadius: 14, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--gray-4)' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--gray-12)' }}>
            Registrar &mdash; <span style={{ color: 'var(--indigo-11)' }}>{release.nome}</span>
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--gray-5)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--gray-9)', display: 'flex', alignItems: 'center' }}><X size={14} /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>TIPO</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ value: 'deploy', label: '\ud83d\ude80 Deploy', color: '#22d3ee' }, { value: 'cab', label: '\ud83d\udccb CAB', color: '#fb923c' }].map(opt => {
                const active = form.tipo === opt.value;
                return (
                  <button key={opt.value} type="button" onClick={() => set('tipo', opt.value)}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, border: active ? ('2px solid ' + opt.color + '88') : '1px solid var(--gray-5)', background: active ? (opt.color + '18') : 'var(--gray-3)', color: active ? opt.color : 'var(--gray-10)' }}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div><label style={lbl}>DATA</label><input type="date" style={inp} value={form.data} onChange={e => set('data', e.target.value)} /></div>
          <div><label style={lbl}>HORA (opcional)</label><input type="time" style={inp} value={form.hora} onChange={e => set('hora', e.target.value)} /></div>
          <div>
            <label style={lbl}>DESCRI\u00c7\u00c3O (opcional)</label>
            <input style={inp} placeholder="Ex: Deploy emergencial, CAB semanal\u2026" value={form.descricao} onChange={e => set('descricao', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--gray-4)' }}>
          <button onClick={onClose} style={{ padding: '7px 18px', borderRadius: 8, border: '1px solid var(--gray-5)', background: 'var(--gray-3)', color: 'var(--gray-11)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
