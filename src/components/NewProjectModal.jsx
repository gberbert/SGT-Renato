import React, { useState, useEffect } from 'react';
import { Dialog, Button, Flex, Text, TextField, TextArea, Select } from '@radix-ui/themes';
import { createProject, updateProject } from '../services/projectService';
import { subscribeToWorkflows } from '../services/settingsService';
import { auth } from '../firebase';
import { Loader2 } from 'lucide-react';

const NewProjectModal = ({ isOpen, onClose, editingProject }) => {
  const [loading, setLoading] = useState(false);
  const [workflows, setWorkflows] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    key: '',
    workflowId: ''
  });

  useEffect(() => {
    if (editingProject) {
      setFormData({
        name: editingProject.name,
        description: editingProject.description,
        key: editingProject.key,
        workflowId: editingProject.workflowId || ''
      });
    } else {
      setFormData({ name: '', description: '', key: '', workflowId: '' });
    }

    const unsubscribeWorkflows = subscribeToWorkflows((data) => {
      setWorkflows(data);
    });

    return () => unsubscribeWorkflows();
  }, [editingProject, isOpen]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.key.trim()) return;

    setLoading(true);
    try {
      if (editingProject) {
        await updateProject(editingProject.id, {
          name: formData.name,
          description: formData.description,
          key: formData.key.toUpperCase(),
          workflowId: formData.workflowId,
        });
      } else {
        await createProject({
          name: formData.name,
          description: formData.description,
          key: formData.key.toUpperCase(),
          workflowId: formData.workflowId,
          createdBy: auth.currentUser?.uid || 'unknown',
          leaderName: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin',
        });
      }
      setFormData({ name: '', description: '', key: '', workflowId: '' });
      onClose();
    } catch (error) {
      console.error(error);
      alert('Erro ao criar projeto.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content maxWidth="450px">
        <Dialog.Title>{editingProject ? 'Editar Projeto' : 'Novo Projeto'}</Dialog.Title>
        <Dialog.Description size="2" mb="4" color="gray">
          {editingProject ? 'Atualize as informações do seu projeto.' : 'Crie um novo espaço de trabalho para isolar suas demandas.'}
        </Dialog.Description>

        <form onSubmit={handleSubmit}>
          <Flex direction="column" gap="4">
            <label>
              <Text as="div" size="2" mb="1" weight="bold">Nome do Projeto</Text>
              <TextField.Root
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Ex: Refatoração Mobile"
                required
              />
            </label>

            <label>
              <Text as="div" size="2" mb="1" weight="bold">Chave do Projeto</Text>
              <TextField.Root
                name="key"
                value={formData.key}
                onChange={handleChange}
                placeholder="Ex: RM"
                maxLength={4}
                style={{ textTransform: 'uppercase' }}
                required
              />
              <Text as="div" size="1" color="gray" mt="1">
                Usado para identificar tickets (ex: RM-1, RM-2)
              </Text>
            </label>

            <label>
              <Text as="div" size="2" mb="1" weight="bold">Workflow do Projeto</Text>
              <Select.Root 
                value={formData.workflowId} 
                onValueChange={(val) => setFormData({...formData, workflowId: val})}
              >
                <Select.Trigger placeholder="Selecione um workflow..." style={{ width: '100%' }} />
                <Select.Content>
                  {workflows.map(wf => (
                    <Select.Item key={wf.id} value={wf.id}>{wf.name}</Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
              <Text as="div" size="1" color="gray" mt="1">
                Define as colunas que aparecerão no Kanban deste projeto.
              </Text>
            </label>

            <label>
              <Text as="div" size="2" mb="1" weight="bold">Descrição</Text>
              <TextArea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Objetivo principal deste projeto..."
                rows={3}
              />
            </label>
          </Flex>

          <Flex gap="3" mt="5" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray" type="button" disabled={loading}>
                Cancelar
              </Button>
            </Dialog.Close>
            <Button type="submit" disabled={loading || !formData.name || !formData.key}>
              {loading ? <Loader2 size={16} className="spinner-icon" /> : (editingProject ? 'Salvar Alterações' : 'Criar Projeto')}
            </Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default NewProjectModal;
