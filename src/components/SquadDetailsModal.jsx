import React, { useState, useEffect } from 'react';
import { Dialog, Button, Flex, Text, Box, Table, Checkbox, IconButton, Select, TextField } from '@radix-ui/themes';
import { Loader2, Trash2, Search } from 'lucide-react';
import { updateSquad, deleteSquad } from '../services/squadService';
import { subscribeToUsers, subscribeToSystems } from '../services/settingsService';
import { subscribeToSquadRoles } from '../services/settingsService';
import { SQUAD_ROLE_OPTIONS } from '../utils/userFieldOptions';

const SquadDetailsModal = ({ isOpen, onClose, squad, userRole }) => {
  const [users, setUsers] = useState([]);
  const [systems, setSystems] = useState([]);
  const [squadRoles, setSquadRoles] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  
  const parseUsers = (uArray) => {
    if (!uArray) return [];
    return uArray.map(u => typeof u === 'string' ? { id: u, role: 'Developer' } : u);
  };

  const [squadName, setSquadName] = useState(squad.name || '');
  const [squadDescription, setSquadDescription] = useState(squad.description || '');
  const [squadUsers, setSquadUsers] = useState(parseUsers(squad.users));
  const [squadSystemIds, setSquadSystemIds] = useState(squad.systemIds || (squad.systemId ? [squad.systemId] : []));
  const [squadLeaderId, setSquadLeaderId] = useState(squad.leaderId || '');
  const [saving, setSaving] = useState(false);
  const [systemSearch, setSystemSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');

  useEffect(() => {
    setSquadName(squad.name || '');
    setSquadDescription(squad.description || '');
    setSquadUsers(parseUsers(squad.users));
    setSquadSystemIds(squad.systemIds || (squad.systemId ? [squad.systemId] : []));
    setSquadLeaderId(squad.leaderId || '');
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
    const unsubRoles = subscribeToSquadRoles((data) => {
      setSquadRoles(data.sort((a, b) => (a.order || 0) - (b.order || 0)));
    });
    return () => {
      unsubUsers();
      unsubSystems();
      unsubRoles();
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
        systemIds: squadSystemIds,
        leaderId: squadLeaderId
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
      <Dialog.Content className="ticket-modal" maxWidth="920px" style={{ width: '92vw' }} onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
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

        <Flex gap="4" mb="4">
          <Box style={{ flex: 1 }}>
            <Text weight="bold" size="2" mb="1" as="div">Líder da Squad</Text>
            <Select.Root 
              value={squadLeaderId} 
              onValueChange={setSquadLeaderId}
              disabled={userRole !== 'admin'}
            >
              <Select.Trigger style={{ width: '100%' }} placeholder="Selecione um líder..." />
              <Select.Content>
                <Select.Item value="">Nenhum</Select.Item>
                {users.filter(u => u.role === 'squad_leader').map(u => (
                  <Select.Item key={u.id} value={u.id}>{u.displayName || u.shortName || u.name || u.email}</Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Box>
        </Flex>

        <Flex gap="4" align="center" mb="4">
          <Box style={{ flex: 1 }}>
            <Flex justify="between" align="center" mb="1">
              <Text weight="bold" size="2" as="div">Sistemas Associados</Text>
              <Box style={{ position: 'relative', width: '200px' }}>
                <Search size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-9)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="Buscar sistema..."
                  value={systemSearch}
                  onChange={e => setSystemSearch(e.target.value)}
                  style={{ width: '100%', paddingLeft: '26px', paddingRight: '8px', paddingTop: '4px', paddingBottom: '4px', fontSize: '12px', border: '1px solid var(--gray-6)', borderRadius: '4px', background: 'var(--color-surface)', color: 'inherit', boxSizing: 'border-box' }}
                />
              </Box>
            </Flex>
            <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--gray-6)', padding: '8px', borderRadius: '4px' }}>
              {systems.length === 0 ? <Text size="1" color="gray">Nenhum sistema cadastrado.</Text> : (
                <Flex direction="column" gap="2">
                  {systems.filter(sys => !systemSearch || sys.name?.toLowerCase().includes(systemSearch.toLowerCase())).map(sys => (
                    <label key={sys.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input 
                        type="checkbox" 
                        checked={squadSystemIds.includes(sys.id)}
                        disabled={userRole !== 'admin'}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSquadSystemIds([...squadSystemIds, sys.id]);
                          } else {
                            setSquadSystemIds(squadSystemIds.filter(id => id !== sys.id));
                          }
                        }}
                      />
                      <Text size="2">{sys.name}</Text>
                    </label>
                  ))}
                </Flex>
              )}
            </div>
          </Box>
        </Flex>

        <Box mb="4">
          <Flex justify="between" align="center" mb="2">
            <Text weight="bold" size="3" as="div">Membros ({squadUsers.length})</Text>
            <Box style={{ position: 'relative', width: '240px' }}>
              <Search size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-9)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Buscar membro ou e-mail..."
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                style={{ width: '100%', paddingLeft: '26px', paddingRight: '8px', paddingTop: '5px', paddingBottom: '5px', fontSize: '13px', border: '1px solid var(--gray-6)', borderRadius: '4px', background: 'var(--color-surface)', color: 'inherit', boxSizing: 'border-box' }}
              />
            </Box>
          </Flex>
          {loadingUsers ? <Loader2 className="spinner-icon" /> : (
            <div style={{ maxHeight: '340px', overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-3)' }}>
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
                  {users.filter(u => !memberSearch || (u.displayName || u.shortName || '').toLowerCase().includes(memberSearch.toLowerCase()) || (u.email || '').toLowerCase().includes(memberSearch.toLowerCase())).map(u => {
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
                                {squadRoles.length > 0 ? (
                                  squadRoles.map(role => (
                                    <Select.Item key={role.id} value={role.name}>{role.name}</Select.Item>
                                  ))
                                ) : (
                                  SQUAD_ROLE_OPTIONS.map(role => (
                                    <Select.Item key={role} value={role}>{role}</Select.Item>
                                  ))
                                )}
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
