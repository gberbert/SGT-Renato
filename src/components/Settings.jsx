import React, { useState, useEffect } from 'react';
import { Tabs, Box, Text, Card, Flex, Button, Table, Badge, Dialog, TextField, Select, IconButton } from '@radix-ui/themes';
import { 
  subscribeToTicketTypes, saveTicketType, deleteTicketType, 
  subscribeToWorkflows, saveWorkflow, deleteWorkflow, 
  subscribeToUsers, updateUserRole, updateUser,
  subscribeToSystems, saveSystem, deleteSystem,
  subscribeToComponents, saveComponent, deleteComponent 
} from '../services/settingsService';
import { Loader2, Trash2, Settings2, Database, Edit2 } from 'lucide-react';
import WorkflowStagesModal from './WorkflowStagesModal';
import { db } from '../firebase';
import { writeBatch, doc } from 'firebase/firestore';

const Settings = () => {
  const [ticketTypes, setTicketTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  
  const [workflows, setWorkflows] = useState([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(true);

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [systems, setSystems] = useState([]);
  const [loadingSystems, setLoadingSystems] = useState(true);

  const [components, setComponents] = useState([]);
  const [loadingComponents, setLoadingComponents] = useState(true);

  // New/Edit Type Modal State
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [typeData, setTypeData] = useState({ name: '', color: 'blue', icon: 'Bug' });
  const [savingType, setSavingType] = useState(false);

  // New Workflow Modal State
  const [isNewWorkflowModalOpen, setIsNewWorkflowModalOpen] = useState(false);
  const [newWorkflowData, setNewWorkflowData] = useState({ name: '', columnsStr: '' });
  const [savingWorkflow, setSavingWorkflow] = useState(false);
  
  const [selectedWorkflowForStages, setSelectedWorkflowForStages] = useState(null);

  // System Modal State
  const [isSystemModalOpen, setIsSystemModalOpen] = useState(false);
  const [systemData, setSystemData] = useState({ name: '' });
  const [savingSystem, setSavingSystem] = useState(false);

  // Component Modal State
  const [isComponentModalOpen, setIsComponentModalOpen] = useState(false);
  const [componentData, setComponentData] = useState({ name: '' });
  const [savingComponent, setSavingComponent] = useState(false);

  // User Edit Modal State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUserData, setEditingUserData] = useState({ id: '', shortName: '' });
  const [savingUser, setSavingUser] = useState(false);

  useEffect(() => {
    const unsubscribeTypes = subscribeToTicketTypes((data) => {
      setTicketTypes(data);
      setLoadingTypes(false);
    });
    const unsubscribeWorkflows = subscribeToWorkflows((data) => {
      setWorkflows(data);
      setLoadingWorkflows(false);
    });
    const unsubscribeUsers = subscribeToUsers((data) => {
      setUsers(data);
      setLoadingUsers(false);
    });
    const unsubscribeSystems = subscribeToSystems((data) => {
      setSystems(data);
      setLoadingSystems(false);
    });
    const unsubscribeComponents = subscribeToComponents((data) => {
      setComponents(data);
      setLoadingComponents(false);
    });
    return () => {
      unsubscribeTypes();
      unsubscribeWorkflows();
      unsubscribeUsers();
      unsubscribeSystems();
      unsubscribeComponents();
    };
  }, []);

  const openNewTypeModal = () => {
    setTypeData({ name: '', color: 'blue', icon: 'Bug' });
    setIsTypeModalOpen(true);
  };

  const openEditTypeModal = (type) => {
    setTypeData(type);
    setIsTypeModalOpen(true);
  };

  const handleSaveType = async (e) => {
    e.preventDefault();
    if (!typeData.name.trim()) return;
    setSavingType(true);
    try {
      await saveTicketType(typeData);
      setIsTypeModalOpen(false);
    } catch (err) {
      alert("Erro ao salvar tipo.");
    } finally {
      setSavingType(false);
    }
  };

  const handleDeleteType = async (id) => {
    if (confirm("Deseja realmente excluir este tipo de ticket?")) {
      await deleteTicketType(id);
    }
  };

  const handleSaveWorkflow = async (e) => {
    e.preventDefault();
    if (!newWorkflowData.name.trim() || !newWorkflowData.columnsStr.trim()) return;
    setSavingWorkflow(true);
    try {
      const colsArray = newWorkflowData.columnsStr.split(',').map(c => {
        const title = c.trim();
        const id = `col-${title.toLowerCase().replace(/\s+/g, '-')}`;
        return { id, title, statusId: id };
      });
      await saveWorkflow({ name: newWorkflowData.name, columns: colsArray });
      setNewWorkflowData({ name: '', columnsStr: '' });
      setIsNewWorkflowModalOpen(false);
    } catch (err) {
      alert("Erro ao salvar coluna.");
    } finally {
      setSavingWorkflow(false);
    }
  };

  const handleDeleteWorkflow = async (id) => {
    if (confirm("Deseja realmente excluir esta coluna do Kanban?")) {
      await deleteWorkflow(id);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateUserRole(userId, newRole);
    } catch (e) {
      alert("Erro ao atualizar o papel do usuário.");
    }
  };

  const openEditUserModal = (user) => {
    setEditingUserData({ id: user.id, shortName: user.shortName || '' });
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setSavingUser(true);
    try {
      await updateUser(editingUserData.id, { shortName: editingUserData.shortName });
      setIsUserModalOpen(false);
    } catch (e) {
      alert("Erro ao atualizar usuário.");
    } finally {
      setSavingUser(false);
    }
  };

  const openNewSystemModal = () => {
    setSystemData({ name: '' });
    setIsSystemModalOpen(true);
  };

  const openEditSystemModal = (sys) => {
    setSystemData(sys);
    setIsSystemModalOpen(true);
  };

  const handleSaveSystem = async (e) => {
    e.preventDefault();
    if (!systemData.name.trim()) return;
    setSavingSystem(true);
    try {
      await saveSystem(systemData);
      setIsSystemModalOpen(false);
    } catch (err) {
      alert("Erro ao salvar sistema.");
    } finally {
      setSavingSystem(false);
    }
  };

  const handleDeleteSystem = async (id) => {
    if (confirm("Deseja realmente excluir este sistema?")) await deleteSystem(id);
  };

  const openNewComponentModal = () => {
    setComponentData({ name: '' });
    setIsComponentModalOpen(true);
  };

  const openEditComponentModal = (comp) => {
    setComponentData(comp);
    setIsComponentModalOpen(true);
  };

  const handleSaveComponent = async (e) => {
    e.preventDefault();
    if (!componentData.name.trim()) return;
    setSavingComponent(true);
    try {
      await saveComponent(componentData);
      setIsComponentModalOpen(false);
    } catch (err) {
      alert("Erro ao salvar componente.");
    } finally {
      setSavingComponent(false);
    }
  };

  const handleDeleteComponent = async (id) => {
    if (confirm("Deseja realmente excluir este componente?")) await deleteComponent(id);
  };

  const handleInjectHolidays = async () => {
    try {
      if(!confirm("Atenção! Isso vai gravar 5570 municípios no Firebase. Deseja continuar?")) return;
      alert("Iniciando injeção... Por favor, não feche a janela até o aviso de Sucesso.");
      
      const response = await fetch('/feriados_brasil_completo.json');
      const data = await response.json();
      
      let batch = writeBatch(db);
      let count = 0;
      let total = 0;

      for (const city of data) {
        const ref = doc(db, 'municipios', city.ibge_id.toString());
        batch.set(ref, city);
        count++;
        total++;

        if (count >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
          console.log(`Lote gravado: ${total}/${data.length}`);
        }
      }
      
      if (count > 0) {
        await batch.commit();
      }

      alert(`Sucesso! ${total} municípios injetados no banco de dados.`);
    } catch (e) {
      console.error(e);
      alert("Erro ao injetar feriados: " + e.message);
    }
  };

  return (
    <div className="view-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="welcome-banner" style={{ marginBottom: 0 }}>
        <Text as="h1" size="6" weight="bold">Configurações do Sistema</Text>
        <Text as="p" size="3" color="gray">Área administrativa para parametrização do SGT.</Text>
      </div>

      <Card size="4" style={{ flexGrow: 1 }}>
        <Tabs.Root defaultValue="users">
          <Tabs.List style={{ flexWrap: 'wrap' }}>
            <Tabs.Trigger value="users">Usuários</Tabs.Trigger>
            <Tabs.Trigger value="systems">Sistemas</Tabs.Trigger>
            <Tabs.Trigger value="components">Componentes (Tags)</Tabs.Trigger>
            <Tabs.Trigger value="ticketTypes">Tipos de Ticket</Tabs.Trigger>
            <Tabs.Trigger value="workflows">Workflows</Tabs.Trigger>
          </Tabs.List>

          <Box pt="4">
            {/* USERS TAB */}
            <Tabs.Content value="users">
              <Text as="h2" size="4" weight="bold" mb="4">Gestão de Usuários</Text>
              <Text color="gray" mb="4" as="p">Gerencie papéis e os nomes resumidos exibidos na listagem.</Text>
              
              {loadingUsers ? <Loader2 className="spinner-icon" /> : (
                <Table.Root variant="surface">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Nome / E-mail</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Nome Resumido</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Data de Ingresso</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell align="right">Ações / Papel (Role)</Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {users.map(u => (
                      <Table.Row key={u.id} align="center">
                        <Table.Cell>
                          <Flex direction="column">
                            <Text weight="bold">{u.displayName || 'Sem Nome'}</Text>
                            <Text size="1" color="gray">{u.email}</Text>
                          </Flex>
                        </Table.Cell>
                        <Table.Cell>{u.shortName || '-'}</Table.Cell>
                        <Table.Cell>
                          {u.createdAt ? new Date(u.createdAt.toDate()).toLocaleDateString() : 'N/A'}
                        </Table.Cell>
                        <Table.Cell justify="end">
                          <Flex align="center" gap="2" justify="end">
                            <IconButton size="1" variant="soft" onClick={() => openEditUserModal(u)}>
                              <Edit2 size={14} />
                            </IconButton>
                            <Select.Root value={u.role} onValueChange={(val) => handleRoleChange(u.id, val)}>
                              <Select.Trigger />
                              <Select.Content>
                                <Select.Item value="user">Membro (User)</Select.Item>
                                <Select.Item value="admin">Admin</Select.Item>
                              </Select.Content>
                            </Select.Root>
                          </Flex>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              )}
            </Tabs.Content>

            {/* SYSTEMS TAB */}
            <Tabs.Content value="systems">
              <Flex justify="between" align="center" mb="4">
                <Text as="h2" size="4" weight="bold">Sistemas</Text>
                <Button size="2" onClick={openNewSystemModal}>Novo Sistema</Button>
              </Flex>
              {loadingSystems ? <Loader2 className="spinner-icon" /> : (
                <Table.Root variant="surface">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Nome</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell align="right">Ações</Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {systems.map(sys => (
                      <Table.Row key={sys.id} align="center">
                        <Table.Cell><Text weight="bold">{sys.name}</Text></Table.Cell>
                        <Table.Cell justify="end">
                          <Flex gap="2" justify="end">
                            <Button size="1" variant="soft" onClick={() => openEditSystemModal(sys)}>
                              <Edit2 size={14} /> Editar
                            </Button>
                            <Button size="1" color="red" variant="soft" onClick={() => handleDeleteSystem(sys.id)}>
                              <Trash2 size={14} /> Excluir
                            </Button>
                          </Flex>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              )}
            </Tabs.Content>

            {/* COMPONENTS TAB */}
            <Tabs.Content value="components">
              <Flex justify="between" align="center" mb="4">
                <Text as="h2" size="4" weight="bold">Componentes (Tags)</Text>
                <Button size="2" onClick={openNewComponentModal}>Novo Componente</Button>
              </Flex>
              {loadingComponents ? <Loader2 className="spinner-icon" /> : (
                <Table.Root variant="surface">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Nome</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell align="right">Ações</Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {components.map(comp => (
                      <Table.Row key={comp.id} align="center">
                        <Table.Cell><Text weight="bold">{comp.name}</Text></Table.Cell>
                        <Table.Cell justify="end">
                          <Flex gap="2" justify="end">
                            <Button size="1" variant="soft" onClick={() => openEditComponentModal(comp)}>
                              <Edit2 size={14} /> Editar
                            </Button>
                            <Button size="1" color="red" variant="soft" onClick={() => handleDeleteComponent(comp.id)}>
                              <Trash2 size={14} /> Excluir
                            </Button>
                          </Flex>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              )}
            </Tabs.Content>

            {/* TICKET TYPES TAB */}
            <Tabs.Content value="ticketTypes">
              <Flex justify="between" align="center" mb="4">
                <Text as="h2" size="4" weight="bold">Tipos de Ticket</Text>
                <Button size="2" onClick={openNewTypeModal}>Novo Tipo</Button>
              </Flex>
              
              {loadingTypes ? <Loader2 className="spinner-icon" /> : (
                <Table.Root variant="surface">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Nome</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Cor</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell align="right">Ações</Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {ticketTypes.map(type => (
                      <Table.Row key={type.id} align="center">
                        <Table.Cell><Text weight="bold">{type.name}</Text></Table.Cell>
                        <Table.Cell><Badge color={type.color}>{type.color}</Badge></Table.Cell>
                        <Table.Cell justify="end">
                          <Flex gap="2" justify="end">
                            <Button size="1" variant="soft" onClick={() => openEditTypeModal(type)}>
                              <Edit2 size={14} /> Editar
                            </Button>
                            <Button size="1" color="red" variant="soft" onClick={() => handleDeleteType(type.id)}>
                              <Trash2 size={14} /> Excluir
                            </Button>
                          </Flex>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              )}
            </Tabs.Content>

            {/* WORKFLOWS TAB */}
            <Tabs.Content value="workflows">
              <Flex justify="between" align="center" mb="4">
                <Text as="h2" size="4" weight="bold">Workflows de Projetos</Text>
                <Dialog.Root open={isNewWorkflowModalOpen} onOpenChange={setIsNewWorkflowModalOpen}>
                  <Dialog.Trigger>
                    <Button size="2">Novo Workflow</Button>
                  </Dialog.Trigger>
                  <Dialog.Content maxWidth="400px">
                    <Dialog.Title>Criar Novo Workflow</Dialog.Title>
                    <form onSubmit={handleSaveWorkflow}>
                      <Flex direction="column" gap="3">
                        <label>
                          <Text as="div" size="2" mb="1" weight="bold">Nome do Workflow</Text>
                          <TextField.Root 
                            value={newWorkflowData.name} 
                            onChange={(e) => setNewWorkflowData({...newWorkflowData, name: e.target.value})} 
                            required 
                          />
                        </label>
                        <label>
                          <Text as="div" size="2" mb="1" weight="bold">Colunas (separadas por vírgula)</Text>
                          <TextField.Root 
                            value={newWorkflowData.columnsStr} 
                            onChange={(e) => setNewWorkflowData({...newWorkflowData, columnsStr: e.target.value})} 
                            required
                          />
                        </label>
                      </Flex>
                      <Flex gap="3" mt="4" justify="end">
                        <Dialog.Close>
                          <Button variant="soft" color="gray" type="button">Cancelar</Button>
                        </Dialog.Close>
                        <Button type="submit" disabled={savingWorkflow}>
                          {savingWorkflow ? <Loader2 size={14} className="spinner-icon"/> : "Salvar"}
                        </Button>
                      </Flex>
                    </form>
                  </Dialog.Content>
                </Dialog.Root>
              </Flex>
              
              {loadingWorkflows ? <Loader2 className="spinner-icon" /> : (
                <Table.Root variant="surface">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Nome do Workflow</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Colunas</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell align="right">Ações</Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {workflows.map(flow => (
                      <Table.Row key={flow.id} align="center">
                        <Table.Cell><Text weight="bold">{flow.name}</Text></Table.Cell>
                        <Table.Cell>
                          <Flex gap="1" wrap="wrap">
                            {flow.columns && flow.columns.map(c => (
                              <Badge key={c.id} color="blue">{c.title}</Badge>
                            ))}
                          </Flex>
                        </Table.Cell>
                        <Table.Cell justify="end">
                          <Flex gap="2" justify="end">
                            <Button size="1" color="indigo" variant="soft" onClick={() => setSelectedWorkflowForStages(flow)}>
                              <Settings2 size={14} /> Editar Etapas
                            </Button>
                            <Button size="1" color="red" variant="soft" onClick={() => handleDeleteWorkflow(flow.id)}>
                              <Trash2 size={14} /> Excluir
                            </Button>
                          </Flex>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              )}
            </Tabs.Content>
          </Box>
        </Tabs.Root>
      </Card>
      
      {/* MODALS */}
      {/* Edit User Modal */}
      <Dialog.Root open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
        <Dialog.Content maxWidth="400px">
          <Dialog.Title>Editar Usuário</Dialog.Title>
          <form onSubmit={handleSaveUser}>
            <Flex direction="column" gap="3">
              <label>
                <Text as="div" size="2" mb="1" weight="bold">Nome Resumido</Text>
                <TextField.Root 
                  value={editingUserData.shortName} 
                  onChange={(e) => setEditingUserData({...editingUserData, shortName: e.target.value})} 
                  placeholder="Ex: João S." 
                />
              </label>
            </Flex>
            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray" type="button">Cancelar</Button>
              </Dialog.Close>
              <Button type="submit" disabled={savingUser}>
                {savingUser ? <Loader2 size={14} className="spinner-icon"/> : "Salvar"}
              </Button>
            </Flex>
          </form>
        </Dialog.Content>
      </Dialog.Root>

      {/* Edit/New Type Modal */}
      <Dialog.Root open={isTypeModalOpen} onOpenChange={setIsTypeModalOpen}>
        <Dialog.Content maxWidth="400px">
          <Dialog.Title>{typeData.id ? 'Editar Tipo' : 'Criar Novo Tipo'}</Dialog.Title>
          <form onSubmit={handleSaveType}>
            <Flex direction="column" gap="3">
              <label>
                <Text as="div" size="2" mb="1" weight="bold">Nome</Text>
                <TextField.Root 
                  value={typeData.name} 
                  onChange={(e) => setTypeData({...typeData, name: e.target.value})} 
                  required 
                />
              </label>
              <label>
                <Text as="div" size="2" mb="1" weight="bold">Cor</Text>
                <Select.Root value={typeData.color} onValueChange={(val) => setTypeData({...typeData, color: val})}>
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Item value="red">Vermelho</Select.Item>
                    <Select.Item value="blue">Azul</Select.Item>
                    <Select.Item value="green">Verde</Select.Item>
                    <Select.Item value="orange">Laranja</Select.Item>
                    <Select.Item value="purple">Roxo</Select.Item>
                  </Select.Content>
                </Select.Root>
              </label>
            </Flex>
            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray" type="button">Cancelar</Button>
              </Dialog.Close>
              <Button type="submit" disabled={savingType}>
                {savingType ? <Loader2 size={14} className="spinner-icon"/> : "Salvar"}
              </Button>
            </Flex>
          </form>
        </Dialog.Content>
      </Dialog.Root>

      {/* Edit/New System Modal */}
      <Dialog.Root open={isSystemModalOpen} onOpenChange={setIsSystemModalOpen}>
        <Dialog.Content maxWidth="400px">
          <Dialog.Title>{systemData.id ? 'Editar Sistema' : 'Criar Novo Sistema'}</Dialog.Title>
          <form onSubmit={handleSaveSystem}>
            <Flex direction="column" gap="3">
              <label>
                <Text as="div" size="2" mb="1" weight="bold">Nome</Text>
                <TextField.Root 
                  value={systemData.name} 
                  onChange={(e) => setSystemData({...systemData, name: e.target.value})} 
                  placeholder="Ex: Totem, PP"
                  required 
                />
              </label>
            </Flex>
            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray" type="button">Cancelar</Button>
              </Dialog.Close>
              <Button type="submit" disabled={savingSystem}>
                {savingSystem ? <Loader2 size={14} className="spinner-icon"/> : "Salvar"}
              </Button>
            </Flex>
          </form>
        </Dialog.Content>
      </Dialog.Root>

      {/* Edit/New Component Modal */}
      <Dialog.Root open={isComponentModalOpen} onOpenChange={setIsComponentModalOpen}>
        <Dialog.Content maxWidth="400px">
          <Dialog.Title>{componentData.id ? 'Editar Componente' : 'Criar Novo Componente'}</Dialog.Title>
          <form onSubmit={handleSaveComponent}>
            <Flex direction="column" gap="3">
              <label>
                <Text as="div" size="2" mb="1" weight="bold">Nome</Text>
                <TextField.Root 
                  value={componentData.name} 
                  onChange={(e) => setComponentData({...componentData, name: e.target.value})} 
                  placeholder="Ex: API, Frontend"
                  required 
                />
              </label>
            </Flex>
            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray" type="button">Cancelar</Button>
              </Dialog.Close>
              <Button type="submit" disabled={savingComponent}>
                {savingComponent ? <Loader2 size={14} className="spinner-icon"/> : "Salvar"}
              </Button>
            </Flex>
          </form>
        </Dialog.Content>
      </Dialog.Root>

      <Card size="4">
        <Text as="h2" size="4" weight="bold" mb="2">Manutenção do Sistema (Avançado)</Text>
        <Text color="gray" mb="4" as="p">Utilize esta área apenas com orientação técnica.</Text>
        <Button color="orange" variant="soft" onClick={handleInjectHolidays}>
          <Database size={16} /> Injetar Feriados no Banco (JSON)
        </Button>
      </Card>

      <WorkflowStagesModal 
        isOpen={!!selectedWorkflowForStages} 
        onClose={() => setSelectedWorkflowForStages(null)} 
        workflow={selectedWorkflowForStages} 
      />
    </div>
  );
};

export default Settings;
