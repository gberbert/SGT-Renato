import React, { useState } from 'react';
import { Dialog, Button, Flex, Text, TextField, TextArea, Select } from '@radix-ui/themes';
import { createTicket } from '../services/ticketService';
import { auth } from '../firebase';
import { Loader2 } from 'lucide-react';

const NewTicketModal = ({ isOpen, onClose, parentId = null }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'Task',
    priority: 'medium',
    columnId: 'col-backlog'
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    setLoading(true);
    
    try {
      const ticketData = {
        code: `SGT-${Math.floor(Math.random() * 9000) + 1000}`,
        title: formData.title,
        description: formData.description,
        type: formData.type,
        priority: formData.priority,
        columnId: formData.columnId,
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
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content maxWidth="500px">
        <Dialog.Title>Novo Ticket</Dialog.Title>
        <Dialog.Description size="2" mb="4" color="gray">
          Crie uma nova demanda para sua equipe.
        </Dialog.Description>
        
        <form onSubmit={handleSubmit}>
          <Flex direction="column" gap="4">
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
                    <Select.Item value="Task">Tarefa (Task)</Select.Item>
                    <Select.Item value="Bug">Bug (Erro)</Select.Item>
                    <Select.Item value="Story">História (Story)</Select.Item>
                    <Select.Item value="Epic">Épico (Epic)</Select.Item>
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
              <Select.Root value={formData.columnId} onValueChange={(v) => handleSelectChange('columnId', v)}>
                <Select.Trigger style={{ width: '100%' }} />
                <Select.Content>
                  <Select.Item value="col-backlog">Backlog</Select.Item>
                  <Select.Item value="col-todo">A Fazer</Select.Item>
                  <Select.Item value="col-in-progress">Em Andamento</Select.Item>
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
            <Button type="submit" disabled={loading || !formData.title}>
              {loading ? <Loader2 className="spinner-icon" size={16} /> : 'Salvar Ticket'}
            </Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default NewTicketModal;
