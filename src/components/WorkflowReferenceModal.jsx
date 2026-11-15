import React, { useState, useMemo } from 'react';
import { X } from 'lucide-react';

// ── Workflow data ────────────────────────────────────────────────

export const WORKFLOW_STEPS_DEMANDAS = [
  { id: 1,  status: 'Execução',                             fila: 'NTT Data',      escopo: 'Demanda em execução' },
  { id: 2,  status: 'Aguardando Aprovação Gestor Imediato', fila: 'CPFL Prevista', escopo: 'Demanda em andamento' },
  { id: 2,  status: 'Escrita de Requerimento',              fila: 'CPFL Prevista', escopo: 'Demanda em andamento' },
  { id: 3,  status: 'Validação Comitê',                     fila: 'CPFL Prevista', escopo: 'Demanda em andamento' },
  { id: 4,  status: 'Aguardando Solicitante',               fila: 'CPFL Prevista', escopo: 'Demanda em andamento' },
  { id: 5,  status: 'Detalhamento de Requisitos',           fila: 'CPFL Prevista', escopo: 'Demanda em andamento' },
  { id: 6,  status: 'Aguardando Profissional de TI',        fila: 'CPFL Prevista', escopo: 'Demanda em andamento' },
  { id: 7,  status: 'Aguardando Demanda/Projeto',           fila: 'CPFL Prevista', escopo: 'Demanda em andamento' },
  { id: 8,  status: 'Revisão de Requisitos de Projeto',     fila: 'CPFL Prevista', escopo: 'Demanda em andamento' },
  { id: 9,  status: 'Análise e T-Shirt',                    fila: 'NTT Data',      escopo: 'Precificação ativa' },
  { id: 10, status: 'Aguardando Análise Técnica',           fila: 'CPFL',          escopo: 'Precificação ativa' },
  { id: 11, status: 'Aguardando Aprovação T-Shirt',         fila: 'CPFL',          escopo: 'Precificação ativa' },
  { id: 12, status: 'Planejamento',                         fila: 'NTT Data',      escopo: 'SLA em dias úteis' },
  { id: 13, status: 'Aprovação de Planejamento',            fila: 'CPFL',          escopo: 'Planejamento' },
  { id: 14, status: 'Aguardando Planejamento',              fila: 'CPFL Prevista', escopo: 'Planejamento' },
  { id: 15, status: 'Em Execução',                          fila: 'NTT Data',      escopo: 'Demanda em execução' },
  { id: 16, status: 'Em Teste',                             fila: 'CPFL',          escopo: 'Demanda a ser testada' },
  { id: 17, status: 'Em homologação',                       fila: 'CPFL',          escopo: 'Homologação' },
  { id: 18, status: 'Revisão de homologação',               fila: 'NTT Data',      escopo: 'Homologação' },
  { id: 19, status: 'Etapa de KT',                          fila: 'NTT Data',      escopo: 'Homologação' },
  { id: 20, status: 'Aguardando Mudança',                   fila: 'NTT Data',      escopo: 'Homologação' },
  { id: 21, status: 'Concluída',                            fila: 'CPFL',          escopo: 'Concluída' },
];

