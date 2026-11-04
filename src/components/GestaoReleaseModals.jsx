import React, { useState } from 'react';
import { X, Package } from 'lucide-react';
import { createRelease, addJanela } from '../services/releaseService';

function isoToday() { return new Date().toISOString().slice(0, 10); }

const INP = {
  width: '100%', boxSizing: 'border-box', fontSize: 13,
  background: 'var(--gray-2)', border: '1px solid var(--gray-5)',
  borderRadius: 8, padding: '8px 12px', color: 'var(--gray-12)', outline: 'none',
};
const LBL = {
  fontSize: 11, fontWeight: 700, color: 'var(--gray-9)',
  letterSpacing: '0.05em', marginBottom: 4, display: 'block',
};

export function NewReleaseModal({ onClose }) {
  const [form, setForm] = useState({ nome: '', ambiente: '', tipo: '', dataAlvo: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.nome.trim()) { setError('Informe o nome da release.'); return; }
    setSaving(true);
    try {
      await createRelease({
        nome: form.nome.trim(),
        ambiente: form.ambiente || null,
        tipo: form.tipo || null,
        dataAlvo: form.dataAlvo || null,
      });
      onClose();
    } catch (e) {
      setError('Erro ao criar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div style={{ background: 'var(--color-panel-solid)', border: '1px solid var(--gray-5)', borderRadius: 14, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--gray-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Package size={18} color="var(--indigo-11)" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--gray-12)' }}>Nova Release</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--gray-5)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--gray-9)', display: 'flex', alignItems: 'center' }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={LBL}>NOME *</label>
            <input style={INP} placeholder="Ex: Release 2.4.0 — Novembro" value={form.nome}
              onChange={e => set('nome', e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} autoFocus />
          </div>
          <div>
            <label style={LBL}>AMBIENTE</label>
            <select style={{ ...INP, cursor: 'pointer' }} value={form.ambiente} onChange={e => set('ambiente', e.target.value)}>
              <option value="">— Selecione —</option>
              <option value="Homologação">Homologação</option>
              <option value="Produção">Produção</option>
            </select>
          </div>
          <div>
            <label style={LBL}>TIPO</label>
            <select style={{ ...INP, cursor: 'pointer' }} value={form.tipo} onChange={e => set('tipo', e.target.value)}>
              <option value="">— Selecione —</option>
              <option value="Janela Fixa">Janela Fixa</option>
              <option value="Janela Variável">Janela Variável</option>
            </select>
          </div>
          <div>
            <label style={LBL}>DATA ALVO</label>
            <input type="date" style={INP} value={form.dataAlvo} onChange={e => set('dataAlvo', e.target.value)} />
          </div>
          {error && (
            <p style={{ margin: 0, fontSize: 12, color: '#f87171', background: 'rgba(239,68,68,0.1)', borderRadius: 6, padding: '8px 12px' }}>{error}</p>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--gray-4)' }}>
          <button onClick={onClose} style={{ padding: '7px 18px', borderRadius: 8, border: '1px solid var(--gray-5)', background: 'var(--gray-3)', color: 'var(--gray-11)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={submit} disabled={saving || !form.nome.trim()}
            style={{ padding: '7px 22px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: form.nome.trim() ? 'pointer' : 'default', opacity: saving ? 0.7 : 1, background: form.nome.trim() ? 'var(--indigo-9)' : 'var(--gray-5)', color: form.nome.trim() ? '#fff' : 'var(--gray-9)' }}>
            {saving ? 'Criando…' : 'Criar Release'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AddJanelaModal({ release, initialDate, onClose }) {
  const [form, setForm] = useState({ tipo: 'deploy', data: initialDate || isoToday(), hora: '', descricao: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    setSaving(true);
    try { await addJanela(release.id, form); onClose(); }
    catch (e) { console.error(e); } finally { setSaving(false); }
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 2100, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div style={{ background: 'var(--color-panel-solid)', border: '1px solid var(--gray-5)', borderRadius: 14, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--gray-4)' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--gray-12)' }}>
            Registrar — <span style={{ color: 'var(--indigo-11)' }}>{release.nome}</span>
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--gray-5)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--gray-9)', display: 'flex', alignItems: 'center' }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={LBL}>TIPO</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { value: 'deploy', label: '🚀 Deploy', color: '#22d3ee' },
                { value: 'cab', label: '📋 CAB', color: '#fb923c' },
              ].map(opt => {
                const active = form.tipo === opt.value;
                return (
                  <button key={opt.value} type="button" onClick={() => set('tipo', opt.value)}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, border: active ? `2px solid ${opt.color}88` : '1px solid var(--gray-5)', background: active ? `${opt.color}18` : 'var(--gray-3)', color: active ? opt.color : 'var(--gray-10)' }}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label style={LBL}>DATA</label>
            <input type="date" style={INP} value={form.data} onChange={e => set('data', e.target.value)} />
          </div>
          <div>
            <label style={LBL}>HORA (opcional)</label>
            <input type="time" style={INP} value={form.hora} onChange={e => set('hora', e.target.value)} />
          </div>
          <div>
            <label style={LBL}>DESCRIÇÃO (opcional)</label>
            <input style={INP} placeholder="Ex: Deploy emergencial, CAB semanal…" value={form.descricao} onChange={e => set('descricao', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--gray-4)' }}>
          <button onClick={onClose} style={{ padding: '7px 18px', borderRadius: 8, border: '1px solid var(--gray-5)', background: 'var(--gray-3)', color: 'var(--gray-11)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={submit} disabled={saving}
            style={{ padding: '7px 22px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1, background: 'var(--indigo-9)', color: '#fff' }}>
            {saving ? 'Salvando…' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
