import React, { useState, useEffect } from 'react';
import { 
  DndContext, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragOverlay,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import KanbanColumn from './KanbanColumn';
import KanbanCard from './KanbanCard';
import { subscribeToTickets, updateTicketStatus, updateTicket, searchJiraTickets, fetchJiraTicket, createTicket } from '../services/ticketService';
import { subscribeToWorkflows, subscribeToSystems } from '../services/settingsService';
import { subscribeToProjects } from '../services/projectService';
import { subscribeToProjectSquads } from '../services/squadService';
import { subscribeToAllocations } from '../services/allocationService';
import { auth, db } from '../firebase';
import { getDocs, collection } from 'firebase/firestore';
import { Loader2, LayoutList, List, LayoutGrid, Filter, Plus, Download, Search } from 'lucide-react';
import { Button, Flex, Select, Text, Table, Badge, Card, Dialog, Grid, TextField, ScrollArea } from '@radix-ui/themes';

const DEFAULT_COLUMNS = [
  { id: 'col-backlog', title: 'Backlog', statusId: 'col-backlog' },
  { id: 'col-todo', title: 'A Fazer', statusId: 'col-todo' },
  { id: 'col-in-progress', title: 'Em Andamento', statusId: 'col-in-progress' },
  { id: 'col-review', title: 'Em Validação', statusId: 'col-review' },
  { id: 'col-done', title: 'Concluído', statusId: 'col-done' }
];

const KanbanBoard = ({ onCardClick, userRole, board = 'demandas', setIsModalOpen }) => {
  const [tickets, setTickets] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTicket, setActiveTicket] = useState(null);
  const [useSwimlanes, setUseSwimlanes] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'kanban' | 'list'
  const [projects, setProjects] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(() => {
    return localStorage.getItem('lastSelectedProjectId') || 'all';
  });
  const [systemsModalData, setSystemsModalData] = useState(null);
  const [systems, setSystems] = useState([]);
  
  const [squads, setSquads] = useState([]);
  const [globalSquads, setGlobalSquads] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [selectedSquadId, setSelectedSquadId] = useState('all');

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({ system: '', priority: '', type: '', assignee: '', status: '', sprint: '', dateStart: '', dateEnd: '', jiraStatus: '' });
  const [quickSearch, setQuickSearch] = useState('');

  const [isCargaFullLoading, setIsCargaFullLoading] = useState(false);
  const [cargaFullProgress, setCargaFullProgress] = useState({ current: 0, total: 0, text: '' });

  useEffect(() => {
    let ticketsLoaded = false;
    let colsLoaded = false;
    const checkLoading = () => {
      if (ticketsLoaded && colsLoaded) setLoading(false);
    };

    const unsubscribeTickets = subscribeToTickets((data) => {
      setTickets(data);
      ticketsLoaded = true;
      setError(null);
      checkLoading();
    }, (err) => {
      console.error(err);
      setError(err.message);
      ticketsLoaded = true;
      checkLoading();
    });

    const unsubscribeCols = subscribeToWorkflows((data) => {
      setWorkflows(data);
      colsLoaded = true;
      checkLoading();
    });

    const unsubscribeProjects = subscribeToProjects((data) => {
      setProjects(data);
      if (data.length > 0) {
        setSelectedProjectId(data[0].id);
      }
    });

    const unsubscribeGlobalSquads = subscribeToProjectSquads('all', setGlobalSquads, console.error);
    const unsubscribeAllocations = subscribeToAllocations(setAllocations);
    const unsubscribeSystems = subscribeToSystems(setSystems);

    return () => {
      unsubscribeTickets();
      unsubscribeCols();
      unsubscribeProjects();
      unsubscribeGlobalSquads();
      unsubscribeAllocations();
      unsubscribeSystems();
    };
  }, []);

  useEffect(() => {
    if (selectedProjectId === 'all') {
      setColumns(DEFAULT_COLUMNS);
      return;
    }

    const proj = projects.find(p => p.id === selectedProjectId);
    const targetWorkflowId = board === 'atividades' ? proj?.workflowAtividadesId : proj?.workflowId;

    if (proj && targetWorkflowId) {
      const flow = workflows.find(w => w.id === targetWorkflowId);
      if (flow && flow.columns && flow.columns.length > 0) {
        setColumns(flow.columns);
      } else if (flow && flow.columnsStr) {
        const cols = flow.columnsStr.split(',').map(c => {
          const title = c.trim();
          const id = `col-${title.toLowerCase().replace(/\s+/g, '-')}`;
          return { id, title, statusId: id };
        });
        setColumns(cols);
      } else {
        setColumns(DEFAULT_COLUMNS);
      }
    } else {
      setColumns(DEFAULT_COLUMNS);
    }
  }, [selectedProjectId, projects, workflows, board]);

  useEffect(() => {
    setSelectedSquadId('all');
    if (selectedProjectId === 'all') {
      setSquads([]);
      return;
    }
    const unsub = subscribeToProjectSquads(selectedProjectId, setSquads, console.error);
    return () => unsub();
  }, [selectedProjectId]);

  useEffect(() => {
    if (selectedProjectId) {
      localStorage.setItem('lastSelectedProjectId', selectedProjectId);
    }
  }, [selectedProjectId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event) => {
    const { active } = event;
    const ticket = tickets.find(t => t.id === active.id);
    if (ticket) setActiveTicket(ticket);
  };

  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;
    if (activeId === overId) return;

    const isActiveTicket = active.data.current?.type === 'Ticket';
    const isOverTicket = over.data.current?.type === 'Ticket';
    const isOverColumn = over.data.current?.type === 'Column';

    if (!isActiveTicket) return;

    if (isOverTicket) {
      const activeIndex = tickets.findIndex(t => t.id === activeId);
      const overIndex = tickets.findIndex(t => t.id === overId);
      
      if (tickets[activeIndex].columnId !== tickets[overIndex].columnId) {
        setTickets((prev) => {
          const newTickets = [...prev];
          newTickets[activeIndex] = {
            ...newTickets[activeIndex],
            columnId: tickets[overIndex].columnId
          };
          return arrayMove(newTickets, activeIndex, overIndex);
        });
      }
    }

    if (isOverColumn) {
      const activeIndex = tickets.findIndex(t => t.id === activeId);
      if (tickets[activeIndex].columnId !== overId) {
        setTickets((prev) => {
          const newTickets = [...prev];
          newTickets[activeIndex] = {
            ...newTickets[activeIndex],
            columnId: overId
          };
          return arrayMove(newTickets, activeIndex, activeIndex);
        });
      }
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveTicket(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;
    const overType = over.data.current?.type;

    let targetColumnId = null;

    if (overType === 'Column') {
      targetColumnId = overId;
    } else if (overType === 'Ticket') {
      const overTicket = tickets.find(t => t.id === overId);
      if (overTicket) targetColumnId = overTicket.columnId;
    }

    if (targetColumnId) {
      const activeTicketOriginal = active.data.current?.ticket || tickets.find(t => t.id === activeId);
      
      let finalColumnId = targetColumnId;
      let finalAssignee = null;
      if (targetColumnId.includes('___')) {
        const parts = targetColumnId.split('___');
        finalColumnId = parts[0];
        finalAssignee = parts[1];
      }

      if (activeTicketOriginal) {
         try {
           const userName = auth.currentUser?.displayName || auth.currentUser?.email || 'Usuário SGT';
           const originalColumnId = active.data.current?.ticket?.columnId || activeTicketOriginal.columnId;
           
           if (originalColumnId !== finalColumnId) {
             const isLastColumn = columns.length > 0 && columns[columns.length - 1].id === finalColumnId;
             const executionStatus = isLastColumn ? 'concluido' : 'pendente';
             
             await updateTicketStatus(activeId, finalColumnId, userName);
             await updateTicket(activeId, { executionStatus }, userName);
           }
           
           if (finalAssignee && activeTicketOriginal.assignee !== finalAssignee) {
             await updateTicket(activeId, { assignee: finalAssignee === 'Sem responsável' ? '' : finalAssignee }, userName);
           }
         } catch (e) {
           console.error("Falha ao atualizar na nuvem:", e);
         }
      }
    }
  };

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: { opacity: '0.5' },
      },
    }),
  };

  if (error) {
    return (
      <div className="view-content" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: '16px' }}>
        <div style={{ color: 'var(--danger)', fontSize: '48px' }}>⚠️</div>
        <h3 style={{ color: 'var(--text-main)' }}>Erro de Conexão com o Firebase</h3>
        <p style={{ color: 'var(--text-muted)', maxWidth: '600px', textAlign: 'center' }}>
          {error}
        </p>
      </div>
    );
  }

  if (loading && tickets.length === 0) {
    return (
      <div className="view-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Loader2 className="spinner-icon" size={40} color="var(--primary)" />
      </div>
    );
  }

  const isLeader = userRole === 'squad_leader' && auth.currentUser;
  const allowedSquadIds = isLeader ? globalSquads.filter(s => s.leaderId === auth.currentUser.uid).map(s => s.id) : [];
  const allowedProjectIds = isLeader ? [...new Set(globalSquads.filter(s => s.leaderId === auth.currentUser.uid).map(s => s.projectId))] : [];

  let filteredTickets = selectedProjectId === 'all' 
    ? tickets 
    : tickets.filter(t => t.projectId === selectedProjectId);

  if (selectedSquadId !== 'all') {
    filteredTickets = filteredTickets.filter(t => t.squadIds?.includes(selectedSquadId) || t.squadId === selectedSquadId);
  }

  if (isLeader) {
    filteredTickets = filteredTickets.filter(t => {
       const sIds = t.squadIds || (t.squadId ? [t.squadId] : []);
       return sIds.some(id => allowedSquadIds.includes(id));
    });
  }

  const isUser = userRole === 'user' && auth.currentUser;
  if (isUser) {
    const userName = auth.currentUser?.displayName || auth.currentUser?.email;
    const myAllocations = allocations.filter(a => a.userId === auth.currentUser.uid).map(a => a.activityId);
    filteredTickets = filteredTickets.filter(t => t.assignee === userName || myAllocations.includes(t.id));
  }

  // Filtrar pelo quadro atual (Demandas vs Atividades)
  filteredTickets = filteredTickets.filter(t => {
    const tBoard = t.board || 'demandas';
    return tBoard === board;
  });

  filteredTickets = filteredTickets.filter(t => {
    if (advancedFilters.system && (!t.associatedSystems || !t.associatedSystems.some(s => s.system?.toLowerCase().includes(advancedFilters.system.toLowerCase())))) return false;
    if (advancedFilters.priority && t.priority !== advancedFilters.priority && advancedFilters.priority !== 'all') return false;
    if (advancedFilters.type && t.type?.toLowerCase() !== advancedFilters.type.toLowerCase() && advancedFilters.type !== 'all') return false;
    if (advancedFilters.assignee && (!t.assignee || t.assignee !== advancedFilters.assignee) && advancedFilters.assignee !== 'all') return false;
    if (advancedFilters.status && t.columnId !== advancedFilters.status && advancedFilters.status !== 'all') return false;
    if (advancedFilters.jiraStatus && t.jiraStatus !== advancedFilters.jiraStatus && advancedFilters.jiraStatus !== 'all') return false;
    if (advancedFilters.sprint && (!t.sprint || !t.sprint.toLowerCase().includes(advancedFilters.sprint.toLowerCase()))) return false;
    
    if (quickSearch) {
       const term = quickSearch.toLowerCase();
       const matchesCode = t.code?.toLowerCase().includes(term);
       const matchesTitle = t.title?.toLowerCase().includes(term);
       if (!matchesCode && !matchesTitle) return false;
    }

    if (advancedFilters.dateStart) {
       const ticketDate = t.createdAt ? t.createdAt.toDate() : new Date();
       if (ticketDate < new Date(advancedFilters.dateStart)) return false;
    }
    if (advancedFilters.dateEnd) {
       const ticketDate = t.createdAt ? t.createdAt.toDate() : new Date();
       // add 1 day to make end date inclusive
       const endDate = new Date(advancedFilters.dateEnd);
       endDate.setDate(endDate.getDate() + 1);
       if (ticketDate > endDate) return false;
    }
    return true;
  });

  filteredTickets = filteredTickets.map(t => {
    let parentObj = null;
    if (t.parentId) {
      parentObj = tickets.find(p => p.id === t.parentId);
    }
    return {
      ...t,
      squadName: (t.squadIds && t.squadIds.length > 0) 
        ? t.squadIds.map(id => squads.find(sq => sq.id === id)?.name).filter(Boolean).join(', ')
        : (squads.find(sq => sq.id === t.squadId)?.name),
      parentTitle: parentObj ? (parentObj.externalTicket || parentObj.code) : null,
      parentCode: parentObj ? (parentObj.externalTicket || parentObj.code) : null
    };
  });

  const assignees = useSwimlanes 
    ? [...new Set(filteredTickets.map(t => t.assignee || 'Sem responsável'))] 
    : [null];
  const uniqueTypes = [...new Set(tickets.map(t => t.type).filter(Boolean))];
  const uniqueJiraStatuses = [...new Set(tickets.map(t => t.jiraStatus).filter(Boolean))];

  const handleCargaFull = async () => {
    setIsCargaFullLoading(true);
    try {
      setCargaFullProgress({ current: 0, total: 0, text: 'Buscando lista de tickets no Jira...' });
      const results = await searchJiraTickets(); 
      
      if (!results || results.length === 0) {
        alert("Nenhuma demanda encontrada no Jira para importação.");
        return;
      }
      
      setCargaFullProgress({ current: 0, total: results.length, text: 'Iniciando upsert...' });
      
      let count = 0;
      for (const issue of results) {
        try {
          setCargaFullProgress({ current: count + 1, total: results.length, text: `Importando: ${issue.code}` });
          
          const jiraData = await fetchJiraTicket(issue.code);
          
          const proj = projects.find(p => p.id === (selectedProjectId === 'all' ? (projects[0]?.id || 'unknown') : selectedProjectId));
          let startColumnId = 'col-backlog';
          if (proj) {
            const targetWorkflowId = board === 'atividades' ? proj.workflowAtividadesId : proj.workflowId;
            const flow = workflows.find(w => w.id === targetWorkflowId);
            if (flow && flow.columns && flow.columns.length > 0) {
              startColumnId = flow.columns[0].id;
            } else if (flow && flow.columnsStr) {
              const firstColName = flow.columnsStr.split(',')[0].trim();
              startColumnId = `col-${firstColName.toLowerCase().replace(/\s+/g, '-')}`;
            }
          }
          
          let associatedSystems = [];
          const newSquadIds = new Set();
          
          if (jiraData.jiraAssociatedSystems && jiraData.jiraAssociatedSystems.length > 0) {
             associatedSystems = jiraData.jiraAssociatedSystems.map(sys => ({ system: sys, hours: 0 }));
             
             // Forçar carregamento direto do banco para evitar estados assíncronos vazios
             const systemsSnap = await getDocs(collection(db, 'systems'));
             const systemsList = systemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
             
             const squadsSnap = await getDocs(collection(db, 'squads'));
             const squadsList = squadsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
             
             jiraData.jiraAssociatedSystems.forEach(sysName => {
               const normalizedSysName = (sysName || '').trim().toLowerCase();
               const matchedSystem = systemsList.find(s => (s.name || '').trim().toLowerCase() === normalizedSysName);
               if (matchedSystem && matchedSystem.squadId && squadsList.some(sq => sq.id === matchedSystem.squadId)) {
                  newSquadIds.add(matchedSystem.squadId);
               }
             });
          }
          
          const ticketData = {
            code: board === 'demandas' ? jiraData.code : `ATV-${jiraData.code}`,
            title: jiraData.title,
            description: jiraData.description || '',
            type: jiraData.jiraType || 'Demanda', 
            priority: jiraData.priority?.toLowerCase().includes('alta') ? 'high' : 
                      jiraData.priority?.toLowerCase().includes('crítica') ? 'critical' : 'medium',
            columnId: startColumnId,
            projectId: proj?.id || 'unknown',
            squadIds: Array.from(newSquadIds),
            assignee: jiraData.jiraAssignee || 'Sem responsável',
            externalTicket: jiraData.code,
            associatedSystems: associatedSystems,
            estimatedHours: 0,
            storyPoints: 0,
            component: jiraData.jiraLabels?.length > 0 ? jiraData.jiraLabels[0] : '',
            startDate: '',
            endDate: jiraData.jiraDueDate || '',
            environment: jiraData.jiraEnvironment || '',
            reporter: jiraData.jiraCreator || '',
            jiraStatus: jiraData.status || '',
            jiraDatesFlow: jiraData.jiraDatesFlow || {},
            customData: {},
            parentId: '',
            board: board,
            comments: 0
          };
          
          await createTicket(ticketData);
          count++;
        } catch (err) {
          console.error(`Erro ao importar ticket ${issue.code}`, err);
        }
      }
      
      alert(`Carga Full concluída com sucesso! ${count} demandas importadas.`);
      
    } catch (error) {
      console.error(error);
      alert("Erro na Carga Full: " + error.message);
    } finally {
      setIsCargaFullLoading(false);
      setCargaFullProgress({ current: 0, total: 0, text: '' });
    }
  };

  return (
    <>
    <div className="kanban-wrapper" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="kanban-header">
        <Flex align="center" gap="2" className="kanban-filters">
          <Select.Root value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <Select.Trigger className="kanban-select" style={{ minWidth: '140px' }} />
              <Select.Content>
                <Select.Item value="all">Ver Todos os Projetos</Select.Item>
                {projects.filter(p => !isLeader || allowedProjectIds.includes(p.id)).map(p => (
                  <Select.Item key={p.id} value={p.id}>{p.name}</Select.Item>
                ))}
              </Select.Content>
          </Select.Root>
          {selectedProjectId !== 'all' && squads.length > 0 && (
            <Select.Root value={selectedSquadId} onValueChange={setSelectedSquadId}>
              <Select.Trigger className="kanban-select" style={{ minWidth: '140px' }} />
              <Select.Content>
                <Select.Item value="all">Todas as Squads</Select.Item>
                {squads.filter(sq => !isLeader || allowedSquadIds.includes(sq.id)).map(sq => (
                  <Select.Item key={sq.id} value={sq.id}>{sq.name}</Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          )}

          <TextField.Root 
            placeholder="Pesquisa rápida (Cód ou Desc)..." 
            value={quickSearch} 
            onChange={(e) => setQuickSearch(e.target.value)}
            style={{ width: '250px' }}
          >
            <TextField.Slot><Search size={16}/></TextField.Slot>
          </TextField.Root>

          <Dialog.Root open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <Dialog.Trigger>
              <Button variant="soft" color="indigo" className="kanban-btn">
                <Filter size={16} /> Filtros Avançados
              </Button>
            </Dialog.Trigger>
            <Dialog.Content maxWidth="500px">
              <Dialog.Title>Filtros Avançados</Dialog.Title>
              <Grid columns="2" gap="3" mt="3">
                <Flex direction="column" gap="1">
                  <Text size="2" weight="bold">Responsável</Text>
                  <Select.Root value={advancedFilters.assignee || 'all'} onValueChange={val => setAdvancedFilters(prev => ({...prev, assignee: val === 'all' ? '' : val}))}>
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="all">Todos</Select.Item>
                      {assignees.map(a => (
                        <Select.Item key={a} value={a}>{a}</Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </Flex>
                <Flex direction="column" gap="1">
                  <Text size="2" weight="bold">Sistema</Text>
                  <Select.Root value={advancedFilters.system || 'all'} onValueChange={val => setAdvancedFilters(prev => ({...prev, system: val === 'all' ? '' : val}))}>
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="all">Todos</Select.Item>
                      {systems.map(s => (
                        <Select.Item key={s.id} value={s.name}>{s.name}</Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </Flex>
                <Flex direction="column" gap="1">
                  <Text size="2" weight="bold">Prioridade</Text>
                  <Select.Root value={advancedFilters.priority || 'all'} onValueChange={val => setAdvancedFilters(prev => ({...prev, priority: val === 'all' ? '' : val}))}>
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="all">Todas</Select.Item>
                      <Select.Item value="low">Baixa</Select.Item>
                      <Select.Item value="medium">Média</Select.Item>
                      <Select.Item value="high">Alta</Select.Item>
                      <Select.Item value="critical">Crítica</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </Flex>
                <Flex direction="column" gap="1">
                  <Text size="2" weight="bold">Tipo</Text>
                  <Select.Root value={advancedFilters.type || 'all'} onValueChange={val => setAdvancedFilters(prev => ({...prev, type: val === 'all' ? '' : val}))}>
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="all">Todos</Select.Item>
                      {uniqueTypes.map(t => (
                        <Select.Item key={t} value={t}>{t}</Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </Flex>
                <Flex direction="column" gap="1">
                  <Text size="2" weight="bold">Status SGT (Coluna)</Text>
                  <Select.Root value={advancedFilters.status || 'all'} onValueChange={val => setAdvancedFilters(prev => ({...prev, status: val === 'all' ? '' : val}))}>
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="all">Todos</Select.Item>
                      {columns.map(col => (
                        <Select.Item key={col.id} value={col.statusId}>{col.title}</Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </Flex>
                <Flex direction="column" gap="1">
                  <Text size="2" weight="bold">Status Jira</Text>
                  <Select.Root value={advancedFilters.jiraStatus || 'all'} onValueChange={val => setAdvancedFilters(prev => ({...prev, jiraStatus: val === 'all' ? '' : val}))}>
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="all">Todos</Select.Item>
                      {uniqueJiraStatuses.map(js => (
                        <Select.Item key={js} value={js}>{js}</Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </Flex>
                <Flex direction="column" gap="1">
                  <Text size="2" weight="bold">Data Criação (De)</Text>
                  <TextField.Root type="date" value={advancedFilters.dateStart} onChange={e => setAdvancedFilters(prev => ({...prev, dateStart: e.target.value}))} />
                </Flex>
                <Flex direction="column" gap="1">
                  <Text size="2" weight="bold">Data Criação (Até)</Text>
                  <TextField.Root type="date" value={advancedFilters.dateEnd} onChange={e => setAdvancedFilters(prev => ({...prev, dateEnd: e.target.value}))} />
                </Flex>
              </Grid>
              <Flex justify="end" gap="3" mt="4">
                <Button variant="soft" color="gray" onClick={() => { setAdvancedFilters({ system: '', priority: '', type: '', assignee: '', status: '', sprint: '', dateStart: '', dateEnd: '', jiraStatus: '' }); setQuickSearch(''); }}>Limpar Filtros</Button>
                <Button onClick={() => setIsFilterOpen(false)}>Aplicar</Button>
              </Flex>
            </Dialog.Content>
          </Dialog.Root>

        </Flex>

        <Flex gap="2" className="kanban-actions" align="center">
          <Button color="indigo" onClick={() => setIsModalOpen && setIsModalOpen(board)}>
            <Plus size={16} /> <span className="hide-on-mobile">Nova Demanda</span>
          </Button>

          <Button color="green" onClick={handleCargaFull} disabled={isCargaFullLoading}>
            {isCargaFullLoading ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
            <span className="hide-on-mobile">{isCargaFullLoading ? 'Carregando...' : 'Carga Full'}</span>
          </Button>
          
          {isCargaFullLoading && (
            <Text size="2" color="gray" style={{ whiteSpace: 'nowrap' }}>
              {cargaFullProgress.text} ({cargaFullProgress.current}/{cargaFullProgress.total})
            </Text>
          )}

          {viewMode === 'kanban' && (
            <Button 
              variant={useSwimlanes ? 'solid' : 'soft'} 
              onClick={() => setUseSwimlanes(!useSwimlanes)}
              className="kanban-btn"
            >
              <LayoutList size={16} /> 
              <span className="hide-on-mobile">{useSwimlanes ? 'Agrupar por Coluna' : 'Swimlanes (Responsável)'}</span>
              <span className="show-on-mobile">{useSwimlanes ? 'Por Coluna' : 'Swimlanes'}</span>
            </Button>
          )}

          <Button 
            variant={viewMode === 'kanban' ? 'solid' : 'soft'} 
            onClick={() => setViewMode('kanban')}
            className="kanban-btn"
          >
            <LayoutGrid size={16} /> Kanban
          </Button>

          <Button 
            variant={viewMode === 'list' ? 'solid' : 'soft'} 
            onClick={() => setViewMode('list')}
            className="kanban-btn"
          >
            <List size={16} /> Lista
          </Button>
        </Flex>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {viewMode === 'list' ? (
          <div style={{ paddingRight: '16px' }}>
            {columns.map(col => {
              const colTickets = filteredTickets.filter(t => t.columnId === col.statusId && (board === 'atividades' || !t.parentId));
              if (colTickets.length === 0) return null; // Esconde colunas vazias na lista para ser mais limpo
              
              return (
                <Card key={col.id} mb="4" size="3">
                  <Text as="h3" size="4" weight="bold" mb="3">{col.title} <Badge ml="2" radius="full">{colTickets.length}</Badge></Text>
                  <ScrollArea style={{ width: '100%', overflowX: 'auto', paddingBottom: '16px' }}>
                    <Table.Root variant="surface" style={{ whiteSpace: 'nowrap' }}>
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeaderCell>Código</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Título</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Sistema</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Squad</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Responsável</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Prioridade</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Tipo</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Status Jira</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Criação</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Análise T-Shirt</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>T-Shirt Enviada</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Aprovação (Atend.)</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Planejamento SLA</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Planejamento Enviado</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Deadline Aprovação</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Aprovação (EF/SR)</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Início Demanda</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Entrega Planejada</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Data Entrega</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Ap. Homologação</Table.ColumnHeaderCell>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {colTickets.map(t => {
                          const fDate = (isoString) => {
                             if (!isoString) return '-';
                             const [y, m, d] = isoString.split('T')[0].split('-');
                             return `${d}/${m}/${y}`;
                          };
                          return (
                          <Table.Row key={t.id} align="center" style={{ cursor: 'pointer' }} onClick={() => onCardClick(t)}>
                            <Table.Cell><Text weight="bold" color="indigo">{t.code}</Text></Table.Cell>
                            <Table.Cell>{t.title}</Table.Cell>
                            <Table.Cell>
                              {t.associatedSystems && t.associatedSystems.length > 0 ? (
                                t.associatedSystems.length === 1 ? (
                                  <Badge color="blue" variant="soft" style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {t.associatedSystems[0].system}
                                  </Badge>
                                ) : (
                                  <Button size="1" variant="soft" color="blue" onClick={(e) => { e.stopPropagation(); setSystemsModalData(t.associatedSystems); }}>
                                    Ver Sistemas ({t.associatedSystems.length})
                                  </Button>
                                )
                              ) : '-'}
                            </Table.Cell>
                            <Table.Cell>
                              {t.squadName ? <Badge color="purple" variant="soft">{t.squadName}</Badge> : '-'}
                            </Table.Cell>
                            <Table.Cell>{t.assignee || 'Sem responsável'}</Table.Cell>
                            <Table.Cell style={{ textTransform: 'capitalize' }}>{t.priority || '-'}</Table.Cell>
                            <Table.Cell>{t.type || '-'}</Table.Cell>
                            <Table.Cell>
                              {t.jiraStatus ? <Badge color="cyan" variant="soft" size="1">{t.jiraStatus}</Badge> : '-'}
                            </Table.Cell>
                            <Table.Cell>{t.createdAt ? new Date(t.createdAt.toDate()).toLocaleDateString() : '-'}</Table.Cell>
                            <Table.Cell>{fDate(t.jiraDatesFlow?.dataAnaliseTshirt)}</Table.Cell>
                            <Table.Cell>{fDate(t.jiraDatesFlow?.tshirtEnviada)}</Table.Cell>
                            <Table.Cell>{fDate(t.jiraDatesFlow?.aprovacao1)}</Table.Cell>
                            <Table.Cell>{fDate(t.jiraDatesFlow?.planejamentoSLA)}</Table.Cell>
                            <Table.Cell>{fDate(t.jiraDatesFlow?.planejamentoEnviado)}</Table.Cell>
                            <Table.Cell>{fDate(t.jiraDatesFlow?.deadlineAprovacao)}</Table.Cell>
                            <Table.Cell>{fDate(t.jiraDatesFlow?.aprovacao2)}</Table.Cell>
                            <Table.Cell>{fDate(t.jiraDatesFlow?.inicioDemanda)}</Table.Cell>
                            <Table.Cell>{fDate(t.jiraDatesFlow?.dataEntregaPlanejada)}</Table.Cell>
                            <Table.Cell>{fDate(t.jiraDatesFlow?.dataEntrega)}</Table.Cell>
                            <Table.Cell>{fDate(t.jiraDatesFlow?.aprovacaoHomologacao)}</Table.Cell>
                          </Table.Row>
                          );
                        })}
                      </Table.Body>
                    </Table.Root>
                  </ScrollArea>
                </Card>
              );
            })}
            {filteredTickets.length === 0 && (
              <Flex justify="center" align="center" style={{ padding: '40px', background: 'var(--surface)', borderRadius: '8px' }}>
                <Text color="gray">Nenhuma demanda encontrada.</Text>
              </Flex>
            )}
          </div>
        ) : (
          <div className="kanban-board" style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '32px' }}>
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              {assignees.map(assignee => (
                <div key={assignee || 'all'} className="swimlane-container" style={{ minWidth: 'max-content' }}>
                  {useSwimlanes && (
                    <div style={{ padding: '8px 16px', background: 'var(--surface)', borderRadius: '8px', marginBottom: '16px', fontWeight: 'bold' }}>
                      Responsável: <span style={{ color: 'var(--primary)' }}>{assignee}</span>
                    </div>
                  )}
                  <Flex gap="4">
                    {columns.map(col => {
                      const filteredTicketsForCol = filteredTickets.filter(t => {
                        if (t.columnId !== col.statusId || (board === 'demandas' && t.parentId)) return false;
                        if (useSwimlanes) {
                          const tAssignee = t.assignee || 'Sem responsável';
                          return tAssignee === assignee;
                        }
                        return true;
                      });

                      const colId = useSwimlanes ? `${col.statusId}___${assignee}` : col.statusId;

                      return (
                        <KanbanColumn 
                          key={colId} 
                          column={{ ...col, id: colId }} 
                          tickets={filteredTicketsForCol} 
                          allTickets={filteredTickets}
                          onCardClick={onCardClick}
                        />
                      );
                    })}
                  </Flex>
                </div>
              ))}

              <DragOverlay dropAnimation={dropAnimation}>
                {activeTicket ? <KanbanCard ticket={activeTicket} /> : null}
              </DragOverlay>
            </DndContext>
          </div>
        )}
      </div>
    </div>
      
      <Dialog.Root open={!!systemsModalData} onOpenChange={(open) => !open && setSystemsModalData(null)}>
        <Dialog.Content maxWidth="400px">
          <Dialog.Title>Sistemas Associados</Dialog.Title>
          <Flex direction="column" gap="2" mt="2">
            {systemsModalData?.map((s, i) => (
              <Badge key={i} color="blue" variant="soft" size="2" style={{ padding: '8px', justifyContent: 'flex-start' }}>
                {s.system}
              </Badge>
            ))}
          </Flex>
          <Flex justify="end" mt="4">
            <Button variant="soft" color="gray" onClick={() => setSystemsModalData(null)}>Fechar</Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
};

export default KanbanBoard;
