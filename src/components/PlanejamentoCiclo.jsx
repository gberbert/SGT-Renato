import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  collection, getDocs, query, orderBy,
  doc, updateDoc, arrayUnion, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { fetchTicketsForRoadmap } from '../services/operacaoRadarService';
import { subscribeToCiclos, createCiclo, addTicketToCiclo, removeTicketFromCiclo } from '../services/cicloService';
import { Plus, ChevronDown, ChevronRight, Filter, HelpCircle, X, Download } from 'lucide-react';
import { CicloSection, TicketRow, ESCOPOS_ALVO, DATE_FIELD_OPTIONS, MultiSelectFilter, exportTicketsToXlsx } from './PlanejamentoCicloHelpers';
import DemandaDetailsModal from './operacao/DemandaDetailsModal';
import { stripNumericPrefix } from '../utils/stripNumericPrefix';

const TICKETS_GLOBAL = 'tickets_global';

const DATE_FIELDS_TO_LOG = new Set([
  'dataFimDesenvolvimento',
  'dataFimTesteInterno',
  'dataFimTesteQa',
  'dataFimHomologacao',
  'dataConclusao',
]);

const DATE_FIELD_LABELS = {
  dataFimDesenvolvimento: 'Fim Desenvolvimento',
  dataFimTesteInterno: 'Fim Teste Interno',
  dataFimTesteQa: 'Fim Teste (QA)',
  dataFimHomologacao: 'Fim Homologação',
  dataConclusao: 'Conclusão',
};

const sel = {
  fontSize: 12,
  background: 'var(--gray-2)',
  border: '1px solid var(--gray-5)',
  borderRadius: 6,
  padding: '3px 8px',
  color: 'var(--gray-12)',
  maxWidth: 170,
};

