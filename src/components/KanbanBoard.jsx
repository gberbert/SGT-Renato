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
import { subscribeToTickets, updateTicketStatus, updateTicket } from '../services/ticketService';
import { subscribeToWorkflows } from '../services/settingsService';
import { subscribeToProjects } from '../services/projectService';
import { subscribeToProjectSquads } from '../services/squadService';
import { auth } from '../firebase';
import { Loader2, LayoutList, List, LayoutGrid } from 'lucide-react';
import { Button, Flex, Select, Text, Table, Badge, Card } from '@radix-ui/themes';

const DEFAULT_COLUMNS = [
  { id: 'col-backlog', title: 'Backlog', statusId: 'col-backlog' },
  { id: 'col-todo', title: 'A Fazer', statusId: 'col-todo' },
  { id: 'col-in-progress', title: 'Em Andamento', statusId: 'col-in-progress' },
  { id: 'col-review', title: 'Em Validação', statusId: 'col-review' },
  { id: 'col-done', title: 'Concluído', statusId: 'col-done' }
];

const KanbanBoard = ({ onCardClick, userRole, board = 'demandas' }) => {
  const [tickets, setTickets] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTicket, setActiveTicket] = useState(null);
  const [useSwimlanes, setUseSwimlanes] = useState(false);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'list'
  const [projects, setProjects] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  
  const [squads, setSquads] = useState([]);
  const [selectedSquadId, setSelectedSquadId] = useState('all');

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

    return () => {
      unsubscribeTickets();
      unsubscribeCols();
      unsubscribeProjects();
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
  }, [selectedProjectId, projects, workflows]);

  useEffect(() => {
    setSelectedSquadId('all');
    if (selectedProjectId === 'all') {
      setSquads([]);
      return;
    }
    const unsub = subscribeToProjectSquads(selectedProjectId, setSquads, console.error);
    return () => unsub();
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
      const activeTicketOriginal = tickets.find(t => t.id === activeId);
      
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
           
           if (activeTicketOriginal.columnId !== finalColumnId) {
             await updateTicketStatus(activeId, finalColumnId, userName);
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

  let filteredTickets = selectedProjectId === 'all' 
    ? tickets 
    : tickets.filter(t => t.projectId === selectedProjectId);

  if (selectedSquadId !== 'all') {
    filteredTickets = filteredTickets.filter(t => t.squadId === selectedSquadId);
  }

  // Filtrar pelo quadro atual (Demandas vs Atividades)
  filteredTickets = filteredTickets.filter(t => {
    const tBoard = t.board || 'demandas';
    return tBoard === board;
  });

  filteredTickets = filteredTickets.map(t => ({
    ...t,
    squadName: squads.find(sq => sq.id === t.squadId)?.name
  }));

  const assignees = useSwimlanes 
    ? [...new Set(filteredTickets.map(t => t.assignee || 'Sem responsável'))] 
    : [null];

  return (
    <div className="kanban-wrapper" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="kanban-header">
        <Flex align="center" gap="2" className="kanban-filters">
          <Select.Root value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <Select.Trigger className="kanban-select" style={{ minWidth: '140px' }} />
            <Select.Content>
              <Select.Item value="all">Ver Todos os Projetos</Select.Item>
              {projects.map(p => (
                <Select.Item key={p.id} value={p.id}>{p.name}</Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
          {selectedProjectId !== 'all' && squads.length > 0 && (
            <Select.Root value={selectedSquadId} onValueChange={setSelectedSquadId}>
              <Select.Trigger className="kanban-select" style={{ minWidth: '140px' }} />
              <Select.Content>
                <Select.Item value="all">Todas as Squads</Select.Item>
                {squads.map(sq => (
                  <Select.Item key={sq.id} value={sq.id}>{sq.name}</Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          )}
        </Flex>

        <Flex gap="2" className="kanban-actions">
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
                  <Table.Root variant="surface">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeaderCell>Código</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Título</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Sistema</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Squad</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Responsável</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Criação</Table.ColumnHeaderCell>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {colTickets.map(t => (
                        <Table.Row key={t.id} align="center" style={{ cursor: 'pointer' }} onClick={() => onCardClick(t.id)}>
                          <Table.Cell><Text weight="bold" color="indigo">{t.code}</Text></Table.Cell>
                          <Table.Cell>{t.title}</Table.Cell>
                          <Table.Cell>
                            {(t.associatedSystems && t.associatedSystems.length > 0) ? (
                              <Flex gap="1" wrap="wrap">
                                {t.associatedSystems.map((sys, idx) => (
                                  <Badge key={idx} color="blue" variant="soft">{sys.system}</Badge>
                                ))}
                              </Flex>
                            ) : '-'}
                          </Table.Cell>
                          <Table.Cell>
                            {t.squadName ? <Badge color="purple" variant="soft">{t.squadName}</Badge> : '-'}
                          </Table.Cell>
                          <Table.Cell>{t.assignee || 'Sem responsável'}</Table.Cell>
                          <Table.Cell>
                            {t.createdAt ? new Date(t.createdAt.toDate()).toLocaleDateString() : '-'}
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
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
  );
};

export default KanbanBoard;
