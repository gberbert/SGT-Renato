import React, { useState, useEffect } from 'react';
import { Dialog, Button, Flex, Text, Box, Table, Checkbox, IconButton, Select, TextField } from '@radix-ui/themes';
import { Loader2, Trash2, Box as BoxIcon } from 'lucide-react';
import { updateSquad, deleteSquad } from '../services/squadService';
import { subscribeToUsers, subscribeToSystems } from '../services/settingsService';

const SquadDetailsModal = ({ isOpen, onClose, squad, userRole }) => {
  const [users, setUsers] = useState([]);
  const [systems, setSystems] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  
  const parseUsers = (uArray) => {
    if (!uArray) return [];
    return uArray.map(u => typeof u === 'string' ? { id: u, role: 'Developer' } : u);
  };

  const [squadName, setSquadName] = useState(squad.name || '');
  const [squadDescription, setSquadDescription] = useState(squad.description || '');
  const [squadUsers, setSquadUsers] = useState(parseUsers(squad.users));
  const [squadSystemId, setSquadSystemId] = useState(squad.systemId || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSquadName(squad.name || '');
    setSquadDescription(squad.description || '');
    setSquadUsers(parseUsers(squad.users));
    setSquadSystemId(squad.systemId || '');
  }, [squad]);

  useEffect(() => {
    if (!isOpen) return;
    const unsubUsers = subscribeToUsers((data) => {
      setUsers(data);
      setLoadingUsers(false);
    });
    const unsubSystems = subscribeToSystems((data) => {
      setSystems(data);
    });
    return () => {
      unsubUsers();
      unsubSystems();
    };
  }, [isOpen]);

  const handleToggleUser = (userId, checked) => {
    if (checked) {
      setSquadUsers(prev => [...prev, { id: userId, role: 'Developer' }]);
    } else {
      setSquadUsers(prev => prev.filter(su => su.id !== userId));
    }
  };

  const handleRoleChange = (userId, newRole) => {
    setSquadUsers(prev => prev.map(su => su.id === userId ? { ...su, role: newRole } : su));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSquad(squad.id, { 
        name: squadName,
        description: squadDescription,
        users: squadUsers, 
        systemId: squadSystemId 
      });
      onClose();
    } catch (e) {
      alert("Erro ao atualizar membros da squad.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm("Deseja realmente excluir esta Squad?")) {
      try {
        await deleteSquad(squad.id);
        onClose();
      } catch (e) {
        alert("Erro ao excluir.");
      }
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content maxWidth="600px">
        <Flex justify="between" align="center" mb="4">
          <Dialog.Title style={{ marginBottom: 0 }}>Gestão da Squad</Dialog.Title>
          {userRole === 'admin' && (
            <IconButton color="red" variant="soft" onClick={handleDelete} title="Excluir Squad">
              <Trash2 size={16} />
            </IconButton>
          )}
        </Flex>

        <Flex gap="4" mb="4">
          <Box style={{ flex: 1 }}>
            <Text weight="bold" size="2" mb="1" as="div">Nome da Squad</Text>
            <TextField.Root 
              value={squadName} 
              onChange={e => setSquadName(e.target.value)} 
              disabled={userRole !== 'admin'}
            />
          </Box>
          <Box style={{ flex: 1 }}>
            <Text weight="bold" size="2" mb="1" as="div">Descrição</Text>
            <TextField.Root 
              value={squadDescription} 
              onChange={e => setSquadDescription(e.target.value)} 
              disabled={userRole !== 'admin'}
            />
          </Box>
        </Flex>

        <Flex gap="4" align="center" mb="4">
          <Box style={{ flex: 1 }}>
            <Text weight="bold" size="2" mb="1" as="div">Sistema Associado</Text>
            <Select.Root 
              value={squadSystemId} 
              onValueChange={setSquadSystemId} 
              disabled={userRole !== 'admin'}
            >
              <Select.Trigger style={{ width: '100%' }} />
              <Select.Content>
                <Select.Item value="">Nenhum Sistema (Padrão)</Select.Item>
                {systems.map(sys => (
                  <Select.Item key={sys.id} value={sys.id}>{sys.name}</Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Box>
        </Flex>

        <Box mb="4">
          <Text weight="bold" size="3" mb="2" as="div">Membros ({squadUsers.length})</Text>
          {loadingUsers ? <Loader2 className="spinner-icon" /> : (
            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-3)' }}>
              <Table.Root size="1">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell style={{ width: '40px' }}></Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Nome</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>E-mail</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Papel (Role)</Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {users.map(u => {
                    const memberObj = squadUsers.find(su => su.id === u.id);
                    const isMember = !!memberObj;
                    return (
                      <Table.Row key={u.id} align="center">
                        <Table.Cell>
                          <Checkbox 
                            checked={isMember} 
                            disabled={userRole !== 'admin'}
                            onCheckedChange={(checked) => handleToggleUser(u.id, checked)}
                          />
                        </Table.Cell>
                        <Table.Cell>
                          <Text weight="bold">{u.displayName || u.shortName || 'Sem nome'}</Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="1" color="gray">{u.email}</Text>
                        </Table.Cell>
                        <Table.Cell>
                          {isMember ? (
                            <Select.Root 
                              value={memberObj.role} 
                              onValueChange={(val) => handleRoleChange(u.id, val)}
                              disabled={userRole !== 'admin'}
                            >
                              <Select.Trigger style={{ width: '130px' }} />
                              <Select.Content>
                                <Select.Item value="Arquiteto">Arquiteto</Select.Item>
                                <Select.Item value="Developer">Developer</Select.Item>
                                <Select.Item value="Tester">Tester</Select.Item>
                                <Select.Item value="Functional">Functional</Select.Item>
                                <Select.Item value="Scrum Master">Scrum Master</Select.Item>
                                <Select.Item value="GP">GP</Select.Item>
                              </Select.Content>
                            </Select.Root>
                          ) : (
                            <Text size="1" color="gray">-</Text>
                          )}
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Root>
            </div>
          )}
        </Box>

        <Flex gap="3" mt="5" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray" type="button">Cancelar</Button>
          </Dialog.Close>
          {userRole === 'admin' && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={14} className="spinner-icon"/> : "Salvar Membros"}
            </Button>
          )}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default SquadDetailsModal;
