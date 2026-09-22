import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Box, Flex, Text } from '@radix-ui/themes';

const PRIORIDADE_OPTIONS = [
  { value: '', label: '—' },
  { value: '1', label: 'P1 — Crítica' },
  { value: '2', label: 'P2 — Alta' },
  { value: '3', label: 'P3 — Média' },
  { value: '4', label: 'P4 — Baixa' },
];

const Field = ({ label, children, style = {} }) => (
  <Box style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}>
    <Text
      size="1"
      weight="bold"
      style={{ letterSpacing: '0.07em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}
    >
      {label}
    </Text>
    {children}
  </Box>
);

const inputBase = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  color: 'var(--gray-12)',
  fontSize: 13,
  padding: '7px 10px',
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
};

const roStyle = {
  ...inputBase,
  background: 'rgba(255,255,255,0.02)',
  color: 'var(--gray-11)',
  cursor: 'default',
};

const DateField = ({ label, fieldKey, form, set, onSave, readOnly, style = {} }) => (
  <Field label={label} style={style}>
    <input
      type="date"
      value={form[fieldKey] ? String(form[fieldKey]).slice(0, 10) : ''}
      onChange={(e) => set(fieldKey, e.target.value)}
      onBlur={(e) => onSave(fieldKey, e.target.value)}
      style={readOnly ? roStyle : inputBase}
      readOnly={readOnly}
    />
  </Field>
);