export const WORKFLOW_STEPS_FAST = [
  { id: 1,  status: 'Aguardando Atendimento',          fila: 'NTT Data' },
  { id: 2,  status: 'Em Atendimento',                  fila: 'NTT Data' },
  { id: 3,  status: 'Resolvido',                       fila: 'NTT Data' },
  { id: 4,  status: 'Reaberto',                        fila: 'NTT Data' },
  { id: 5,  status: 'Fechada',                         fila: 'NTT Data' },
  { id: 6,  status: 'Canceled',                        fila: 'CPFL' },
  { separator: true },
  { id: 7,  status: 'Aprovação Demanda Fast',          fila: 'CPFL' },
  { id: 8,  status: 'Aguardando Aprovação Gestor',     fila: 'CPFL' },
  { id: 9,  status: 'Aguardando Aprovação Tecnica',    fila: 'CPFL' },
  { id: 10, status: 'Aguardando Aprovação Adicional',  fila: 'CPFL' },
  { id: 11, status: 'Aprovado',                        fila: 'CPFL' },
  { id: 12, status: 'Reprovado',                       fila: 'CPFL' },
  { separator: true },
  { id: 13, status: 'Agendado',                        fila: 'NTT Data' },
  { id: 14, status: 'Aguardando Compra',               fila: 'CPFL' },
  { id: 15, status: 'Aguardando Validação',            fila: 'CPFL' },
  { id: 16, status: 'Aguardando Problema',             fila: 'NTT Data' },
  { id: 17, status: 'Aguardando Mudança',              fila: 'NTT Data' },
  { id: 18, status: 'Aguardando Fornecedor',           fila: 'NTT Data' },
  { id: 19, status: 'Aguardando Solicitante',          fila: 'CPFL' },
];

export const WORKFLOW_STEPS_SERVICES = [
  { id: 1,  status: 'Aguardando Atendimento',          fila: 'NTT Data' },
  { id: 2,  status: 'Em Atendimento',                  fila: 'NTT Data' },
  { id: 3,  status: 'Resolvido',                       fila: 'NTT Data' },
  { id: 4,  status: 'Reaberto',                        fila: 'NTT Data' },
  { id: 5,  status: 'Agendado',                        fila: 'NTT Data' },
  { id: 6,  status: 'Aguardando Compra',               fila: 'CPFL' },
  { id: 7,  status: 'Aguardando Validação',            fila: 'CPFL' },
  { id: 8,  status: 'Aguardando Problema',             fila: 'NTT Data' },
  { id: 9,  status: 'Aguardando Mudança',              fila: 'NTT Data' },
  { id: 10, status: 'Aguardando Fornecedor',           fila: 'CPFL' },
  { id: 11, status: 'Aguardando Solicitante',          fila: 'CPFL' },
  { id: 12, status: 'Aprovação Demanda Fast',          fila: 'CPFL' },
  { id: 13, status: 'Aguardando Aprovação Gestor',     fila: 'CPFL' },
  { id: 14, status: 'Aguardando Aprovação Tecnica',    fila: 'CPFL' },
  { id: 15, status: 'Aguardando Aprovação Adicional',  fila: 'CPFL' },
  { id: 16, status: 'Aprovado',                        fila: 'NTT Data' },
];

