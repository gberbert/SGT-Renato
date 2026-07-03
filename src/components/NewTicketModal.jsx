import React, { useState, useEffect } from 'react';
import { Dialog, Button, Flex, Text, TextField, TextArea, Select } from '@radix-ui/themes';
import { createTicket } from '../services/ticketService';
import { subscribeToTicketTypes, subscribeToWorkflows } from '../services/settingsService';
import { subscribeToProjects } from '../services/projectService';
import { auth } from '../firebase';
import { Loader2 } from 'lucide-react';

const DEFAULT_COLUMNS = [
  { id: 'col-backlog', title: 'Backlog', statusId: 'col-backlog' },
  { id: 'col-todo', title: 'A Fazer', statusId: 'col-todo' },
  { id: 'col-in-progress', title: 'Em Andamento', statusId: 'col-in-progress' },
  { id: 'col-review', title: 'Em Validação', statusId: 'col-review' },
  { id: 'col-done', title: 'Concluído', statusId: 'col-done' }
];

const NewTicketModal = ({ isOpen, onClose, parentId = null }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'Task',
    priority: 'medium',
    columnId: '',
    projectId: ''
  });
  const [ticketTypes, setTicketTypes] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    const unsubscribeTypes = subscribeToTicketTypes((data) => {
      setTicketTypes(data);
      if (data.length > 0 && !data.find(t => t.name === formData.type)) {
        setFormData(prev => ({ ...prev, type: data[0].name }));
      }
    });
    const unsubscribeWorkflows = subscribeToWorkflows((data) => {
      setWorkflows(data);
    });
    const unsubscribeProjects = subscribeToProjects((data) => {
      setProjects(data);
    });
    return () => {
      unsubscribeTypes();
      unsubscribeWorkflows();
      unsubscribeProjects();
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.projectId) return;
    setLoading(true);
    
    try {
      const proj = projects.find(p => p.id === formData.projectId);
      const projKey = proj ? proj.key : 'SGT';

      const ticketData = {
        code: `${projKey}-${Math.floor(Math.random() * 9000) + 1000}`,
        title: formData.title,
        description: formData.description,
        type: formData.type,
        priority: formData.priority,
        columnId: formData.columnId,
        projectId: formData.projectId,
        assignee: auth.currentUser?.email || 'Desconhecido',
        comments: 0
      };
      if (parentId) {
        ticketData.parentId = parentId;
      }
      
      await createTicket(ticketData);
      
      setFormData({
        title: '',
        description: '',
        type: 'Task',
        priority: 'medium',
        columnId: '',
        projectId: ''
      });
      onClose();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Ocorreu um erro ao salvar o ticket.");
    } finally {
      setLoading(false);
    }
  };

  const getAvailableColumns = () => {
    if (!formData.projectId) return [];
    const proj = projects.find(p => p.id === formData.projectId);
    if (!proj || !proj.workflowId) return DEFAULT_COLUMNS;
    const wf = workflows.find(w => w.id === proj.workflowId);
    return wf && wf.columns && wf.columns.length > 0 ? wf.columns : DEFAULT_COLUMNS;
  };

  const availableColumns = getAvailableColumns();

  // If selected column is not in available, reset it
  useEffect(() => {
    if (availableColumns.length > 0 && !availableColumns.find(c => c.id === formData.columnId)) {
      setFormData(prev => ({ ...prev, columnId: availableColumns[0].id }));
    }
  }, [availableColumns, formData.columnId]);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content maxWidth="500px">
        <Dialog.Title>Novo Ticket</Dialog.Title>
        <Dialog.Description size="2" mb="4" color="gray">
          Crie uma nova demanda para sua equipe.
        </Dialog.Description>
        
        <form onSubmit={handleSubmit}>
          <Flex direction="column" gap="4">
            <label>
              <Text as="div" size="2" mb="1" weight="bold">Projeto</Text>
              <Select.Root value={formData.projectId} onValueChange={(v) => handleSelectChange('projectId', v)}>
                <Select.Trigger placeholder="Selecione um projeto..." style={{ width: '100%' }} />
                <Select.Content>
                  {projects.map(p => (
                    <Select.Item key={p.id} value={p.id}>{p.name}</Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </label>

            <label>
              <Text as="div" size="2" mb="1" weight="bold">Título do Ticket</Text>
              <TextField.Root 
                name="title" 
                required 
                placeholder="Ex: Corrigir erro na tela de login"
                value={formData.title}
                onChange={handleChange}
              />
            </label>
            
            <Flex gap="4">
              <label style={{ flex: 1 }}>
                <Text as="div" size="2" mb="1" weight="bold">Tipo</Text>
                <Select.Root value={formData.type} onValueChange={(v) => handleSelectChange('type', v)}>
                  <Select.Trigger style={{ width: '100%' }} />
                  <Select.Content>
                    {ticketTypes.length > 0 ? ticketTypes.map(t => (
                      <Select.Item key={t.id} value={t.name}>{t.name}</Select.Item>
                    )) : (
                      <>
                        <Select.Item value="Task">Tarefa (Task)</Select.Item>
                        <Select.Item value="Bug">Bug (Erro)</Select.Item>
                        <Select.Item value="Story">História (Story)</Select.Item>
                        <Select.Item value="Epic">Épico (Epic)</Select.Item>
                      </>
                    )}
                  </Select.Content>
                </Select.Root>
              </label>

              <label style={{ flex: 1 }}>
                <Text as="div" size="2" mb="1" weight="bold">Prioridade</Text>
                <Select.Root value={formData.priority} onValueChange={(v) => handleSelectChange('priority', v)}>
                  <Select.Trigger style={{ width: '100%' }} />
                  <Select.Content>
                    <Select.Item value="low">Baixa</Select.Item>
                    <Select.Item value="medium">Média</Select.Item>
                    <Select.Item value="high">Alta</Select.Item>
                    <Select.Item value="critical">Crítica</Select.Item>
                  </Select.Content>
                </Select.Root>
              </label>
            </Flex>
            
            <label>
              <Text as="div" size="2" mb="1" weight="bold">Status Inicial</Text>
              <Select.Root 
                value={formData.columnId} 
                onValueChange={(v) => handleSelectChange('columnId', v)}
                disabled={!formData.projectId}
              >
                <Select.Trigger placeholder={formData.projectId ? "Selecione o status" : "Selecione um projeto primeiro"} style={{ width: '100%' }} />
                <Select.Content>
                  {availableColumns.length > 0 ? availableColumns.map(c => (
                    <Select.Item key={c.id} value={c.id}>{c.title}</Select.Item>
                  )) : (
                    <Select.Item value="none" disabled>Nenhum status disponível</Select.Item>
                  )}
                </Select.Content>
              </Select.Root>
            </label>
            
            <label>
              <Text as="div" size="2" mb="1" weight="bold">Descrição (Opcional)</Text>
              <TextArea 
                name="description" 
                placeholder="Detalhes adicionais sobre o ticket..."
                value={formData.description}
                onChange={handleChange}
                rows={4}
              />
            </label>
          </Flex>
          
          <Flex gap="3" mt="5" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray" type="button" disabled={loading}>
                Cancelar
              </Button>
            </Dialog.Close>
            <Button type="submit" disabled={loading || !formData.title || !formData.projectId || !formData.columnId}>
              {loading ? <Loader2 className="spinner-icon" size={16} /> : 'Salvar Ticket'}
            </Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default NewTicketModal;
