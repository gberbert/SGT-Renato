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
import { subscribeToTickets, updateTicketStatus } from '../services/ticketService';
import { Loader2 } from 'lucide-react';

const COLUMNS = [
  { id: 'col-backlog', title: 'Backlog' },
  { id: 'col-todo', title: 'A Fazer' },
  { id: 'col-in-progress', title: 'Em Andamento' },
  { id: 'col-review', title: 'Em Validação' },
  { id: 'col-done', title: 'Concluído' }
];

const KanbanBoard = ({ onCardClick }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTicket, setActiveTicket] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeToTickets((data) => {
      setTickets(data);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error(err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
      // Atualizar no banco de dados se a coluna mudou
      const activeTicketOriginal = tickets.find(t => t.id === activeId);
      if (activeTicketOriginal && activeTicketOriginal.columnId !== targetColumnId) {
         try {
           await updateTicketStatus(activeId, targetColumnId);
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

  return (
    <div className="kanban-wrapper">
      <div className="kanban-header">
        <h2>Quadro Kanban</h2>
      </div>

      <div className="kanban-board">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {COLUMNS.map(col => (
            <KanbanColumn 
              key={col.id} 
              column={col} 
              tickets={tickets.filter(t => t.columnId === col.id && !t.parentId)} 
              allTickets={tickets}
              onCardClick={onCardClick}
            />
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