export const WORKFLOW_STEPS_PROBLEMAS = [
  { tipo: 'Problema', id: 1,  status: 'Aguardando RCA',                        fila: 'NTT Data' },
  { tipo: 'Problema', id: 2,  status: 'Aguardando Aprovação Líder de Torre',   fila: 'CPFL' },
  { tipo: 'Problema', id: 3,  status: 'Aguardando Aprovação Ger. Problema',    fila: 'CPFL' },
  { tipo: 'Problema', id: 4,  status: 'Solução Rejeitada',                     fila: 'CPFL' },
  { tipo: 'Problema', id: 5,  status: 'Aguardando Planejamento',               fila: 'NTT Data' },
  { tipo: 'Problema', id: 6,  status: 'Aguardando Execução',                   fila: 'NTT Data' },
  { tipo: 'Problema', id: 7,  status: 'Em Execução',                           fila: 'NTT Data' },
  { tipo: 'Problema', id: 8,  status: 'Aguardando Demanda/Projeto',            fila: 'NTT Data' },
  { tipo: 'Problema', id: 9,  status: 'Em Monitoramento',                      fila: 'CPFL' },
  { tipo: 'Problema', id: 10, status: 'Fechado',                               fila: 'CPFL' },
  { tipo: 'Problema', id: 11, status: 'Cancelado',                             fila: 'CPFL' },
  { tipo: 'RCA',      id: 1,  status: 'RCA em Desenvolvimento',                fila: 'NTT Data' },
  { tipo: 'RCA',      id: 2,  status: 'Aguardando Aprovação Técnica RCA',      fila: 'CPFL' },
  { tipo: 'RCA',      id: 3,  status: 'Aguardando Aprovação Governança RCA',   fila: 'CPFL' },
  { tipo: 'RCA',      id: 4,  status: 'Etapa de RCA',                          fila: 'NTT Data' },
  { tipo: 'RCA',      id: 5,  status: 'Resolvido',                             fila: 'NTT Data' },
  { tipo: 'RCA',      id: 6,  status: 'Fechado',                               fila: 'CPFL' },
  { tipo: 'RCA',      id: 7,  status: 'Cancelado',                             fila: 'CPFL' },
  { tipo: 'Planejamento', id: 1, status: 'Em Planejamento',                    fila: 'NTT Data' },
  { tipo: 'Planejamento', id: 2, status: 'Aguardando Aprovação Técnica',       fila: 'CPFL' },
  { tipo: 'Planejamento', id: 3, status: 'Fechado',                            fila: 'CPFL' },
  { tipo: 'Planejamento', id: 4, status: 'Cancelado',                          fila: 'CPFL' },
  { tipo: 'Execução', id: 1,  status: 'Em Execução',                           fila: 'NTT Data' },
  { tipo: 'Execução', id: 2,  status: 'Etapa de Execução',                     fila: 'NTT Data' },
  { tipo: 'Execução', id: 3,  status: 'Aguardando Aprovação Técnica',          fila: 'CPFL' },
  { tipo: 'Execução', id: 4,  status: 'Aguardando Aprovação Governança',       fila: 'CPFL' },
  { tipo: 'Execução', id: 5,  status: 'Aguardando Demanda',                    fila: 'NTT Data' },
  { tipo: 'Execução', id: 6,  status: 'Aguardando Mudança',                    fila: 'NTT Data' },
  { tipo: 'Execução', id: 7,  status: 'Fechado',                               fila: 'CPFL' },
  { tipo: 'Execução', id: 8,  status: 'Cancelado',                             fila: 'CPFL' },
];

// ── Sub-components ───────────────────────────────────────────────

function FilaTag({ fila }) {
  const isNTT = fila === 'NTT Data';
  const isPrevista = fila === 'CPFL Prevista';
  const bg     = isNTT ? 'rgba(59,130,246,0.15)'  : isPrevista ? 'rgba(255,180,50,0.15)'  : 'rgba(255,120,0,0.15)';
  const color  = isNTT ? '#60a5fa'                 : isPrevista ? '#ffd166'                : '#ff8c00';
  const border = isNTT ? 'rgba(59,130,246,0.45)'   : isPrevista ? 'rgba(255,180,50,0.5)'  : 'rgba(255,120,0,0.5)';
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: bg, color, border: `1px solid ${border}`, whiteSpace: 'nowrap', flexShrink: 0 }}>
      {fila}
    </span>
  );
}

function EscopoTag({ escopo }) {
  return (
    <span style={{ fontSize: 12, color: 'var(--gray-10)', whiteSpace: 'nowrap', flexShrink: 0 }}>
      {escopo}
    </span>
  );
}

// ── Main modal ───────────────────────────────────────────────────

