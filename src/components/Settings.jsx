import React, { useState, useEffect } from 'react';
import { Tabs, Box, Text, Card, Flex, Button, Table, Badge, Dialog, TextField, Select, IconButton, TextArea } from '@radix-ui/themes';
import { 
  subscribeToTicketTypes, saveTicketType, deleteTicketType, 
  subscribeToWorkflows, saveWorkflow, deleteWorkflow, 
  subscribeToUsers, updateUserRole, updateUser, createUser, deleteUser,
  subscribeToSystems, saveSystem, deleteSystem,
  subscribeToComponents, saveComponent, deleteComponent,
  subscribeToCustomFields, saveCustomField, deleteCustomField,
  subscribeToAutomations, saveAutomation, deleteAutomation,
  subscribeToAISettings, saveAISettings
} from '../services/settingsService';
import { Loader2, Trash2, Settings2, Database, Edit2, Zap, Shield, Key } from 'lucide-react';
import { Users, LayoutGrid, CheckSquare, Layers, Plus, Briefcase, Bot, Brain } from 'lucide-react';
import WorkflowStagesModal from './WorkflowStagesModal';
import ImportUsersCSV from './ImportUsersCSV';
import { db, auth, createAuthUser } from '../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { writeBatch, doc } from 'firebase/firestore';
import { subscribeToProjects, updateProjectMembers } from '../services/projectService';

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

  const [customFields, setCustomFields] = useState([]);
  const [loadingCustomFields, setLoadingCustomFields] = useState(true);

  const [automations, setAutomations] = useState([]);
  const [loadingAutomations, setLoadingAutomations] = useState(true);

  const [projects, setProjects] = useState([]);
  const [selectedRbacProject, setSelectedRbacProject] = useState('');
  const [rbacMembers, setRbacMembers] = useState({});
  const [savingRbac, setSavingRbac] = useState(false);

  // Config Board Selector (Demandas vs Atividades)
  const [configBoard, setConfigBoard] = useState('demandas');

  // Active Tab State (Responsive Menu)
  const [activeTab, setActiveTab] = useState('users');

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
  const [editingUserData, setEditingUserData] = useState({ id: '', shortName: '', displayName: '', email: '', role: 'user' });
  const [savingUser, setSavingUser] = useState(false);

  // Custom Field Modal State
  const [isCustomFieldModalOpen, setIsCustomFieldModalOpen] = useState(false);
  const [customFieldData, setCustomFieldData] = useState({ name: '', type: 'text', options: '', ticketTypeId: 'all' });
  const [savingCustomField, setSavingCustomField] = useState(false);

  // Automation Modal State
  const [isAutomationModalOpen, setIsAutomationModalOpen] = useState(false);
  const [automationData, setAutomationData] = useState({ name: '', trigger: 'on_create', action: 'send_webhook', target: '' });
  const [savingAutomation, setSavingAutomation] = useState(false);

  // AI Settings State
  const [aiSettings, setAiSettings] = useState({ geminiApiKey: '', efInitialPrompt: '' });
  const [loadingAi, setLoadingAi] = useState(true);
  const [savingAi, setSavingAi] = useState(false);

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
    const unsubscribeCustomFields = subscribeToCustomFields((data) => {
      setCustomFields(data);
      setLoadingCustomFields(false);
    });
    const unsubscribeAutomations = subscribeToAutomations((data) => {
      setAutomations(data);
      setLoadingAutomations(false);
    });
    const unsubscribeProjects = subscribeToProjects((data) => {
      setProjects(data);
    });
    const unsubscribeAI = subscribeToAISettings((data) => {
      if (data) setAiSettings(data);
      setLoadingAi(false);
    });
    return () => {
      unsubscribeTypes();
      unsubscribeWorkflows();
      unsubscribeUsers();
      unsubscribeSystems();
      unsubscribeComponents();
      unsubscribeCustomFields();
      unsubscribeAutomations();
      unsubscribeProjects();
      unsubscribeAI();
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
      await saveTicketType({ ...typeData, board: configBoard });
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
      await saveWorkflow({ name: newWorkflowData.name, columns: colsArray, board: configBoard });
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

  const openNewUserModal = () => {
    setEditingUserData({ id: '', shortName: '', displayName: '', email: '', role: 'user' });
    setIsUserModalOpen(true);
  };

  const openEditUserModal = (user) => {
    setEditingUserData({ id: user.id, shortName: user.shortName || '', displayName: user.displayName || '', email: user.email || '', role: user.role || 'user' });
    setIsUserModalOpen(true);
  };

  const handleDeleteUser = async (userId) => {
    if (confirm("Deseja realmente excluir este usuário? (Isso não apaga do Firebase Auth)")) {
      await deleteUser(userId);
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setSavingUser(true);
    try {
      if (editingUserData.id) {
        await updateUser(editingUserData.id, { 
          shortName: editingUserData.shortName,
          displayName: editingUserData.displayName,
          email: editingUserData.email,
          role: editingUserData.role
        });
      } else {
        // Criar no Auth primeiro (sem enviar email)
        const tempPassword = Math.random().toString(36).slice(-8) + "Aa1@";
        const newUid = await createAuthUser(editingUserData.email, tempPassword, false);

        await createUser({
          id: newUid,
          shortName: editingUserData.shortName,
          displayName: editingUserData.displayName,
          email: editingUserData.email,
          role: editingUserData.role,
          tempPassword: tempPassword
        });
      }
      setIsUserModalOpen(false);
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar usuário. Verifique o console.");
    } finally {
      setSavingUser(false);
    }
  };

  const handlePasswordReset = async (email) => {
    if (!email) return;
    if (confirm(`Deseja enviar um e-mail de redefinição de senha para ${email}?`)) {
      try {
        await sendPasswordResetEmail(auth, email);
        alert(`E-mail de redefinição enviado com sucesso para ${email}!`);
      } catch (error) {
        alert("Erro ao enviar e-mail: " + error.message);
      }
    }
  };

  const openNewSystemModal = () => {
    setSystemData({ name: '', projectId: '' });
    setIsSystemModalOpen(true);
  };

  const openEditSystemModal = (sys) => {
    setSystemData(sys);
    setIsSystemModalOpen(true);
  };

  const handleSaveSystem = async (e) => {
    e.preventDefault();
    if (!systemData.name.trim()) return;
    if (!systemData.projectId) {
      alert("Por favor, selecione um Projeto para associar.");
      return;
    }
    setSavingSystem(true);
    try {
      if (systemData.id) {
        await saveSystem(systemData);
      } else {
        const names = systemData.name.split('\n').map(n => n.trim()).filter(n => n);
        for (const name of names) {
          await saveSystem({ name, projectId: systemData.projectId });
        }
      }
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

  const openNewCustomFieldModal = () => {
    setCustomFieldData({ name: '', type: 'text', options: '', ticketTypeId: 'all' });
    setIsCustomFieldModalOpen(true);
  };

  const openEditCustomFieldModal = (field) => {
    setCustomFieldData(field);
    setIsCustomFieldModalOpen(true);
  };

  const handleSaveCustomField = async (e) => {
    e.preventDefault();
    if (!customFieldData.name.trim()) return;
    setSavingCustomField(true);
    try {
      await saveCustomField(customFieldData);
      setIsCustomFieldModalOpen(false);
    } catch (err) {
      alert("Erro ao salvar campo customizado.");
    } finally {
      setSavingCustomField(false);
    }
  };

  const handleDeleteCustomField = async (id) => {
    if (confirm("Deseja realmente excluir este campo customizado?")) await deleteCustomField(id);
  };

  const openNewAutomationModal = () => {
    setAutomationData({ name: '', trigger: 'on_create', action: 'send_webhook', target: '' });
    setIsAutomationModalOpen(true);
  };

  const handleSaveAutomation = async (e) => {
    e.preventDefault();
    setSavingAutomation(true);
    try {
      await saveAutomation(automationData);
      setIsAutomationModalOpen(false);
    } catch (err) {
      alert("Erro ao salvar automação.");
    } finally {
      setSavingAutomation(false);
    }
  };

  const handleDeleteAutomation = async (id) => {
    if (confirm("Deseja realmente excluir esta automação?")) await deleteAutomation(id);
  };

  const handleProjectSelectForRbac = (projectId) => {
    setSelectedRbacProject(projectId);
    const proj = projects.find(p => p.id === projectId);
    if (proj && proj.members) {
      setRbacMembers(proj.members);
    } else {
      setRbacMembers({});
    }
  };

  const handleSaveRbac = async () => {
    if (!selectedRbacProject) return;
    setSavingRbac(true);
    try {
      await updateProjectMembers(selectedRbacProject, rbacMembers);
      alert("Acessos salvos com sucesso!");
    } catch (err) {
      alert("Erro ao salvar acessos.");
    } finally {
      setSavingRbac(false);
    }
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
  const handleSaveAI = async () => {
    setSavingAi(true);
    try {
      await saveAISettings(aiSettings);
      alert("Configurações de IA salvas com sucesso!");
    } catch (err) {
      alert("Erro ao salvar configurações de IA.");
    } finally {
      setSavingAi(false);
    }
  };

  return (
    <div className="view-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="welcome-banner" style={{ marginBottom: 0 }}>
        <Flex justify="between" align="center" wrap="wrap" gap="4">
          <Box>
            <Text as="h1" size="6" weight="bold">Configurações do Sistema</Text>
            <Text as="p" size="3" color="gray">Área administrativa para parametrização do SGT.</Text>
          </Box>
          <Box>
            <Flex gap="2" style={{ background: 'var(--gray-3)', padding: '4px', borderRadius: 'var(--border-radius)' }}>
              <Button 
                variant={configBoard === 'demandas' ? 'solid' : 'ghost'} 
                onClick={() => setConfigBoard('demandas')}
                style={{ cursor: 'pointer' }}
              >
                Quadro: Demandas
              </Button>
              <Button 
                variant={configBoard === 'atividades' ? 'solid' : 'ghost'} 
                onClick={() => setConfigBoard('atividades')}
                style={{ cursor: 'pointer' }}
              >
                Quadro de desenvolvimento
              </Button>
            </Flex>
          </Box>
        </Flex>
      </div>

      <Card size="4" style={{ flexGrow: 1 }}>
        <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
          
          {/* Desktop Classic Tabs */}
          <Box className="hide-on-mobile">
            <Tabs.List style={{ flexWrap: 'wrap' }}>
              <Tabs.Trigger value="users">Usuários</Tabs.Trigger>
              <Tabs.Trigger value="systems">Sistemas</Tabs.Trigger>
              <Tabs.Trigger value="components">Componentes (Tags)</Tabs.Trigger>
              <Tabs.Trigger value="ticketTypes">Tipos de Ticket</Tabs.Trigger>
              <Tabs.Trigger value="customFields">Campos Custom</Tabs.Trigger>
              <Tabs.Trigger value="workflows">Workflows</Tabs.Trigger>
              <Tabs.Trigger value="automations">Automações</Tabs.Trigger>
              <Tabs.Trigger value="ai"><Zap size={14} style={{ display: 'inline', marginRight: 4 }}/> IA (Gemini)</Tabs.Trigger>
              <Tabs.Trigger value="rbac"><Shield size={14} style={{ display: 'inline', marginRight: 4 }}/> RBAC</Tabs.Trigger>
            </Tabs.List>
          </Box>

          {/* Mobile Modern Dropdown Menu */}
          <Box className="show-on-mobile-block" mb="4">
            <Text as="div" size="2" weight="bold" mb="2">Selecione a Configuração</Text>
            <Select.Root value={activeTab} onValueChange={setActiveTab}>
              <Select.Trigger style={{ width: '100%', height: '40px' }} />
              <Select.Content>
                <Select.Item value="users">Usuários</Select.Item>
                <Select.Item value="systems">Sistemas</Select.Item>
                <Select.Item value="components">Componentes (Tags)</Select.Item>
                <Select.Item value="ticketTypes">Tipos de Ticket</Select.Item>
                <Select.Item value="customFields">Campos Custom</Select.Item>
                <Select.Item value="workflows">Workflows</Select.Item>
                <Select.Item value="automations">Automações</Select.Item>
                <Select.Item value="ai">IA (Gemini)</Select.Item>
                <Select.Item value="rbac">RBAC (Acessos)</Select.Item>
              </Select.Content>
            </Select.Root>
          </Box>

          <Box pt="4">
            {/* USERS TAB */}
            <Tabs.Content value="users">
              <Flex justify="between" align="center" mb="4">
                <Box>
                  <Text as="h2" size="4" weight="bold">Gestão de Usuários</Text>
                  <Text color="gray" as="p">Gerencie os usuários, papéis e os nomes exibidos.</Text>
                </Box>
                <Button size="3" onClick={() => setIsUserModalOpen(true)}>
                  <Plus size={18} />
                  Novo Usuário
                </Button>
              </Flex>
              <ImportUsersCSV />
              {loadingUsers ? <Loader2 className="spinner-icon" /> : (
                <Table.Root variant="surface">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Nome / E-mail</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Nome Resumido</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Senha Provisória</Table.ColumnHeaderCell>
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
                          {u.tempPassword ? <Text color="ruby" weight="bold">{u.tempPassword}</Text> : <Text color="gray">-</Text>}
                        </Table.Cell>
                        <Table.Cell>
                          {u.createdAt ? new Date(u.createdAt.toDate()).toLocaleDateString() : 'N/A'}
                        </Table.Cell>
                        <Table.Cell justify="end">
                          <Flex align="center" gap="2" justify="end">
                            <IconButton size="1" color="indigo" variant="soft" onClick={() => handlePasswordReset(u.email)} title="Enviar Reset de Senha">
                              <Key size={14} />
                            </IconButton>
                            <IconButton size="1" variant="soft" onClick={() => openEditUserModal(u)} title="Editar Usuário">
                              <Edit2 size={14} />
                            </IconButton>
                            <IconButton size="1" color="red" variant="soft" onClick={() => handleDeleteUser(u.id)}>
                              <Trash2 size={14} />
                            </IconButton>
                            <Select.Root value={u.role} onValueChange={(val) => handleRoleChange(u.id, val)}>
                              <Select.Trigger />
                              <Select.Content>
                                <Select.Item value="user">Membro (User)</Select.Item>
                                <Select.Item value="squad_leader">Líder de Squad</Select.Item>
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
                      <Table.ColumnHeaderCell>Projeto</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell align="right">Ações</Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {systems.map(sys => {
                      const proj = projects.find(p => p.id === sys.projectId);
                      return (
                      <Table.Row key={sys.id} align="center">
                        <Table.Cell><Text weight="bold">{sys.name}</Text></Table.Cell>
                        <Table.Cell>{proj ? proj.name : '-'}</Table.Cell>
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
                      );
                    })}
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
                    {ticketTypes
                      .filter(t => (t.board || 'demandas') === configBoard)
                      .map(type => (
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

            {/* CUSTOM FIELDS TAB */}
            <Tabs.Content value="customFields">
              <Flex justify="between" align="center" mb="4">
                <Text as="h2" size="4" weight="bold">Campos Customizados</Text>
                <Button size="2" onClick={openNewCustomFieldModal}>Novo Campo</Button>
              </Flex>
              
              {loadingCustomFields ? <Loader2 className="spinner-icon" /> : (
                <Table.Root variant="surface">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Nome</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Tipo</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Vínculo (Tipo de Ticket)</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell align="right">Ações</Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {customFields.map(field => {
                      const typeName = field.ticketTypeId === 'all' 
                        ? 'Todos' 
                        : ticketTypes.find(t => t.id === field.ticketTypeId)?.name || 'Desconhecido';
                      
                      return (
                        <Table.Row key={field.id} align="center">
                          <Table.Cell><Text weight="bold">{field.name}</Text></Table.Cell>
                          <Table.Cell><Badge color="gray">{field.type}</Badge></Table.Cell>
                          <Table.Cell><Badge color={field.ticketTypeId === 'all' ? 'green' : 'blue'}>{typeName}</Badge></Table.Cell>
                          <Table.Cell justify="end">
                            <Flex gap="2" justify="end">
                              <Button size="1" variant="soft" onClick={() => openEditCustomFieldModal(field)}>
                                <Edit2 size={14} /> Editar
                              </Button>
                              <Button size="1" color="red" variant="soft" onClick={() => handleDeleteCustomField(field.id)}>
                                <Trash2 size={14} /> Excluir
                              </Button>
                            </Flex>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
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
                  <Dialog.Content maxWidth="400px" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
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
                    {workflows
                      .filter(w => (w.board || 'demandas') === configBoard)
                      .map(flow => (
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

            {/* AUTOMATIONS TAB */}
            <Tabs.Content value="automations">
              <Flex justify="between" align="center" mb="4">
                <Box>
                  <Text as="h2" size="4" weight="bold">Automações e Webhooks</Text>
                  <Text color="gray" size="2">Configure regras de negócio automatizadas.</Text>
                </Box>
                <Button size="2" onClick={openNewAutomationModal}>Nova Automação</Button>
              </Flex>
              
              {loadingAutomations ? <Loader2 className="spinner-icon" /> : (
                <Table.Root variant="surface">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Nome</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Gatilho</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Ação</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell align="right">Ações</Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {automations.map(auto => (
                      <Table.Row key={auto.id} align="center">
                        <Table.Cell><Text weight="bold">{auto.name}</Text></Table.Cell>
                        <Table.Cell><Badge color="indigo">{auto.trigger}</Badge></Table.Cell>
                        <Table.Cell><Badge color="orange">{auto.action}</Badge> <Text size="1" color="gray">{auto.target}</Text></Table.Cell>
                        <Table.Cell justify="end">
                          <Flex gap="2" justify="end">
                            <Button size="1" color="red" variant="soft" onClick={() => handleDeleteAutomation(auto.id)}>
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

            {/* AI TAB */}
            <Tabs.Content value="ai">
              <Flex justify="between" align="center" mb="4">
                <Box>
                  <Text as="h2" size="4" weight="bold">Inteligência Artificial (Gemini)</Text>
                  <Text color="gray" size="2">Configure a API Key e os Prompts Padrão para geração de Especificações Funcionais.</Text>
                </Box>
                <Button onClick={handleSaveAI} disabled={savingAi}>
                  {savingAi ? <Loader2 size={16} className="spinner-icon"/> : "Salvar Integração"}
                </Button>
              </Flex>

              {loadingAi ? (
                <Flex justify="center" p="6"><Loader2 className="spinner-icon" size={24} color="var(--primary)"/></Flex>
              ) : (
                <Flex direction="column" gap="4" style={{ maxWidth: '800px' }}>
                  <label>
                    <Text as="div" size="2" mb="1" weight="bold">Google Gemini API Key</Text>
                    <TextField.Root 
                      type="password"
                      placeholder="AIzaSy..."
                      value={aiSettings.geminiApiKey || ''}
                      onChange={(e) => setAiSettings({...aiSettings, geminiApiKey: e.target.value})}
                    >
                      <TextField.Slot><Key size={14} /></TextField.Slot>
                    </TextField.Root>
                    <Text size="1" color="gray">Sua chave é salva no banco de dados e enviada ao navegador do usuário no momento de gerar a especificação.</Text>
                  </label>

                  <label>
                    <Text as="div" size="2" mb="1" weight="bold">Prompt Inicial Padrão (Especificação Funcional)</Text>
                    <textarea 
                      style={{ width: '100%', minHeight: '200px', padding: '8px', borderRadius: '4px', border: '1px solid var(--gray-6)' }}
                      placeholder="Instruções para a IA..."
                      value={aiSettings.efInitialPrompt || ''}
                      onChange={(e) => setAiSettings({...aiSettings, efInitialPrompt: e.target.value})}
                    />
                    <Text size="1" color="gray">Este prompt orientará a IA na geração do documento. Peça para a IA incluir um Sumário com links em markdown (ex: [Tópico](#topico)) e separar a página de sumário.</Text>
                  </label>

                  <label>
                    <Text as="div" size="2" mb="1" weight="bold">Prompt Inicial Padrão (Especificação Técnica)</Text>
                    <textarea 
                      style={{ width: '100%', minHeight: '200px', padding: '8px', borderRadius: '4px', border: '1px solid var(--gray-6)' }}
                      placeholder="Instruções para a IA para Especificação Técnica..."
                      value={aiSettings.etInitialPrompt || ''}
                      onChange={(e) => setAiSettings({...aiSettings, etInitialPrompt: e.target.value})}
                    />
                    <Text size="1" color="gray">Este prompt orientará a IA na geração do documento técnico. Peça para a IA incluir um Sumário com links em markdown (ex: [Tópico](#topico)) e separar a página de sumário.</Text>
                  </label>

                </Flex>
              )}
            </Tabs.Content>

            {/* RBAC TAB */}
            <Tabs.Content value="rbac">
              <Text as="h2" size="4" weight="bold" mb="2">Controle de Acesso por Projeto (RBAC)</Text>
              <Text color="gray" size="2" mb="4" as="p">Defina quem pode acessar, editar ou administrar os tickets de cada projeto.</Text>
              
              <Flex gap="4" align="end" mb="4">
                <label style={{ flexGrow: 1, maxWidth: '400px' }}>
                  <Text as="div" size="2" mb="1" weight="bold">Selecione o Projeto</Text>
                  <Select.Root value={selectedRbacProject} onValueChange={handleProjectSelectForRbac}>
                    <Select.Trigger style={{ width: '100%' }} placeholder="Escolha um projeto..." />
                    <Select.Content>
                      {projects.map(p => (
                        <Select.Item key={p.id} value={p.id}>{p.name}</Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </label>
                <Button disabled={!selectedRbacProject || savingRbac} onClick={handleSaveRbac}>
                  {savingRbac ? <Loader2 size={16} className="spinner-icon" /> : 'Salvar Acessos'}
                </Button>
              </Flex>

              {selectedRbacProject ? (
                <Table.Root variant="surface">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Usuário</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>E-mail</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell align="right">Papel no Projeto</Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {users.map(u => {
                      const currentRole = rbacMembers[u.id] || 'none';
                      return (
                        <Table.Row key={u.id} align="center">
                          <Table.Cell><Text weight="bold">{u.displayName}</Text></Table.Cell>
                          <Table.Cell><Text color="gray">{u.email}</Text></Table.Cell>
                          <Table.Cell justify="end">
                            <Select.Root 
                              value={currentRole} 
                              onValueChange={(val) => setRbacMembers(prev => ({ ...prev, [u.id]: val }))}
                            >
                              <Select.Trigger />
                              <Select.Content>
                                <Select.Item value="none">Sem Acesso</Select.Item>
                                <Select.Item value="viewer">Visualizador</Select.Item>
                                <Select.Item value="developer">Desenvolvedor (Edita)</Select.Item>
                                <Select.Item value="admin">Administrador (Tudo)</Select.Item>
                              </Select.Content>
                            </Select.Root>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table.Root>
              ) : (
                <Card size="2" style={{ textAlign: 'center', padding: '40px' }}>
                  <Shield size={32} color="var(--gray-8)" style={{ margin: '0 auto 16px' }} />
                  <Text color="gray">Selecione um projeto acima para gerenciar os acessos.</Text>
                </Card>
              )}
            </Tabs.Content>
          </Box>
        </Tabs.Root>
      </Card>
      
      {/* MODALS */}
      {/* Edit User Modal */}
      <Dialog.Root open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
        <Dialog.Content maxWidth="400px" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <Dialog.Title>Editar Usuário</Dialog.Title>
          <form onSubmit={handleSaveUser}>
            <Flex direction="column" gap="3">
              <label>
                <Text as="div" size="2" mb="1" weight="bold">Nome Completo</Text>
                <TextField.Root 
                  required
                  value={editingUserData.displayName} 
                  onChange={(e) => setEditingUserData({...editingUserData, displayName: e.target.value})} 
                  placeholder="Ex: João Silva" 
                />
              </label>
              <label>
                <Text as="div" size="2" mb="1" weight="bold">E-mail</Text>
                <TextField.Root 
                  required
                  type="email"
                  value={editingUserData.email} 
                  onChange={(e) => setEditingUserData({...editingUserData, email: e.target.value})} 
                  placeholder="Ex: joao@empresa.com" 
                />
              </label>
              <label>
                <Text as="div" size="2" mb="1" weight="bold">Nome Resumido (Opcional)</Text>
                <TextField.Root 
                  value={editingUserData.shortName} 
                  onChange={(e) => setEditingUserData({...editingUserData, shortName: e.target.value})} 
                  placeholder="Ex: João S." 
                />
              </label>
              {!editingUserData.id && (
                <label>
                  <Text as="div" size="2" mb="1" weight="bold">Perfil</Text>
                  <Select.Root value={editingUserData.role} onValueChange={(val) => setEditingUserData({...editingUserData, role: val})}>
                    <Select.Trigger style={{ width: '100%' }} />
                    <Select.Content>
                      <Select.Item value="user">Membro (User)</Select.Item>
                      <Select.Item value="squad_leader">Líder de Squad</Select.Item>
                      <Select.Item value="admin">Administrador</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </label>
              )}
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
        <Dialog.Content maxWidth="400px" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
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
        <Dialog.Content maxWidth="400px" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <Dialog.Title>{systemData.id ? 'Editar Sistema' : 'Criar Novo Sistema'}</Dialog.Title>
          <form onSubmit={handleSaveSystem}>
            <Flex direction="column" gap="3">
              <label>
                <Text as="div" size="2" mb="1" weight="bold">Projeto <span style={{ color: 'red' }}>*</span></Text>
                <Select.Root 
                  value={systemData.projectId || ''} 
                  onValueChange={(val) => setSystemData({...systemData, projectId: val})}
                >
                  <Select.Trigger placeholder="Selecione um projeto" />
                  <Select.Content>
                    {projects.map(p => (
                      <Select.Item key={p.id} value={p.id}>{p.name}</Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </label>
              <label>
                <Text as="div" size="2" mb="1" weight="bold">Nome <span style={{ color: 'red' }}>*</span></Text>
                {systemData.id ? (
                  <TextField.Root 
                    value={systemData.name} 
                    onChange={(e) => setSystemData({...systemData, name: e.target.value})} 
                    placeholder="Ex: Totem"
                    required 
                  />
                ) : (
                  <TextArea 
                    value={systemData.name} 
                    onChange={(e) => setSystemData({...systemData, name: e.target.value})} 
                    placeholder="Cole a lista de sistemas, um por linha..."
                    rows={6}
                    required 
                  />
                )}
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
        <Dialog.Content maxWidth="400px" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
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

      {/* Edit/New Custom Field Modal */}
      <Dialog.Root open={isCustomFieldModalOpen} onOpenChange={setIsCustomFieldModalOpen}>
        <Dialog.Content maxWidth="450px" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <Dialog.Title>{customFieldData.id ? 'Editar Campo Customizado' : 'Criar Campo Customizado'}</Dialog.Title>
          <form onSubmit={handleSaveCustomField}>
            <Flex direction="column" gap="3">
              <label>
                <Text as="div" size="2" mb="1" weight="bold">Nome do Campo</Text>
                <TextField.Root 
                  value={customFieldData.name} 
                  onChange={(e) => setCustomFieldData({...customFieldData, name: e.target.value})} 
                  placeholder="Ex: Versão Afetada, Link do Figma..."
                  required 
                />
              </label>
              
              <label>
                <Text as="div" size="2" mb="1" weight="bold">Tipo de Dado</Text>
                <Select.Root value={customFieldData.type} onValueChange={(val) => setCustomFieldData({...customFieldData, type: val})}>
                  <Select.Trigger style={{ width: '100%' }} />
                  <Select.Content>
                    <Select.Item value="text">Texto Simples</Select.Item>
                    <Select.Item value="textarea">Texto Longo</Select.Item>
                    <Select.Item value="number">Número</Select.Item>
                    <Select.Item value="date">Data</Select.Item>
                    <Select.Item value="select">Lista de Seleção (Dropdown)</Select.Item>
                  </Select.Content>
                </Select.Root>
              </label>

              {customFieldData.type === 'select' && (
                <label>
                  <Text as="div" size="2" mb="1" weight="bold">Opções da Lista (separadas por vírgula)</Text>
                  <TextField.Root 
                    value={customFieldData.options} 
                    onChange={(e) => setCustomFieldData({...customFieldData, options: e.target.value})} 
                    placeholder="Opção 1, Opção 2, Opção 3"
                    required 
                  />
                </label>
              )}

              <label>
                <Text as="div" size="2" mb="1" weight="bold">Exibir apenas para o Tipo de Ticket:</Text>
                <Select.Root value={customFieldData.ticketTypeId} onValueChange={(val) => setCustomFieldData({...customFieldData, ticketTypeId: val})}>
                  <Select.Trigger style={{ width: '100%' }} />
                  <Select.Content>
                    <Select.Item value="all">Exibir em Todos</Select.Item>
                    {ticketTypes.map(t => (
                      <Select.Item key={t.id} value={t.id}>{t.name}</Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </label>
            </Flex>
            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray" type="button">Cancelar</Button>
              </Dialog.Close>
              <Button type="submit" disabled={savingCustomField}>
                {savingCustomField ? <Loader2 size={14} className="spinner-icon"/> : "Salvar"}
              </Button>
            </Flex>
          </form>
        </Dialog.Content>
      </Dialog.Root>

      {/* New Automation Modal */}
      <Dialog.Root open={isAutomationModalOpen} onOpenChange={setIsAutomationModalOpen}>
        <Dialog.Content maxWidth="450px" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <Dialog.Title>Criar Automação</Dialog.Title>
          <form onSubmit={handleSaveAutomation}>
            <Flex direction="column" gap="3">
              <label>
                <Text as="div" size="2" mb="1" weight="bold">Nome da Regra</Text>
                <TextField.Root 
                  value={automationData.name} 
                  onChange={(e) => setAutomationData({...automationData, name: e.target.value})} 
                  placeholder="Ex: Notificar Slack ao criar bug"
                  required 
                />
              </label>
              
              <label>
                <Text as="div" size="2" mb="1" weight="bold">Gatilho (Quando...)</Text>
                <Select.Root value={automationData.trigger} onValueChange={(val) => setAutomationData({...automationData, trigger: val})}>
                  <Select.Trigger style={{ width: '100%' }} />
                  <Select.Content>
                    <Select.Item value="on_create">Ticket Criado</Select.Item>
                    <Select.Item value="on_status_change">Status Alterado</Select.Item>
                    <Select.Item value="on_comment">Novo Comentário</Select.Item>
                  </Select.Content>
                </Select.Root>
              </label>

              <label>
                <Text as="div" size="2" mb="1" weight="bold">Ação (Então...)</Text>
                <Select.Root value={automationData.action} onValueChange={(val) => setAutomationData({...automationData, action: val})}>
                  <Select.Trigger style={{ width: '100%' }} />
                  <Select.Content>
                    <Select.Item value="send_webhook">Disparar Webhook (POST)</Select.Item>
                    <Select.Item value="send_email">Enviar E-mail</Select.Item>
                  </Select.Content>
                </Select.Root>
              </label>

              <label>
                <Text as="div" size="2" mb="1" weight="bold">Alvo (URL ou Email)</Text>
                <TextField.Root 
                  value={automationData.target} 
                  onChange={(e) => setAutomationData({...automationData, target: e.target.value})} 
                  placeholder="https://hooks.slack.com/services/..."
                  required 
                />
              </label>
            </Flex>
            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray" type="button">Cancelar</Button>
              </Dialog.Close>
              <Button type="submit" disabled={savingAutomation}>
                {savingAutomation ? <Loader2 size={14} className="spinner-icon"/> : "Salvar Regra"}
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
