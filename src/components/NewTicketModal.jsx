import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { createTicket } from '../services/ticketService';
import { auth } from '../firebase';

const NewTicketModal = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'Task',
    priority: 'medium',
    columnId: 'col-backlog' // Padrão
  });

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const ticketData = {
        code: `SGT-${Math.floor(Math.random() * 9000) + 1000}`, // Gerador temporário de código único
        title: formData.title,
        description: formData.description,
        type: formData.type,
        priority: formData.priority,
        columnId: formData.columnId,
        assignee: auth.currentUser?.email || 'Desconhecido',
        comments: 0
      };
      
      await createTicket(ticketData);
      
      // Resetar formulário e fechar
      setFormData({
        title: '',
        description: '',
        type: 'Task',
        priority: 'medium',
        columnId: 'col-backlog'
      });
      onClose();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Ocorreu um erro ao salvar o ticket.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Novo Ticket</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Título do Ticket</label>
              <input 
                type="text" 
                name="title" 
                required 
                placeholder="Ex: Corrigir erro na tela de login"
                value={formData.title}
                onChange={handleChange}
              />
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Tipo</label>
                <select name="type" value={formData.type} onChange={handleChange}>
                  <option value="Task">Tarefa (Task)</option>
                  <option value="Bug">Bug (Erro)</option>
                  <option value="Story">História (Story)</option>
                  <option value="Epic">Épico (Epic)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Prioridade</label>
                <select name="priority" value={formData.priority} onChange={handleChange}>
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                  <option value="critical">Crítica</option>
                </select>
              </div>
            </div>
            
            <div className="form-group">
              <label>Status Inicial (Coluna)</label>
              <select name="columnId" value={formData.columnId} onChange={handleChange}>
                <option value="col-backlog">Backlog</option>
                <option value="col-todo">A Fazer</option>
                <option value="col-in-progress">Em Andamento</option>
              </select>
            </div>
            
            <div className="form-group" style={{ marginTop: '16px' }}>
              <label>Descrição (Opcional)</label>
              <textarea 
                name="description" 
                placeholder="Detalhes adicionais sobre o ticket..."
                value={formData.description}
                onChange={handleChange}
              />
            </div>
          </div>
          
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading} style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-main)' }}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <Loader2 className="spinner-icon" size={18} /> : 'Salvar Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewTicketModal;