export function WorkflowModal({ onClose }) {
  const [activeTab, setActiveTab] = useState('demandas');
  const [filaFilter, setFilaFilter] = useState(new Set());

  const tabs = [
    { key: 'demandas',  label: 'DEMANDAS' },
    { key: 'fast',      label: 'DEMANDAS FAST' },
    { key: 'problemas', label: 'PROBLEMAS' },
    { key: 'services',  label: 'SERVICES' },
  ];

  const filasByTab = {
    demandas:  ['CPFL Prevista', 'CPFL', 'NTT Data'],
    fast:      ['CPFL', 'NTT Data'],
    problemas: ['CPFL', 'NTT Data'],
    services:  ['CPFL', 'NTT Data'],
  };

  const availableFilas = filasByTab[activeTab] || ['CPFL', 'NTT Data'];

  const toggleFila = (fila) => {
    setFilaFilter(prev => {
      const next = new Set(prev);
      if (next.has(fila)) next.delete(fila);
      else next.add(fila);
      return next;
    });
  };

  const isFilaActive = (fila) => filaFilter.size === 0 || filaFilter.has(fila);

  const filterByFila = (steps) =>
    filaFilter.size === 0 ? steps : steps.filter(s => !s.separator && filaFilter.has(s.fila));

  const problemasByTipo = useMemo(() => {
    const groups = {};
    WORKFLOW_STEPS_PROBLEMAS.forEach(step => {
      if (!groups[step.tipo]) groups[step.tipo] = [];
      groups[step.tipo].push(step);
    });
    return groups;
  }, []);

  const th = { padding: '8px 14px', fontSize: 11, fontWeight: 700, color: 'var(--gray-9)', borderBottom: '1px solid var(--gray-5)' };
  const trEven = { background: 'transparent', borderBottom: '1px solid var(--gray-3)' };
  const trOdd  = { background: 'var(--gray-2)', borderBottom: '1px solid var(--gray-3)' };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div style={{ background: 'var(--color-panel-solid)', border: '1px solid var(--gray-5)', borderRadius: 14, width: '100%', maxWidth: 820, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--gray-4)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--gray-12)' }}>Workflows</h3>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--gray-9)' }}>Status, fila responsável e escopo em cada etapa</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--gray-5)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--gray-9)', display: 'flex', alignItems: 'center' }}>
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--gray-4)', padding: '0 20px' }}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => { setActiveTab(tab.key); setFilaFilter(new Set()); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '10px 16px', fontSize: 12, fontWeight: 700, color: activeTab === tab.key ? 'var(--indigo-11)' : 'var(--gray-9)', borderBottom: activeTab === tab.key ? '2px solid var(--indigo-9)' : '2px solid transparent', marginBottom: -1, transition: 'all 0.12s' }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Fila filter */}
        <div style={{ padding: '8px 20px', borderBottom: '1px solid var(--gray-4)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--gray-9)', fontWeight: 600 }}>FILA:</span>
          {availableFilas.map(fila => {
            const active = isFilaActive(fila);
            return (
              <button key={fila} type="button" onClick={() => toggleFila(fila)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, opacity: active ? 1 : 0.35, transition: 'opacity 0.15s' }}
                title={active ? `Ocultar fila ${fila}` : `Mostrar fila ${fila}`}>
                <FilaTag fila={fila} />
              </button>
            );
          })}
          {filaFilter.size > 0 && (
            <button type="button" onClick={() => setFilaFilter(new Set())}
              style={{ fontSize: 10, padding: '2px 8px', background: 'none', border: '1px solid var(--gray-5)', borderRadius: 6, cursor: 'pointer', color: 'var(--gray-9)' }}>
              Todas
            </button>
          )}
        </div>

        {/* Table content */}
        <div style={{ overflowY: 'auto', flex: 1 }}>

          {/* DEMANDAS */}
          {activeTab === 'demandas' && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--gray-3)', position: 'sticky', top: 0, zIndex: 1 }}>
                  <th style={{ ...th, textAlign: 'center', width: 40 }}>#</th>
                  <th style={{ ...th, textAlign: 'left' }}>STATUS</th>
                  <th style={{ ...th, textAlign: 'left' }}>FILA (RESPONSÁVEL)</th>
                  <th style={{ ...th, textAlign: 'left' }}>ESCOPO</th>
                </tr>
              </thead>
              <tbody>
                {filterByFila(WORKFLOW_STEPS_DEMANDAS).map((step, idx) => (
                  <tr key={step.id} style={idx % 2 === 0 ? trEven : trOdd}>
                    <td style={{ padding: '4px 14px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gray-9)' }}>{step.id}</td>
                    <td style={{ padding: '4px 14px', fontSize: 12, color: 'var(--gray-12)', fontWeight: 500 }}>{step.status}</td>
                    <td style={{ padding: '4px 14px' }}><FilaTag fila={step.fila} /></td>
                    <td style={{ padding: '4px 14px' }}><EscopoTag escopo={step.escopo} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* DEMANDAS FAST */}
          {activeTab === 'fast' && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--gray-3)', position: 'sticky', top: 0, zIndex: 1 }}>
                  <th style={{ ...th, textAlign: 'center', width: 40 }}>#</th>
                  <th style={{ ...th, textAlign: 'left' }}>STATUS</th>
                  <th style={{ ...th, textAlign: 'left' }}>FILA (RESPONSÁVEL)</th>
                </tr>
              </thead>
              <tbody>
                {WORKFLOW_STEPS_FAST.map((step, idx) => {
                  if (step.separator) {
                    if (filaFilter.size > 0) return null;
                    return <tr key={`sep-${idx}`}><td colSpan={3} style={{ padding: '3px 0', borderBottom: '2px solid var(--gray-5)', background: 'transparent' }} /></tr>;
                  }
                  if (filaFilter.size > 0 && !filaFilter.has(step.fila)) return null;
                  return (
                    <tr key={step.id} style={idx % 2 === 0 ? trEven : trOdd}>
                      <td style={{ padding: '4px 14px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gray-9)' }}>{step.id}</td>
                      <td style={{ padding: '4px 14px', fontSize: 12, color: 'var(--gray-12)', fontWeight: 500 }}>{step.status}</td>
                      <td style={{ padding: '4px 14px' }}><FilaTag fila={step.fila} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* PROBLEMAS */}
          {activeTab === 'problemas' && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--gray-3)', position: 'sticky', top: 0, zIndex: 1 }}>
                  <th style={{ ...th, textAlign: 'left', width: 120 }}>TIPO DE ITEM</th>
                  <th style={{ ...th, textAlign: 'center', width: 40 }}>#</th>
                  <th style={{ ...th, textAlign: 'left' }}>STATUS</th>
                  <th style={{ ...th, textAlign: 'left' }}>FILA (RESPONSÁVEL)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(problemasByTipo).map(([tipo, steps]) => {
                  const filteredSteps = filterByFila(steps);
                  if (filteredSteps.length === 0) return null;
                  return filteredSteps.map((step, idx) => (
                    <tr key={`${tipo}-${step.id}`} style={idx % 2 === 0 ? trEven : trOdd}>
                      {idx === 0 && (
                        <td rowSpan={filteredSteps.length} style={{ padding: '6px 14px', fontSize: 11, fontWeight: 800, color: 'var(--gray-9)', verticalAlign: 'top', borderRight: '1px solid var(--gray-4)', background: 'var(--gray-2)', letterSpacing: '0.04em' }}>
                          {tipo.toUpperCase()}
                        </td>
                      )}
                      <td style={{ padding: '4px 14px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gray-9)' }}>{step.id}</td>
                      <td style={{ padding: '4px 14px', fontSize: 12, color: 'var(--gray-12)', fontWeight: 500 }}>{step.status}</td>
                      <td style={{ padding: '4px 14px' }}><FilaTag fila={step.fila} /></td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          )}

          {/* SERVICES */}
          {activeTab === 'services' && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--gray-3)', position: 'sticky', top: 0, zIndex: 1 }}>
                  <th style={{ ...th, textAlign: 'center', width: 40 }}>#</th>
                  <th style={{ ...th, textAlign: 'left' }}>STATUS</th>
                  <th style={{ ...th, textAlign: 'left' }}>FILA (RESPONSÁVEL)</th>
                </tr>
              </thead>
              <tbody>
                {filterByFila(WORKFLOW_STEPS_SERVICES).map((step, idx) => (
                  <tr key={step.id} style={idx % 2 === 0 ? trEven : trOdd}>
                    <td style={{ padding: '4px 14px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gray-9)' }}>{step.id}</td>
                    <td style={{ padding: '4px 14px', fontSize: 12, color: 'var(--gray-12)', fontWeight: 500 }}>{step.status}</td>
                    <td style={{ padding: '4px 14px' }}><FilaTag fila={step.fila} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default WorkflowModal;
