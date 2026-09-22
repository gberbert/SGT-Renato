import React, { useState, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import { PRIORIDADE_INTERNA_OPTIONS } from '../../services/operacaoRadarService';

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

function EditCheckbox({ label, fieldKey, value, onSave }) {
  return (
    <div className="dmd-field">
      <FieldLabel>{label}</FieldLabel>
      <input
        type="checkbox"
        className="dmd-checkbox"
        checked={value === true || value === 'true'}
        onChange={(e) => onSave(fieldKey, e.target.checked)}
      />
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

function PlanRow({ left, right }) {
  return (
    <div className="dmd-plan-row">
      <div className="dmd-plan-cell">{left || null}</div>
      <div className="dmd-plan-cell">{right || null}</div>
    </div>
  );
}

export default function DemandaDetailsModal({ ticket, mode, onClose, onSave }) {
  const [activeTab, setActiveTab] = useState('geral');
  const isEdit = mode === 'edit';

  useEffect(() => { setActiveTab('geral'); }, [ticket?.issueKey]);

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
      return `P${ticket.prioridadeInterna}`;
    }
    return ticket.priority || '—';
  })();

  const squadLabel = ticket.grupoSuporte || ticket.squad || '—';
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

              {/* Row 2: PRIORIDADE + EST MACRO + EST TOTAL + NATUREZA (sempre somente-leitura) */}
              <div className="dmd-row">
                <ReadField label="PRIORIDADE" value={prioLabel} />
                <ReadField label="ESTIMATIVA MACRO" value={ticket.estimativaMacro} />
                <ReadField label="ESTIMATIVA TOTAL" value={ticket.estimativaTotal} />
                <ReadField label="NATUREZA DA OPERAÇÃO" value={ticket.naturezaOperacao} />
              </div>

              {/* Row 3: SISTEMAS IMPACTADOS (sempre somente-leitura) */}
              <div className="dmd-row">
                <ReadField label="SISTEMAS IMPACTADOS" value={ticket.sistemasImpactados} wide />
              </div>

              {/* Row 4: IMPEDIDO + MOTIVO IMPEDIMENTO */}
              <div className="dmd-row">
                {isEdit ? (
                  <EditCheckbox label="IMPEDIDO" fieldKey="impedimento" value={ticket.impedimento} onSave={save} />
                ) : (
                  <ReadField label="IMPEDIDO" value={ticket.impedimento ? 'Sim' : 'Não'} />
                )}
                {isEdit ? (
                  <EditText label="MOTIVO IMPEDIMENTO" fieldKey="observacaoAdicional" value={ticket.observacaoAdicional} onSave={save} wide />
                ) : (
                  <ReadField label="MOTIVO IMPEDIMENTO" value={ticket.observacaoAdicional} wide />
                )}
              </div>

              {/* Row 5: OBSERVAÇÃO */}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