export default function OperacaoDemandaModal({ ticket, onClose, onSave, readOnly = false }) {
  const [tab, setTab] = useState('GERAL');
  const [form, setForm] = useState({});

  useEffect(() => {
    if (!ticket) return;
    setForm({
      prioridadeInterna: ticket.prioridadeInterna ?? '',
      estimativaMacro: ticket.estimativaMacro ?? '',
      estimativaTotal: ticket.estimativaTotal ?? '',
      naturezaOperacao: ticket.naturezaOperacao ?? '',
      sistemasImpactados: ticket.sistemasImpactados ?? '',
      impedimento: ticket.impedimento === true,
      motivoImpedimento: ticket.motivoImpedimento ?? '',
      observacaoAdicional: ticket.observacaoAdicional ?? '',
      // Planejamento — JIRA
      dataAprovacaoEfSr: ticket.dataAprovacaoEfSr ?? '',
      dataInicioAtendPlan: ticket.dataInicioAtendPlan ?? '',
      dataInicioAtendimento: ticket.dataInicioAtendimento ?? '',
      dataAprovacaoQa: ticket.dataAprovacaoQa ?? '',
      dataInicioHmlPlan: ticket.dataInicioHmlPlan ?? '',
      dataFimHmlPlan: ticket.dataFimHmlPlan ?? '',
      dataEntregaProducaoPrevista: ticket.dataEntregaProducaoPrevista ?? ticket.dataPrevisao ?? '',
      // Planejamento — INTERNO
      dataFimDesenvolvimento: ticket.dataFimDesenvolvimento ?? '',
      dataFimTesteInterno: ticket.dataFimTesteInterno ?? '',
      dataFimTesteQa: ticket.dataFimTesteQa ?? '',
      dataFimHomologacao: ticket.dataFimHomologacao ?? '',
      dataConclusao: ticket.dataConclusao ?? '',
    });
    setTab('GERAL');
  }, [ticket]);

  if (!ticket) return null;

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = (key, value) => {
    if (onSave) onSave(ticket.issueKey, key, value);
  };

  const textInput = (key, type = 'text') => ({
    type,
    value: form[key] ?? '',
    onChange: (e) => set(key, e.target.value),
    onBlur: (e) => save(key, e.target.value),
    style: readOnly ? roStyle : inputBase,
    readOnly,
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <Box
        style={{
          background: '#1a1d23',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 720,
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          margin: '0 16px',
        }}
      >
        {/* ── Header ── */}
        <Flex
          align="center"
          justify="between"
          style={{ padding: '16px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}
        >
          <Flex align="center" gap="3" style={{ flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
            <Text size="5" weight="bold" style={{ color: '#38bdf8', whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
              {ticket.issueKey}
            </Text>
            <Flex gap="2">
              {ticket.grupoSuporte && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', padding: '3px 12px',
                  borderRadius: 999, border: '1px solid rgba(255,255,255,0.18)',
                  fontSize: 12, fontWeight: 700, color: 'var(--gray-11)',
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  {ticket.grupoSuporte}
                </span>
              )}
              {ticket.status && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', padding: '3px 12px',
                  borderRadius: 999, background: 'rgba(56,189,248,0.15)',
                  border: '1px solid rgba(56,189,248,0.4)',
                  fontSize: 12, fontWeight: 700, color: '#38bdf8',
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  {ticket.status}
                </span>
              )}
            </Flex>
          </Flex>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}
          >
            <X size={20} />
          </button>
        </Flex>

        {/* ── Tabs ── */}
        <Flex style={{ padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', gap: 24, flexShrink: 0 }}>
          {['GERAL', 'PLANEJAMENTO'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                background: 'none', border: 'none', padding: '12px 0', cursor: 'pointer',
                fontSize: 13, fontWeight: tab === t ? 700 : 500,
                color: tab === t ? 'var(--gray-12)' : 'rgba(255,255,255,0.35)',
                borderBottom: tab === t ? '2px solid #38bdf8' : '2px solid transparent',
                letterSpacing: '0.06em',
              }}
            >
              {t}
            </button>
          ))}
        </Flex>

        {/* ── Body ── */}
        <Box style={{ overflowY: 'auto', padding: '20px 20px 28px', flex: 1 }}>

          {/* ===== GERAL ===== */}
          {tab === 'GERAL' && (
            <Flex direction="column" gap="4">
              {/* Row 1: ISSUE_KEY + SUMMARY */}
              <Flex gap="3" align="end">
                <Field label="Issue Key" style={{ flex: '0 0 130px' }}>
                  <input type="text" value={ticket.issueKey || '—'} readOnly style={roStyle} />
                </Field>
                <Field label="Summary" style={{ flex: 1 }}>
                  <input type="text" value={ticket.summary || '—'} readOnly style={roStyle} />
                </Field>
              </Flex>

              {/* Row 2: PRIORIDADE + ESTIMATIVA MACRO + ESTIMATIVA TOTAL + NATUREZA */}
              <Flex gap="3" wrap="wrap">
                <Field label="Prioridade Interna" style={{ flex: '0 0 140px' }}>
                  <select
                    value={form.prioridadeInterna ?? ''}
                    onChange={(e) => {
                      set('prioridadeInterna', e.target.value);
                      save('prioridadeInterna', e.target.value === '' ? null : Number(e.target.value));
                    }}
                    disabled={readOnly}
                    style={readOnly ? roStyle : inputBase}
                  >
                    {PRIORIDADE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Estimativa Macro" style={{ flex: '0 0 140px' }}>
                  <input {...textInput('estimativaMacro', 'number')} />
                </Field>
                <Field label="Estimativa Total" style={{ flex: '0 0 140px' }}>
                  <input {...textInput('estimativaTotal', 'number')} />
                </Field>
                <Field label="Natureza da Operação" style={{ flex: 1, minWidth: 160 }}>
                  <input {...textInput('naturezaOperacao')} />
                </Field>
              </Flex>

              {/* Row 3: SISTEMAS IMPACTADOS */}
              <Field label="Sistemas Impactados" style={{ flex: '1 1 100%' }}>
                <input {...textInput('sistemasImpactados')} />
              </Field>

              {/* Row 4: IMPEDIDO + MOTIVO */}
              <Flex gap="3" align="end">
                <Field label="Impedido" style={{ flex: '0 0 90px' }}>
                  <Flex
                    align="center"
                    style={{ ...inputBase, padding: '7px 12px', gap: 8, cursor: readOnly ? 'default' : 'pointer' }}
                  >
                    <input
                      type="checkbox"
                      checked={form.impedimento === true}
                      onChange={(e) => { set('impedimento', e.target.checked); save('impedimento', e.target.checked); }}
                      disabled={readOnly}
                      style={{ width: 16, height: 16, cursor: readOnly ? 'default' : 'pointer', accentColor: '#38bdf8' }}
                    />
                    <Text size="2" style={{ color: form.impedimento ? '#fbbf24' : 'var(--gray-10)' }}>
                      {form.impedimento ? 'Sim' : 'Não'}
                    </Text>
                  </Flex>
                </Field>
                <Field label="Motivo do Impedimento" style={{ flex: 1 }}>
                  <input {...textInput('motivoImpedimento')} />
                </Field>
              </Flex>

              {/* Row 5: OBSERVAÇÃO */}
              <Field label="Observação" style={{ flex: '1 1 100%' }}>
                <textarea
                  value={form.observacaoAdicional ?? ''}
                  onChange={(e) => set('observacaoAdicional', e.target.value)}
                  onBlur={(e) => save('observacaoAdicional', e.target.value)}
                  readOnly={readOnly}
                  rows={4}
                  style={{
                    ...( readOnly ? roStyle : inputBase),
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    lineHeight: 1.5,
                  }}
                />
              </Field>
            </Flex>
          )}

          {/* ===== PLANEJAMENTO ===== */}
          {tab === 'PLANEJAMENTO' && (
            <Box>
              {/* Column headers */}
              <Flex gap="4" mb="3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10 }}>
                <Box style={{ flex: 1 }}>
                  <Text size="2" weight="bold" style={{ color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    JIRA
                  </Text>
                </Box>
                <Box style={{ flex: 1 }}>
                  <Text size="2" weight="bold" style={{ color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    INTERNO
                  </Text>
                </Box>
              </Flex>

              {/* Section 1 */}
              <Flex gap="4" mb="3">
                <DateField label="Data Aprovação EF SR" fieldKey="dataAprovacaoEfSr" form={form} set={set} onSave={save} readOnly={readOnly} style={{ flex: 1 }} />
                <Box style={{ flex: 1 }} />
              </Flex>

              {/* Section 2 */}
              <Flex gap="4" mb="3">
                <DateField label="Data Início Atend. Plan." fieldKey="dataInicioAtendPlan" form={form} set={set} onSave={save} readOnly={readOnly} style={{ flex: 1 }} />
                <Box style={{ flex: 1 }} />
              </Flex>

              {/*
