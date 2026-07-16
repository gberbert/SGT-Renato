import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import KanbanCard from './KanbanCard';

const KanbanColumn = ({ column, tickets, allTickets, onCardClick }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      type: 'Column',
      column,
    },
  });

  return (
    <div className="kanban-column">
      <div className="column-header">
        <h3>{column.title}</h3>
        <span className="ticket-count">{tickets.length}</span>
      </div>
      
      <div 
        ref={setNodeRef} 
        className={`column-body ${isOver ? 'column-body-over' : ''}`}
      >
        <SortableContext 
          id={column.id}
          items={tickets.map(t => t.id)} 
          strategy={verticalListSortingStrategy}
        >
          {tickets.map(ticket => {
            const subtasksCount = allTickets ? allTickets.filter(t => t.parentId === ticket.id).length : 0;
            return (
              <KanbanCard 
                key={ticket.id} 
                ticket={ticket} 
                subtasksCount={subtasksCount}
                onCardClick={onCardClick} 
              />
            );
          })}
        </SortableContext>
        
        {/* Placeholder para colunas vazias */}
        {tickets.length === 0 && (
          <div className="empty-column-placeholder">
            Nenhum ticket
          </div>
        )}
      </div>
    </div>
  );
};

export default KanbanColumn;
