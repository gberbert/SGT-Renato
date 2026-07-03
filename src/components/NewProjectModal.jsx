import React, { useState } from 'react';
import { Dialog, Button, Flex, Text, TextField, TextArea } from '@radix-ui/themes';
import { createProject } from '../services/projectService';
import { auth } from '../firebase';
import { Loader2 } from 'lucide-react';

const NewProjectModal = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    key: '',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.key.trim()) return;

    setLoading(true);
    try {
      await createProject({
        name: formData.name,
        description: formData.description,
        key: formData.key.toUpperCase(),
        createdBy: auth.currentUser?.uid || 'unknown',
        leaderName: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin',
      });
      setFormData({ name: '', description: '', key: '' });
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
        <Dialog.Title>Novo Projeto</Dialog.Title>
        <Dialog.Description size="2" mb="4" color="gray">
          Crie um novo espaço de trabalho para isolar suas demandas.
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
              {loading ? <Loader2 size={16} className="spinner-icon" /> : 'Criar Projeto'}
            </Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default NewProjectModal;