const WORKFLOW_STEPS = [
  { id: 1,  status: 'Aguardando Aprovação Gestor Imediato', fila: 'CPFL Prevista', escopo: 'Demanda em andamento' },
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

// Mapa de status por fila
const FILA_STATUS_MAP = {
  'CPFL Prevista': [
    'Aguardando Aprovação Gestor Imediato',
    'Escrita de Requerimento',
    'Validação Comitê',
    'Aguardando Solicitante',
    'Detalhamento de Requisitos',
    'Aguardando Profissional de TI',
    'Aguardando Demanda/Projeto',
    'Revisão de Requisitos de Projeto',
    'Aguardando Planejamento',
  ],
  'NTT Data': [
    'Análise e T-Shirt',
    'Planejamento',
    'Em Execução',
    'Revisão de homologação',
    'Aguardando Mudança',
    'Etapa de KT',
  ],
  'CPFL': [
    'Aguardando Análise Técnica',
    'Aguardando Aprovação T-Shirt',
    'Aprovação de Planejamento',
    'Em Teste',
    'Em homologação',
    'Concluída',
  ],
};

function FilaTag({ fila }) {
  const isNTT = fila === 'NTT Data';
  const isPrevisto = fila === 'CPFL Previsto';
  // CPFL Previsto = neon laranja claro, CPFL = neon laranja, NTT Data = azul
  const bg     = isNTT ? 'rgba(59,130,246,0.15)'  : isPrevisto ? 'rgba(255,180,50,0.15)'  : 'rgba(255,120,0,0.15)';
  const color  = isNTT ? '#60a5fa'                 : isPrevisto ? '#ffd166'                : '#ff8c00';
  const border = isNTT ? 'rgba(59,130,246,0.45)'   : isPrevisto ? 'rgba(255,180,50,0.5)'  : 'rgba(255,120,0,0.5)';
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

function WorkflowModal({ onClose }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{
        background: 'var(--color-panel-solid)',
        border: '1px solid var(--gray-5)',
        borderRadius: 14, width: '100%', maxWidth: 780,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--gray-4)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--gray-12)' }}>Workflow de Demandas</h3>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--gray-9)' }}>Ordem dos status, fila responsável e escopo em cada etapa</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--gray-5)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--gray-9)', display: 'flex', alignItems: 'center' }}>
            <X size={14} />
          </button>
        </div>

        {/* Legenda */}
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--gray-4)', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--gray-9)', fontWeight: 600 }}>FILA:</span>
          <FilaTag fila="CPFL Previsto" />
          <FilaTag fila="CPFL" />
          <FilaTag fila="NTT Data" />
        </div>

        {/* Table */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--gray-3)', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, color: 'var(--gray-9)', textAlign: 'center', width: 40, borderBottom: '1px solid var(--gray-5)' }}>#</th>
                <th style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, color: 'var(--gray-9)', textAlign: 'left', borderBottom: '1px solid var(--gray-5)' }}>STATUS</th>
                <th style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, color: 'var(--gray-9)', textAlign: 'left', borderBottom: '1px solid var(--gray-5)' }}>FILA (RESPONSÁVEL)</th>
                <th style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, color: 'var(--gray-9)', textAlign: 'left', borderBottom: '1px solid var(--gray-5)' }}>ESCOPO</th>
              </tr>
            </thead>
            <tbody>
              {WORKFLOW_STEPS.map((step, idx) => (
                  <tr
                  key={step.id}
                  style={{ background: idx % 2 === 0 ? 'transparent' : 'var(--gray-2)', borderBottom: '1px solid var(--gray-3)' }}
                >
                  <td style={{ padding: '4px 14px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gray-9)' }}>{step.id}</td>
                  <td style={{ padding: '4px 14px', fontSize: 12, color: 'var(--gray-12)', fontWeight: 500 }}>{step.status}</td>
                  <td style={{ padding: '4px 14px' }}><FilaTag fila={step.fila} /></td>
                  <td style={{ padding: '4px 14px' }}><EscopoTag escopo={step.escopo} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function PlanejamentoCiclo() {
  const [tickets, setTickets] = useState([]);
  const [ciclos, setCiclos] = useState([]);
  const [squads, setSquads] = useState([]);
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [escopoFilter, setEscopoFilter] = useState(new Set());
  const [squadFilter, setSquadFilter] = useState(new Set());
  const [filaFilter, setFilaFilter] = useState(new Set());
  const [statusFilter, setStatusFilter] = useState(new Set());
  const [prioridadeFilter, setPrioridadeFilter] = useState(new Set());
  const [respDevFilter, setRespDevFilter] = useState(new Set());
  const [respTesteFilter, setRespTesteFilter] = useState(new Set());
  const [dateField, setDateField] = useState('none');
  const [impedimentoFilter, setImpedimentoFilter] = useState(false);
  const [showEstimativa, setShowEstimativa] = useState(
    () => localStorage.getItem('ciclo_showEstimativa') !== 'false'
  );

  const [backlogCollapsed, setBacklogCollapsed] = useState(false);
  const [showNewCiclo, setShowNewCiclo] = useState(false);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [newInicio, setNewInicio] = useState('');
  const [newFim, setNewFim] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);

  useEffect(() => { return subscribeToCiclos(setCiclos); }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const list = await fetchTicketsForRoadmap({ escopos: ESCOPOS_ALVO });
        if (!cancelled) setTickets(list);
      } catch (e) {
        console.error('[PlanejamentoCiclo] erro ao carregar tickets:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    getDocs(query(collection(db, 'squads'), orderBy('createdAt', 'desc')))
      .then(snap => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(s => s.name)
          .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
        setSquads(list);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    getDocs(query(collection(db, 'systems'), orderBy('createdAt', 'asc')))
      .then(snap => setSystems(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => {});
  }, []);

  const resolveSquad = useCallback((t) => {
    if (t.squadPrincipal) return t.squadPrincipal;
    const fromGrupo = stripNumericPrefix(t.grupoSuporte);
    if (fromGrupo) return fromGrupo;
    if (t.squad) return t.squad;
    if (t.sistemasImpactados && systems.length && squads.length) {
      const sysNames = String(t.sistemasImpactados).split(',').map(s => s.trim()).filter(Boolean);
      const squadIds = [...new Set(
        sysNames
          .map(name => systems.find(s => s.name?.trim().toLowerCase() === name.toLowerCase())?.squadId)
          .filter(Boolean)
      )];
      const squadNames = squadIds
        .map(id => squads.find(sq => sq.id === id)?.name)
        .filter(Boolean);
      if (squadNames.length) return squadNames[0];
    }
    return null;
  }, [systems, squads]);

  const enrichedTickets = useMemo(() =>
    tickets.map(t => {
      const resolved = resolveSquad(t);
      return resolved ? { ...t, _resolvedSquad: resolved } : t;
    }),
    [tickets, resolveSquad]
  );

  const statusOptions = useMemo(() => {
    const s = new Set();
    enrichedTickets.forEach(t => { if (t.status) s.add(t.status); });
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [enrichedTickets]);

  const squadOptions = useMemo(() => {
    return squads.map(s => s.name).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [squads]);

  const prioridadeOptions = useMemo(() => {
    const s = new Set();
    enrichedTickets.forEach(t => { if (t.prioridadeInterna != null) s.add(String(t.prioridadeInterna)); });
    return [...s].sort((a, b) => Number(a) - Number(b));
  }, [enrichedTickets]);

  const respDevOptions = useMemo(() => {
    const s = new Set();
    enrichedTickets.forEach(t => { if (t.responsavelDesenvolvimento) s.add(t.responsavelDesenvolvimento); });
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [enrichedTickets]);

  const respTesteOptions = useMemo(() => {
    const s = new Set();
    enrichedTickets.forEach(t => { if (t.responsavelTesteInterno) s.add(t.responsavelTesteInterno); });
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [enrichedTickets]);

  const handleFilaFilterChange = useCallback((newFilaSelection) => {
    setFilaFilter(newFilaSelection);
    const newStatusSelection = new Set();
    newFilaSelection.forEach(fila => {
      const statusesForFila = FILA_STATUS_MAP[fila] || [];
      statusesForFila.forEach(status => newStatusSelection.add(status));
    });
    setStatusFilter(newStatusSelection);
  }, []);

  const handleStatusFilterChange = useCallback((newStatusSelection) => {
    setStatusFilter(newStatusSelection);
    const filaSet = new Set();
    Object.entries(FILA_STATUS_MAP).forEach(([fila, statuses]) => {
      const hasAllStatus = statuses.every(s => newStatusSelection.has(s));
      if (hasAllStatus) {
        filaSet.add(fila);
      }
    });
    setFilaFilter(filaSet);
  }, []);

  const filteredTickets = useMemo(() => enrichedTickets.filter(t => {
    if (escopoFilter.size > 0 && !escopoFilter.has(t.escopo)) return false;
    if (squadFilter.size > 0 && !squadFilter.has(t._resolvedSquad || '')) return false;
    if (statusFilter.size > 0 && !statusFilter.has(t.status)) return false;
    if (prioridadeFilter.size > 0 && !prioridadeFilter.has(String(t.prioridadeInterna ?? ''))) return false;
    if (respDevFilter.size > 0 && !respDevFilter.has(t.responsavelDesenvolvimento || '')) return false;
    if (respTesteFilter.size > 0 && !respTesteFilter.has(t.responsavelTesteInterno || '')) return false;
    if (impedimentoFilter && t.impedimento !== true) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (t.issueKey || '').toLowerCase().includes(q) ||
        (t.summary || '').toLowerCase().includes(q)
      );
    }
    return true;
  }), [enrichedTickets, escopoFilter, squadFilter, statusFilter, prioridadeFilter, respDevFilter, respTesteFilter, impedimentoFilter, search]);

  const allCicloKeys = useMemo(() => {
    const s = new Set();
    ciclos.forEach(c => (c.ticketKeys || []).forEach(k => s.add(k)));
    return s;
  }, [ciclos]);

  const backlogTickets = useMemo(
    () => filteredTickets.filter(t => !allCicloKeys.has(t.issueKey || t.id)),
    [filteredTickets, allCicloKeys]
  );

  const getCicloTickets = useCallback((ciclo) => {
    const keys = new Set(ciclo.ticketKeys || []);
    return filteredTickets.filter(t => keys.has(t.issueKey || t.id));
  }, [filteredTickets]);

  const trackCicloOnTicket = useCallback(async (ticketKey, cicloId) => {
    const ciclo = ciclos.find(c => c.id === cicloId);
    if (!ciclo) return;
    const t = tickets.find(x => (x.issueKey || x.id) === ticketKey);
    if (!t) return;
    const entry = { nome: ciclo.nome, data: new Date().toISOString().slice(0, 10) };
    try {
      await updateDoc(doc(db, TICKETS_GLOBAL, t.id), { ciclos: arrayUnion(entry) });
      setTickets(prev => prev.map(x =>
        x.id === t.id ? { ...x, ciclos: [...(Array.isArray(x.ciclos) ? x.ciclos : []), entry] } : x
      ));
    } catch (e) { console.error('trackCicloOnTicket:', e); }
  }, [ciclos, tickets]);

  const handleMoveToCiclo = async (ticket, fromCicloId, destCicloId) => {
    const key = ticket.issueKey || ticket.id;
    if (fromCicloId) await removeTicketFromCiclo(fromCicloId, key);
    await addTicketToCiclo(destCicloId, key, ciclos);
    await trackCicloOnTicket(key, destCicloId);
  };

  const handleMoveToBacklog = async (ticket, cicloId) => {
    await removeTicketFromCiclo(cicloId, ticket.issueKey || ticket.id);
  };

  const handleMoveFromBacklog = async (ticketKey, cicloId) => {
    await addTicketToCiclo(cicloId, ticketKey, ciclos);
    await trackCicloOnTicket(ticketKey, cicloId);
  };

  const handleCreateCiclo = async () => {
    if (!newNome.trim()) return;
    setCreating(true);
    try {
      await createCiclo({
        nome: newNome.trim(),
        dataInicio: newInicio || null,
        dataFim: newFim || null,
        status: 'planejamento',
        ticketKeys: [],
      });
      setNewNome(''); setNewInicio(''); setNewFim(''); setShowNewCiclo(false);
    } finally { setCreating(false); }
  };

  const handleSaveField = useCallback(async (issueKey, field, value) => {
    const t = tickets.find(x => (x.issueKey || x.id) === issueKey);
    if (!t) return;
    try {
      const oldValue = t[field] ?? null;
      const newValue = value ?? null;
      await updateDoc(doc(db, TICKETS_GLOBAL, t.id), { [field]: value });
      if (DATE_FIELDS_TO_LOG.has(field) && oldValue !== newValue) {
        await addDoc(collection(db, TICKETS_GLOBAL, t.id, 'replanningLog'), {
          issueKey: t.issueKey || t.id,
          field,
          fieldLabel: DATE_FIELD_LABELS[field] || field,
          oldValue,
          newValue,
          changedAt: serverTimestamp(),
          changedBy: auth.currentUser?.displayName || auth.currentUser?.email || auth.currentUser?.uid || 'unknown',
        });
      }
      setTickets(prev => prev.map(x => x.id === t.id ? { ...x, [field]: value } : x));
      setSelectedTicket(prev => prev ? { ...prev, [field]: value } : prev);
    } catch (e) { console.error(e); }
  }, [tickets]);

  const activeFilters = [escopoFilter, squadFilter, filaFilter, statusFilter, prioridadeFilter, respDevFilter, respTesteFilter]
    .filter(s => s.size > 0).length + (search ? 1 : 0) + (impedimentoFilter ? 1 : 0);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Planejamento de Ciclos</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--gray-10)' }}>Organize tickets em ciclos de entrega</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => {
              const filename = `tickets_planejamento_${new Date().toISOString().slice(0, 10)}.xlsx`;
              exportTicketsToXlsx(filteredTickets, filename);
            }}
            title="Exportar tickets filtrados em XLSX"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--gray-3)', color: 'var(--gray-10)',
              border: '1px solid var(--gray-5)', borderRadius: 8, padding: '8px 14px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Download size={15} /> Exportar XLSX
          </button>
          <button
            onClick={() => setShowWorkflowModal(true)}
            title="Ver workflow de demandas"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--gray-3)', color: 'var(--gray-10)',
              border: '1px solid var(--gray-5)', borderRadius: 8, padding: '8px 14px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <HelpCircle size={15} /> Workflow
          </button>
          <button
            onClick={() => setShowNewCiclo(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--indigo-9)', color: '#fff',
              border: 'none', borderRadius: 8, padding: '8px 16px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={15} /> Novo Ciclo
          </button>
        </div>
      </div>

      {/* ── New ciclo form ───────────────────────────────────────────── */}
      {showNewCiclo && (
        <div style={{
          background: 'var(--gray-2)', border: '1px solid var(--gray-5)',
          borderRadius: 10, padding: 16, marginBottom: 16,
          display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--gray-10)' }}>NOME</label>
            <input
              style={{ ...sel, maxWidth: 260, padding: '5px 10px' }}
              placeholder="Nome do ciclo"
              value={newNome}
              onChange={e => setNewNome(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--gray-10)' }}>INÍCIO</label>
            <input type="date" style={{ ...sel, padding: '5px 10px' }} value={newInicio} onChange={e => setNewInicio(e.target.value)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--gray-10)' }}>FIM</label>
            <input type="date" style={{ ...sel, padding: '5px 10px' }} value={newFim} onChange={e => setNewFim(e.target.value)} />
          </div>
          <button
            onClick={handleCreateCiclo}
            disabled={creating || !newNome.trim()}
            style={{ padding: '6px 16px', background: 'var(--indigo-9)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            {creating ? 'Criando…' : 'Criar'}
          </button>
          <button onClick={() => setShowNewCiclo(false)} style={{ padding: '6px 12px', background: 'var(--gray-4)', color: 'var(--gray-11)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
            Cancelar
          </button>
        </div>
      )}

      {/* ── Global filter bar ────────────────────────────────────────── */}
      <div style={{
        background: 'var(--gray-2)', border: '1px solid var(--gray-5)',
        borderRadius: 10, padding: '12px 16px', marginBottom: 18,
        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--gray-10)', flexShrink: 0 }}>
          <Filter size={13} />
          FILTROS
          {activeFilters > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'var(--indigo-9)', color: '#fff' }}>
              {activeFilters}
            </span>
          )}
        </span>

        <MultiSelectFilter options={ESCOPOS_ALVO} selected={escopoFilter} onChange={setEscopoFilter} placeholder="Todos os escopos" maxWidth={180} />
        <MultiSelectFilter options={squadOptions} selected={squadFilter} onChange={setSquadFilter} placeholder="Todas as squads" maxWidth={180} />
        <MultiSelectFilter options={Object.keys(FILA_STATUS_MAP)} selected={filaFilter} onChange={handleFilaFilterChange} placeholder="Todas as filas" maxWidth={140} />
        <MultiSelectFilter options={statusOptions} selected={statusFilter} onChange={handleStatusFilterChange} placeholder="Todos os status" maxWidth={200} />
        <MultiSelectFilter options={prioridadeOptions} selected={prioridadeFilter} onChange={setPrioridadeFilter} placeholder="Todas as prioridades" maxWidth={180} />
        <MultiSelectFilter options={respDevOptions} selected={respDevFilter} onChange={setRespDevFilter} placeholder="Resp. Desenvolvimento" maxWidth={200} />
        <MultiSelectFilter options={respTesteOptions} selected={respTesteFilter} onChange={setRespTesteFilter} placeholder="Resp. Teste Interno" maxWidth={190} />

        <select value={dateField} onChange={e => setDateField(e.target.value)} style={{ ...sel, maxWidth: 180 }}>
          {DATE_FIELD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <label style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 12, color: impedimentoFilter ? '#fbbf24' : 'var(--gray-10)',
          cursor: 'pointer', userSelect: 'none', flexShrink: 0,
          padding: '3px 8px',
          border: `1px solid ${impedimentoFilter ? '#ca8a04' : 'var(--gray-5)'}`,
          borderRadius: 6,
          background: impedimentoFilter ? 'rgba(251,191,36,0.1)' : 'var(--gray-2)',
        }}>
          <input type="checkbox" checked={impedimentoFilter} onChange={e => setImpedimentoFilter(e.target.checked)} style={{ accentColor: '#eab308', width: 12, height: 12 }} />
          🚧 Impedidos
        </label>

        <label style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 12, color: showEstimativa ? 'var(--indigo-11)' : 'var(--gray-10)',
          cursor: 'pointer', userSelect: 'none', flexShrink: 0,
          padding: '3px 8px',
          border: `1px solid ${showEstimativa ? 'var(--indigo-8)' : 'var(--gray-5)'}`,
          borderRadius: 6,
          background: showEstimativa ? 'rgba(99,102,241,0.08)' : 'var(--gray-2)',
        }}>
          <input
            type="checkbox"
            checked={showEstimativa}
            onChange={e => {
              setShowEstimativa(e.target.checked);
              localStorage.setItem('ciclo_showEstimativa', String(e.target.checked));
            }}
            style={{ accentColor: 'var(--indigo-9)', width: 12, height: 12 }}
          />
          ⏱ Est. Interna
        </label>

        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar…" style={{ ...sel, maxWidth: 180, padding: '4px 10px' }} />

        {activeFilters > 0 && (
          <button
            onClick={() => { setEscopoFilter(new Set()); setSquadFilter(new Set()); setFilaFilter(new Set()); setStatusFilter(new Set()); setPrioridadeFilter(new Set()); setRespDevFilter(new Set()); setRespTesteFilter(new Set()); setImpedimentoFilter(false); setSearch(''); }}
            style={{ fontSize: 11, padding: '3px 10px', background: 'none', border: '1px solid var(--gray-5)', borderRadius: 6, cursor: 'pointer', color: 'var(--gray-10)' }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* ── Loading ──────────────────────────────────────────────────── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray-10)' }}>Carregando tickets…</div>
      )}

      {/* ── Ciclo sections ───────────────────────────────────────────── */}
      {!loading && ciclos.map(ciclo => (
        <CicloSection
          key={ciclo.id}
          ciclo={ciclo}
          tickets={getCicloTickets(ciclo)}
          allCiclos={ciclos}
          onMoveToCiclo={(ticket, fromId, destId) => handleMoveToCiclo(ticket, fromId, destId)}
          onMoveToBacklog={(ticket, cicloId) => handleMoveToBacklog(ticket, cicloId)}
          onTicketClick={setSelectedTicket}
          dateField={dateField}
          showEstimativa={showEstimativa}
        />
      ))}

      {/* ── Backlog section ──────────────────────────────────────────── */}
      {!loading && (
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 13px', background: 'var(--gray-3)',
              borderRadius: backlogCollapsed ? 8 : '8px 8px 0 0',
              border: '1px solid var(--gray-5)',
              borderBottom: backlogCollapsed ? '1px solid var(--gray-5)' : 'none',
              cursor: 'pointer', userSelect: 'none',
            }}
            onClick={() => setBacklogCollapsed(v => !v)}
          >
            <span style={{ color: 'var(--gray-9)', display: 'flex' }}>
              {backlogCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-12)' }}>Backlog</span>
            <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'var(--gray-5)', color: 'var(--gray-11)' }}>
              {backlogTickets.length} tickets
            </span>
            {(() => {
              const total = backlogTickets.reduce((acc, t) => acc + (Number(t.estimativaInterna) || 0), 0);
              if (!total) return null;
              return (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 10, background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)', marginLeft: 2 }}>
                  ⏱ {total}h
                </span>
              );
            })()}
          </div>

          {!backlogCollapsed && (
            <div style={{ border: '1px solid var(--gray-5)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '8px 10px', background: 'var(--color-background)' }}>
              {backlogTickets.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--gray-9)', fontSize: 13, padding: '20px 0' }}>
                  {activeFilters > 0 ? 'Nenhum ticket encontrado com os filtros aplicados' : 'Nenhum ticket no backlog'}
                </div>
              ) : (
                backlogTickets.map(t => (
                  <TicketRow
                    key={t.issueKey || t.id}
                    ticket={t}
                    cicloId={null}
                    ciclos={ciclos}
                    onMoveToCiclo={destId => handleMoveFromBacklog(t.issueKey || t.id, destId)}
                    onMoveToBacklog={() => {}}
                    onTicketClick={setSelectedTicket}
                    dateField={dateField}
                    showEstimativa={showEstimativa}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Workflow modal ───────────────────────────────────────────── */}
      {showWorkflowModal && <WorkflowModal onClose={() => setShowWorkflowModal(false)} />}

      {/* ── Ticket detail modal ──────────────────────────────────────── */}
      {selectedTicket && (
        <DemandaDetailsModal
          ticket={selectedTicket}
          mode="edit"
          onClose={() => setSelectedTicket(null)}
          onSave={handleSaveField}
        />
      )}
    </div>
  );
}
