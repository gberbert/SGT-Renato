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
import { auth } from '../firebase';
import { Loader2, LayoutList } from 'lucide-react';
import { Button, Flex, Select, Text, Card } from '@radix-ui/themes';

const DEFAULT_COLUMNS = [
  { id: 'col-backlog', title: 'Backlog', statusId: 'col-backlog' },
  { id: 'col-todo', title: 'A Fazer', statusId: 'col-todo' },
  { id: 'col-in-progress', title: 'Em Andamento', statusId: 'col-in-progress' },
  { id: 'col-review', title: 'Em Validação', statusId: 'col-review' },
  { id: 'col-done', title: 'Concluído', statusId: 'col-done' }
];


const KanbanBoard = ({ onCardClick }) => {
  const [tickets, setTickets] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTicket, setActiveTicket] = useState(null);
  const [useSwimlanes, setUseSwimlanes] = useState(false);

  const [projects, setProjects] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('all');

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

  // Update columns when project changes
  useEffect(() => {
    if (selectedProjectId === 'all') {
      setColumns(DEFAULT_COLUMNS);
      return;
    }

    const proj = projects.find(p => p.id === selectedProjectId);
    if (!proj || !proj.workflowId) {
      setColumns(DEFAULT_COLUMNS);
      return;
    }

    const wf = workflows.find(w => w.id === proj.workflowId);
    if (wf && wf.columns) {
      setColumns(wf.columns.map(c => ({ id: c.id, title: c.title, statusId: c.id })));
    } else {
      setColumns(DEFAULT_COLUMNS);
    }
  }, [selectedProjectId, projects, workflows]);

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

    // Movendo ticket sobre outro ticket
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

    // Movendo ticket sobre uma coluna vazia
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
      
      // If using swimlanes, targetColumnId might be "col-todo___Renato"
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
        active: {
          opacity: '0.5',
        },
      },
    }),
  };

  if (error) {
    return (
      <div className="view-content" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: '16px' }}>
        <div style={{ color: 'var(--danger)', fontSize: '48px' }}>⚠️</div>
        <h3 style={{ color: 'var(--text-main)' }}>Erro de Conexão com o Firebase</h3>
        <p style={{ color: 'var(--text-muted)', maxWidth: '600px', textAlign: 'center' }}>
          Ocorreu um erro ao tentar ler os dados. Isso geralmente acontece se o banco de dados <b>Firestore</b> ainda não foi criado ou se as <b>Regras de Segurança</b> estão bloqueando a leitura.
        </p>
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '16px', borderRadius: '8px', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          {error}
        </div>
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

  const filteredTickets = selectedProjectId === 'all' 
    ? tickets 
    : tickets.filter(t => t.projectId === selectedProjectId);

  const assignees = useSwimlanes 
    ? [...new Set(filteredTickets.map(t => t.assignee || 'Sem responsável'))] 
    : [null];

  return (
    <div className="kanban-wrapper">
      <div className="kanban-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <Flex align="center" gap="4">
          <h2>Quadro Kanban</h2>
          <Select.Root value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <Select.Trigger style={{ width: '250px' }} />
            <Select.Content>
              <Select.Item value="all">Ver Todos os Tickets</Select.Item>
              {projects.map(p => (
                <Select.Item key={p.id} value={p.id}>{p.name}</Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Flex>

        <Button 
          variant={useSwimlanes ? 'solid' : 'soft'} 
          onClick={() => setUseSwimlanes(!useSwimlanes)}
        >
          <LayoutList size={16} /> 
          {useSwimlanes ? 'Agrupar por Coluna' : 'Agrupar por Responsável (Swimlanes)'}
        </Button>
      </div>

      <div className="kanban-board" style={{ display: 'flex', flexDirection: 'column', gap: '32px', overflowX: 'auto' }}>
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
                    if (t.columnId !== col.statusId || t.parentId) return false;
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
    </div>
  );
};

export default KanbanBoard;
