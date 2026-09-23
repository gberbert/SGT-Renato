import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  collection, getDocs, query, orderBy,
  doc, updateDoc, arrayUnion,
} from 'firebase/firestore';
import { db } from '../firebase';
import { fetchTicketsForRoadmap } from '../services/operacaoRadarService';
import { subscribeToCiclos, createCiclo, addTicketToCiclo, removeTicketFromCiclo } from '../services/cicloService';
import { Plus, ChevronDown, ChevronRight, Filter } from 'lucide-react';
import { CicloSection, TicketRow, ESCOPOS_ALVO } from './PlanejamentoCicloHelpers';
import DemandaDetailsModal from './operacao/DemandaDetailsModal';
import { stripNumericPrefix } from '../utils/stripNumericPrefix';

const TICKETS_GLOBAL = 'tickets_global';

const sel = {
  fontSize: 12,
  background: 'var(--gray-2)',
  border: '1px solid var(--gray-5)',
  borderRadius: 6,
  padding: '3px 8px',
  color: 'var(--gray-12)',
  maxWidth: 170,
};

export default function PlanejamentoCiclo() {
  const [tickets, setTickets] = useState([]);
  const [ciclos, setCiclos] = useState([]);
  const [squads, setSquads] = useState([]);
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Global filters (apply to both ciclos and backlog)
  const [search, setSearch] = useState('');
  const [escopoFilter, setEscopoFilter] = useState('all');
  const [squadFilter, setSquadFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [prioridadeFilter, setPrioridadeFilter] = useState('all');
  const [respDevFilter, setRespDevFilter] = useState('all');
  const [respTesteFilter, setRespTesteFilter] = useState('all');

  const [backlogCollapsed, setBacklogCollapsed] = useState(false);
  const [showNewCiclo, setShowNewCiclo] = useState(false);
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

  // Filter option lists (derived from enrichedTickets)
  const statusOptions = useMemo(() => {
    const s = new Set();
    enrichedTickets.forEach(t => { if (t.status) s.add(t.status); });
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [enrichedTickets]);

  const squadOptions = useMemo(() => {
    const names = new Set(squads.map(s => s.name).filter(Boolean));
    enrichedTickets.forEach(t => { if (t._resolvedSquad) names.add(t._resolvedSquad); });
    return [...names].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [squads, enrichedTickets]);

  const prioridadeOptions = useMemo(() => {
    const s = new Set();
    enrichedTickets.forEach(t => { if (t.prioridadeInterna) s.add(t.prioridadeInterna); });
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'));
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

  // Apply all global filters
  const filteredTickets = useMemo(() => enrichedTickets.filter(t => {
    if (escopoFilter !== 'all' && t.escopo !== escopoFilter) return false;
    if (squadFilter !== 'all' && (t._resolvedSquad || '') !== squadFilter) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (prioridadeFilter !== 'all' && (t.prioridadeInterna || '') !== prioridadeFilter) return false;
    if (respDevFilter !== 'all' && (t.responsavelDesenvolvimento || '') !== respDevFilter) return false;
    if (respTesteFilter !== 'all' && (t.responsavelTesteInterno || '') !== respTesteFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (t.issueKey || '').toLowerCase().includes(q) ||
        (t.summary || '').toLowerCase().includes(q)
      );
    }
    return true;
  }), [enrichedTickets, escopoFilter, squadFilter, statusFilter, prioridadeFilter, respDevFilter, respTesteFilter, search]);

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

  // Mutations
  const trackCicloOnTicket = useCallback(async (ticketKey, cicloId) => {
    const ciclo = ciclos.find(c => c.id === cicloId);
    if (!ciclo) return;
    const t = tickets.find(x => (x.issueKey || x.id) === ticketKey);
    if (!t) return;
    const entry = { nome: ciclo.nome, data: new Date().toISOString().slice(0, 10) };
    try {
      await updateDoc(doc(db, TICKETS_GLOBAL, t.id), { ciclos: arrayUnion(entry) });
      setTickets(prev => prev.map(x =>
        x.id === t.id
          ? { ...x, ciclos: [...(Array.isArray(x.ciclos) ? x.ciclos : []), entry] }
          : x
      ));
    } catch (e) { console.error('trackCicloOnTicket:', e); }
  }, [ciclos, tickets]);

  const handleMoveToCiclo = async (ticket, fromCicloId, destCicloId) => {
    const key = ticket.issueKey || ticket.id;
    if (fromCicloId) await removeTicketFromCiclo(fromCicloId, key);
    await addTicketToCiclo(destCicloId, key);
    await trackCicloOnTicket(key, destCicloId);
  };

  const handleMoveToBacklog = async (ticket, cicloId) => {
    await removeTicketFromCiclo(cicloId, ticket.issueKey || ticket.id);
  };

  const handleMoveFromBacklog = async (ticketKey, cicloId) => {
    await addTicketToCiclo(cicloId, ticketKey);
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
      await updateDoc(doc(db, TICKETS_GLOBAL, t.id), { [field]: value });
      setTickets(prev => prev.map(x => x.id === t.id ? { ...x, [field]: value } : x));
      setSelectedTicket(prev => prev ? { ...prev, [field]: value } : prev);
    } catch (e) { console.error(e); }
  }, [tickets]);

  const activeFilters = [escopoFilter, squadFilter, statusFilter, prioridadeFilter, respDevFilter, respTesteFilter]
    .filter(v => v !== 'all').length + (search ? 1 : 0);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Planejamento de Ciclos</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--gray-10)' }}>Organize tickets em ciclos de entrega</p>
        </div>
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

        {/* Escopo */}
        <select value={escopoFilter} onChange={e => setEscopoFilter(e.target.value)} style={sel}>
          <option value="all">Todos os escopos</option>
          {ESCOPOS_ALVO.map(e => <option key={e} value={e}>{e}</option>)}
        </select>

        {/* Squad */}
        <select value={squadFilter} onChange={e => setSquadFilter(e.target.value)} style={sel}>
          <option value="all">Todas as squads</option>
          {squadOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Status */}
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={sel}>
          <option value="all">Todos os status</option>
          {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Prioridade Interna */}
        <select value={prioridadeFilter} onChange={e => setPrioridadeFilter(e.target.value)} style={sel}>
          <option value="all">Todas as prioridades</option>
          {prioridadeOptions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        {/* Resp. Desenvolvimento */}
        <select value={respDevFilter} onChange={e => setRespDevFilter(e.target.value)} style={{ ...sel, maxWidth: 190 }}>
          <option value="all">Resp. Desenvolvimento</option>
          {respDevOptions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        {/* Resp. Teste Interno */}
        <select value={respTesteFilter} onChange={e => setRespTesteFilter(e.target.value)} style={{ ...sel, maxWidth: 190 }}>
          <option value="all">Resp. Teste Interno</option>
          {respTesteOptions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar…"
          style={{ ...sel, maxWidth: 180, padding: '4px 10px' }}
        />

        {activeFilters > 0 && (
          <button
            onClick={() => { setEscopoFilter('all'); setSquadFilter('all'); setStatusFilter('all'); setPrioridadeFilter('all'); setRespDevFilter('all'); setRespTesteFilter('all'); setSearch(''); }}
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
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Ticket detail modal ──────────────────────────────────────── */}
      {selectedTicket && (
        <DemandaDetailsModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onSaveField={handleSaveField}
        />
      )}
    </div>
  );
}
