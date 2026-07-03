import React, { useState, useEffect } from 'react';
import { Tabs, Box, Text, Card, Flex, Button, Table, Badge, Dialog, TextField, Select, IconButton } from '@radix-ui/themes';
import { subscribeToTicketTypes, saveTicketType, deleteTicketType, subscribeToWorkflows, saveWorkflow, deleteWorkflow, subscribeToUsers, updateUserRole } from '../services/settingsService';
import { Loader2, Trash2, Settings2, Database } from 'lucide-react';
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

  // New Type Modal State
  const [isNewTypeModalOpen, setIsNewTypeModalOpen] = useState(false);
  const [newTypeData, setNewTypeData] = useState({ name: '', color: 'blue', icon: 'Bug' });
  const [savingType, setSavingType] = useState(false);

  // New Workflow Modal State
  const [isNewWorkflowModalOpen, setIsNewWorkflowModalOpen] = useState(false);
  const [newWorkflowData, setNewWorkflowData] = useState({ name: '', columnsStr: '' });
  const [savingWorkflow, setSavingWorkflow] = useState(false);
  
  const [selectedWorkflowForStages, setSelectedWorkflowForStages] = useState(null);

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
    return () => {
      unsubscribeTypes();
      unsubscribeWorkflows();
      unsubscribeUsers();
    };
  }, []);

  const handleSaveType = async (e) => {
    e.preventDefault();
    if (!newTypeData.name.trim()) return;
    setSavingType(true);
    try {
      await saveTicketType(newTypeData);
      setNewTypeData({ name: '', color: 'blue', icon: 'Bug' });
      setIsNewTypeModalOpen(false);
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

        // O Firestore limita batches a 500 operações
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
          <Tabs.List>
            <Tabs.Trigger value="users">Usuários e Permissões</Tabs.Trigger>
            <Tabs.Trigger value="ticketTypes">Tipos de Ticket</Tabs.Trigger>
            <Tabs.Trigger value="workflows">Workflows e Status</Tabs.Trigger>
          </Tabs.List>

          <Box pt="4">
            <Tabs.Content value="users">
              <Text as="h2" size="4" weight="bold" mb="4">Gestão de Usuários</Text>
              <Text color="gray" mb="4" as="p">Aqui listamos todos os usuários do sistema. Altere o papel (Role) para conceder privilégios administrativos.</Text>
              
              {loadingUsers ? <Loader2 className="spinner-icon" /> : (
                <Table.Root variant="surface">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Nome / E-mail</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Data de Ingresso</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell align="right">Papel (Role)</Table.ColumnHeaderCell>
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
                        <Table.Cell>
                          {u.createdAt ? new Date(u.createdAt.toDate()).toLocaleDateString() : 'N/A'}
                        </Table.Cell>
                        <Table.Cell justify="end">
                          <Select.Root value={u.role} onValueChange={(val) => handleRoleChange(u.id, val)}>
                            <Select.Trigger />
                            <Select.Content>
                              <Select.Item value="user">Membro (User)</Select.Item>
                              <Select.Item value="admin">Administrador (Admin)</Select.Item>
                            </Select.Content>
                          </Select.Root>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              )}
            </Tabs.Content>

            <Tabs.Content value="ticketTypes">
              <Flex justify="between" align="center" mb="4">
                <Text as="h2" size="4" weight="bold">Tipos de Ticket Cadastrados</Text>
                
                <Dialog.Root open={isNewTypeModalOpen} onOpenChange={setIsNewTypeModalOpen}>
                  <Dialog.Trigger>
                    <Button size="2">Novo Tipo</Button>
                  </Dialog.Trigger>
                  <Dialog.Content maxWidth="400px">
                    <Dialog.Title>Criar Novo Tipo</Dialog.Title>
                    <form onSubmit={handleSaveType}>
                      <Flex direction="column" gap="3">
                        <label>
                          <Text as="div" size="2" mb="1" weight="bold">Nome</Text>
                          <TextField.Root 
                            value={newTypeData.name} 
                            onChange={(e) => setNewTypeData({...newTypeData, name: e.target.value})} 
                            placeholder="Ex: Épico, Bug..." 
                            required 
                          />
                        </label>
                        <label>
                          <Text as="div" size="2" mb="1" weight="bold">Cor</Text>
                          <Select.Root value={newTypeData.color} onValueChange={(val) => setNewTypeData({...newTypeData, color: val})}>
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
              </Flex>
              <Text color="gray" mb="4" as="p">Aqui o Admin poderá criar novos tipos e definir cores.</Text>
              
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
                          <Button size="1" color="red" variant="soft" onClick={() => handleDeleteType(type.id)}>
                            <Trash2 size={14} /> Excluir
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                    {ticketTypes.length === 0 && (
                      <Table.Row>
                        <Table.Cell colSpan={3} align="center">Nenhum tipo cadastrado.</Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table.Root>
              )}
            </Tabs.Content>

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
                            placeholder="Ex: Fluxo Ágil TI" 
                            required 
                          />
                        </label>
                        <label>
                          <Text as="div" size="2" mb="1" weight="bold">Colunas (separadas por vírgula)</Text>
                          <TextField.Root 
                            value={newWorkflowData.columnsStr} 
                            onChange={(e) => setNewWorkflowData({...newWorkflowData, columnsStr: e.target.value})} 
                            placeholder="Ex: Backlog, Em Andamento, Concluído" 
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
              <Text color="gray" mb="4" as="p">Configure os grupos de colunas (Workflows) que poderão ser utilizados pelos projetos.</Text>
              
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
                    {workflows.length === 0 && (
                      <Table.Row>
                        <Table.Cell colSpan={3} align="center">Nenhum workflow cadastrado.</Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table.Root>
              )}
            </Tabs.Content>
          </Box>
        </Tabs.Root>
      </Card>
      
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
