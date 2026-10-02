import React, { useState, useEffect } from 'react';
import { Flex, Text, Button, Table, Dialog, TextField, IconButton, Card, Box } from '@radix-ui/themes';
import { Plus, Edit2, Trash2, Loader2, GripVertical, Download } from 'lucide-react';
import {
  subscribeToSquadRoles,
  saveSquadRole,
  deleteSquadRole,
  seedSquadRoles,
} from '../services/settingsService';

export default function SquadRolesManager() {
  const [squadRoles, setSquadRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [saving, setSaving] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToSquadRoles((roles) => {
      setSquadRoles(roles);
      setLoading(false);
    });
    return () => typeof unsubscribe === 'function' && unsubscribe();
  }, []);

  const openNewModal = () => {
    setEditingRole({
      name: '',
      description: '',
      order: squadRoles.length,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (role) => {
    setEditingRole(role);
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editingRole.name.trim()) return;

    setSaving(true);
    try {
      await saveSquadRole(editingRole);
      setIsModalOpen(false);
      setEditingRole(null);
    } catch (err) {
      console.error('Erro ao salvar papel:', err);
      alert('Erro ao salvar papel de squad');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (roleId) => {
    if (confirm('Deseja realmente excluir este papel de squad?')) {
      try {
        await deleteSquadRole(roleId);
      } catch (err) {
        console.error('Erro ao excluir papel:', err);
        alert('Erro ao excluir papel de squad');
      }
    }
  };

  const handleDragStart = (e, role) => {
    setDraggedItem(role);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetRole) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.id === targetRole.id) return;

    const draggedIndex = squadRoles.findIndex(r => r.id === draggedItem.id);
    const targetIndex = squadRoles.findIndex(r => r.id === targetRole.id);

    const newRoles = [...squadRoles];
    newRoles.splice(draggedIndex, 1);
    newRoles.splice(targetIndex, 0, draggedItem);

    // Atualiza orders
    for (let i = 0; i < newRoles.length; i++) {
      if (newRoles[i].order !== i) {
        await saveSquadRole({ ...newRoles[i], order: i });
      }
    }

    setDraggedItem(null);
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const result = await seedSquadRoles();
      alert(`✓ Seed realizado com sucesso!\n${result.created} papéis criados, ${result.skipped} já existiam.`);
    } catch (err) {
      console.error('Erro ao seedear papéis:', err);
      alert(`Erro ao seedear papéis: ${err.message}`);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div>
      <Flex justify="between" align="center" mb="4">
        <Box>
          <Text as="h2" size="4" weight="bold">Papéis na Squad</Text>
          <Text color="gray" size="2">Gerencie os papéis disponíveis para membros das squads.</Text>
        </Box>
        <Flex gap="2">
          <Button size="2" onClick={handleSeed} disabled={seeding} color="blue" variant="soft">
            <Download size={18} />
            {seeding ? 'Seedeando...' : 'Seedear Padrões'}
          </Button>
          <Button size="2" onClick={openNewModal}>
            <Plus size={18} />
            Novo Papel
          </Button>
        </Flex>
      </Flex>

      {loading ? (
        <Flex justify="center" p="6">
          <Loader2 className="spinner-icon" size={24} />
        </Flex>
      ) : squadRoles.length === 0 ? (
        <Card size="2" style={{ textAlign: 'center', padding: '40px' }}>
          <Text color="gray">Nenhum papel cadastrado ainda.</Text>
        </Card>
      ) : (
        <Table.Root variant="surface">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell style={{ width: '30px' }}></Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Nome do Papel</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Descrição</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={{ width: '60px' }} align="right">
                Ordem
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell align="right">Ações</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {squadRoles.map((role, idx) => (
              <Table.Row
                key={role.id}
                draggable
                onDragStart={(e) => handleDragStart(e, role)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, role)}
                style={{
                  opacity: draggedItem?.id === role.id ? 0.5 : 1,
                  cursor: draggedItem?.id === role.id ? 'grabbing' : 'grab',
                  transition: 'opacity 0.2s',
                }}
              >
                <Table.Cell style={{ padding: '8px 12px' }}>
                  <GripVertical size={16} color="var(--gray-7)" />
                </Table.Cell>
                <Table.Cell>
                  <Text weight="bold">{role.name}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2" color="gray">
                    {role.description || '—'}
                  </Text>
                </Table.Cell>
                <Table.Cell align="right">
                  <Text weight="bold">{idx + 1}</Text>
                </Table.Cell>
                <Table.Cell justify="end">
                  <Flex gap="2" justify="end">
                    <IconButton
                      size="1"
                      variant="soft"
                      onClick={() => openEditModal(role)}
                      title="Editar"
                    >
                      <Edit2 size={14} />
                    </IconButton>
                    <IconButton
                      size="1"
                      color="red"
                      variant="soft"
                      onClick={() => handleDelete(role.id)}
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      )}

      {/* Modal de Edição/Criação */}
      <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
        <Dialog.Content
          maxWidth="450px"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <Dialog.Title>
            {editingRole?.id ? 'Editar Papel da Squad' : 'Novo Papel da Squad'}
          </Dialog.Title>
          <form onSubmit={handleSave}>
            <Flex direction="column" gap="3">
              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  Nome do Papel <span style={{ color: 'red' }}>*</span>
                </Text>
                <TextField.Root
                  value={editingRole?.name || ''}
                  onChange={(e) =>
                    setEditingRole({ ...editingRole, name: e.target.value })
                  }
                  placeholder="Ex: Arquiteto, Developer Jr, Tech Lead..."
                  required
                />
              </label>

              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  Descrição (Opcional)
                </Text>
                <textarea
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid var(--gray-6)',
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    resize: 'vertical',
                  }}
                  value={editingRole?.description || ''}
                  onChange={(e) =>
                    setEditingRole({ ...editingRole, description: e.target.value })
                  }
                  placeholder="Descreva as responsabilidades deste papel..."
                />
              </label>
            </Flex>
            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray" type="button">
                  Cancelar
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 size={14} className="spinner-icon" /> : 'Salvar'}
              </Button>
            </Flex>
          </form>
        </Dialog.Content>
      </Dialog.Root>
    </div>
  );
}
