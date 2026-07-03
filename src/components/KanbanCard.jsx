import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MessageSquare, User, GitMerge } from 'lucide-react';

const KanbanCard = ({ ticket, subtasksCount = 0, onCardClick }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: ticket.id,
    data: {
      type: 'Ticket',
      ticket,
    },
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'critical': return 'var(--danger)';
      case 'high': return 'var(--warning)';
      case 'medium': return 'var(--info)';
      case 'low': return 'var(--success)';
      default: return 'var(--text-muted)';
    }
  };

  if (isDragging) {
    return (
      <div 
        ref={setNodeRef} 
        style={{ ...style, opacity: 0.3, border: '2px dashed var(--primary)' }} 
        className="kanban-card glass-panel"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`kanban-card glass-panel ${ticket.isBlocked ? 'blocked-ticket' : ''}`}
      onClick={() => onCardClick && onCardClick(ticket)}
    >
      <div className="card-header">
        <span className="ticket-code">{ticket.code}</span>
        <span className="ticket-type">{ticket.type}</span>
      </div>
      
      <h4 className="ticket-title">{ticket.title}</h4>
      
      <div className="card-footer">
        <div className="indicators">
          <div 
            className="priority-indicator" 
            style={{ backgroundColor: getPriorityColor(ticket.priority) }} 
            title={`Prioridade: ${ticket.priority}`}
          />
          {subtasksCount > 0 && (
            <span className="comments-count" style={{ color: 'var(--primary)', fontWeight: 'bold' }} title={`${subtasksCount} sub-tarefas`}>
              <GitMerge size={14} /> {subtasksCount}
            </span>
          )}
          {ticket.comments > 0 && (
            <span className="comments-count">
              <MessageSquare size={14} /> {ticket.comments}
            </span>
          )}
        </div>
        
        <div className="assignee" title={ticket.assignee || 'Sem responsável'}>
          {ticket.assignee ? (
            <div className="avatar-small">{ticket.assignee.charAt(0)}</div>
          ) : (
            <User size={16} color="var(--text-muted)" />
          )}
        </div>
      </div>
    </div>
  );
};

export default KanbanCard;
