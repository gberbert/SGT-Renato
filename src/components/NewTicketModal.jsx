import React, { useState, useEffect } from 'react';
import { Dialog, Button, Flex, Text, TextField, Select, Box, Grid, IconButton } from '@radix-ui/themes';
import { createTicket, subscribeToTickets, fetchJiraTicket, searchJiraTickets } from '../services/ticketService';
import { subscribeToTicketTypes, subscribeToUsers, subscribeToSystems, subscribeToComponents, subscribeToCustomFields, subscribeToWorkflows, saveSystem } from '../services/settingsService';
import { subscribeToProjects } from '../services/projectService';
import { subscribeToProjectSquads } from '../services/squadService';
import { auth } from '../firebase';
import RichTextEditor from './RichTextEditor';
import { Loader2, Plus, Trash2, Download, Search } from 'lucide-react';

const NewTicketModal = ({ isOpen, onClose, parentId = null, currentBoard = 'demandas' }) => {
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    type: 'Task',
    priority: 'medium',
    projectId: '',
    squadId: '',
    externalTicket: '',
    component: '',
    assignee: '',
    startDate: '',
    endDate: '',
    parentDemandaId: '',
    environment: '',
    reporter: '',
    jiraDatesFlow: {}
  });
  const [associatedSystems, setAssociatedSystems] = useState([]);

  const [ticketTypes, setTicketTypes] = useState([]);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [squads, setSquads] = useState([]);
  const [systems, setSystems] = useState([]);
  const [components, setComponents] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [customData, setCustomData] = useState({});
  const [demandas, setDemandas] = useState([]);
  const [workflows, setWorkflows] = useState([]);

  useEffect(() => {
    const unsubscribeTypes = subscribeToTicketTypes((data) => {
      setTicketTypes(data);
      if (data.length > 0 && !data.find(t => t.name === formData.type)) {
        setFormData(prev => ({ ...prev, type: data[0].name }));
      }
    });
    const unsubscribeProjects = subscribeToProjects(setProjects);
    const unsubscribeUsers = subscribeToUsers(setUsers);
    const unsubscribeSystems = subscribeToSystems((data) => setSystems(data));
    const unsubscribeComponents = subscribeToComponents((data) => setComponents(data));
    const unsubscribeCustomFields = subscribeToCustomFields((data) => setCustomFields(data));
    const unsubscribeTickets = subscribeToTickets((data) => {
      setDemandas(data.filter(t => (t.board || 'demandas') === 'demandas'));
    }, console.error);
    const unsubscribeWorkflows = subscribeToWorkflows(setWorkflows);

    return () => {
      unsubscribeTypes();
      unsubscribeUsers();
      unsubscribeProjects();
      unsubscribeSystems();
      unsubscribeComponents();
      unsubscribeCustomFields();
      unsubscribeTickets();
      unsubscribeWorkflows();
    };
  }, []);

  useEffect(() => {
    setFormData(prev => ({ ...prev, squadId: '' }));
    if (!formData.projectId) {
      setSquads([]);
      return;
    }
    const unsub = subscribeToProjectSquads(formData.projectId, setSquads, console.error);
    return () => unsub();
  }, [formData.projectId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'squadId' && value) {
        const squad = squads.find(s => s.id === value);
        if (squad && squad.leaderId) {
          const leader = users.find(u => u.id === squad.leaderId);
          if (leader) {
            updated.assignee = leader.shortName || leader.displayName || leader.email;
          }
        }
      }
      return updated;
    });
  };

  const handleAddSystem = () => {
    setAssociatedSystems([...associatedSystems, { system: systems.length > 0 ? systems[0].name : '', hours: 0 }]);
  };

  const handleRemoveSystem = (index) => {
    setAssociatedSystems(associatedSystems.filter((_, i) => i !== index));
  };

  const handleSystemChange = (index, field, value) => {
    const updated = [...associatedSystems];
    if (field === 'hours') {
      updated[index][field] = parseFloat(value) || 0;
    } else {
      updated[index][field] = value;
    }
    setAssociatedSystems(updated);
  };

  const [loadingJira, setLoadingJira] = useState(false);
  const handleImportJira = async () => {
    if (!formData.externalTicket || !formData.externalTicket.trim()) {
      alert("Por favor, digite a chave do ticket do Jira (Ex: PROJ-123) no campo Ticket Externo.");
      return;
    }
    setLoadingJira(true);
    try {
      const jiraData = await fetchJiraTicket(formData.externalTicket.trim());
      setFormData(prev => ({
        ...prev,
        title: jiraData.title || prev.title,
        priority: jiraData.priority?.toLowerCase().includes('alta') ? 'high' : 
                  jiraData.priority?.toLowerCase().includes('crítica') ? 'critical' : 'medium',
        type: jiraData.jiraType ? (ticketTypes.find(t => t.name.toLowerCase() === jiraData.jiraType.toLowerCase())?.name || prev.type) : prev.type,
        endDate: jiraData.jiraDueDate || prev.endDate,
        environment: jiraData.jiraEnvironment || prev.environment,
        reporter: jiraData.jiraCreator || prev.reporter,
        component: (jiraData.jiraLabels && jiraData.jiraLabels.length > 0) ? (components.find(c => c.name.toLowerCase() === jiraData.jiraLabels[0].toLowerCase())?.name || prev.component) : prev.component,
        jiraDatesFlow: jiraData.jiraDatesFlow || {}
      }));
      if (jiraData.jiraAssociatedSystems && jiraData.jiraAssociatedSystems.length > 0) {
        setAssociatedSystems(jiraData.jiraAssociatedSystems.map(sys => ({ system: sys, hours: 0 })));
        
        jiraData.jiraAssociatedSystems.forEach(sysName => {
          if (!systems.some(s => s.name === sysName)) {
            saveSystem({ name: sysName, projectId: formData.projectId || '' }).catch(console.error);
          }
        });
      }
      setDescription(jiraData.description || description);
      alert(`Dados do Jira importados com sucesso!\nTicket: ${jiraData.title}`);
    } catch (error) {
      console.error(error);
      alert("Falha ao importar do Jira: " + error.message);
    } finally {
      setLoadingJira(false);
    }
  };

  const [isJiraSearchOpen, setIsJiraSearchOpen] = useState(false);
  const [jiraSearchResults, setJiraSearchResults] = useState([]);
  const [loadingJiraSearch, setLoadingJiraSearch] = useState(false);

  const handleOpenJiraSearch = async () => {
    setIsJiraSearchOpen(true);
    setLoadingJiraSearch(true);
    try {
      const results = await searchJiraTickets();
      setJiraSearchResults(results);
    } catch (error) {
      console.error(error);
      alert("Falha ao buscar demandas no Jira: " + error.message);
    } finally {
      setLoadingJiraSearch(false);
    }
  };

  const handleSelectJiraTicket = async (jiraDataInfo) => {
    setLoadingJiraSearch(true);
    try {
      const jiraData = await fetchJiraTicket(jiraDataInfo.code);
      setFormData(prev => ({
        ...prev,
        externalTicket: jiraData.code,
        title: jiraData.title || prev.title,
        priority: jiraData.priority?.toLowerCase().includes('alta') ? 'high' : 
                  jiraData.priority?.toLowerCase().includes('crítica') ? 'critical' : 'medium',
        type: jiraData.jiraType ? (ticketTypes.find(t => t.name.toLowerCase() === jiraData.jiraType.toLowerCase())?.name || prev.type) : prev.type,
        endDate: jiraData.jiraDueDate || prev.endDate,
        environment: jiraData.jiraEnvironment || prev.environment,
        reporter: jiraData.jiraCreator || prev.reporter,
        component: (jiraData.jiraLabels && jiraData.jiraLabels.length > 0) ? (components.find(c => c.name.toLowerCase() === jiraData.jiraLabels[0].toLowerCase())?.name || prev.component) : prev.component,
        jiraDatesFlow: jiraData.jiraDatesFlow || {}
      }));
      if (jiraData.jiraAssociatedSystems && jiraData.jiraAssociatedSystems.length > 0) {
        setAssociatedSystems(jiraData.jiraAssociatedSystems.map(sys => ({ system: sys, hours: 0 })));
        
        jiraData.jiraAssociatedSystems.forEach(sysName => {
          if (!systems.some(s => s.name === sysName)) {
            saveSystem({ name: sysName, projectId: formData.projectId || '' }).catch(console.error);
          }
        });
      }
      setDescription(jiraData.description || description);
      setIsJiraSearchOpen(false);
    } catch (error) {
      console.error(error);
      alert("Falha ao buscar dados detalhados do ticket: " + error.message);
    } finally {
      setLoadingJiraSearch(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.projectId || !formData.externalTicket?.trim() || !formData.type) {
      alert("Por favor, preencha todos os campos obrigatórios (Projeto, Ticket Externo, Título e Tipo).");
      return;
    }

    if (!formData.squadId && squads.length > 0) {
      alert("Por favor, selecione uma Squad.");
      return;
    }

    if (currentBoard === 'atividades' && !formData.parentDemandaId) {
      alert("Por favor, selecione uma Demanda Pai para esta atividade.");
      return;
    }

    if (associatedSystems.length === 0) {
      alert("Por favor, adicione pelo menos um sistema associado.");
      return;
    }

    setLoading(true);
    
    try {
      const proj = projects.find(p => p.id === formData.projectId);
      const projKey = proj ? proj.key : 'SGT';

      let startColumnId = 'col-backlog'; // Fallback
      if (proj) {
        const targetWorkflowId = currentBoard === 'atividades' ? proj.workflowAtividadesId : proj.workflowId;
        const flow = workflows.find(w => w.id === targetWorkflowId);
        if (flow && flow.columns && flow.columns.length > 0) {
          startColumnId = flow.columns[0].id;
        } else if (flow && flow.columnsStr) {
          const firstColName = flow.columnsStr.split(',')[0].trim();
          startColumnId = `col-${firstColName.toLowerCase().replace(/\s+/g, '-')}`;
        }
      }

      const sumHours = associatedSystems.reduce((acc, curr) => acc + curr.hours, 0);

      const ticketData = {
        code: currentBoard === 'demandas' ? formData.externalTicket : `ATV-${formData.externalTicket}`,
        title: formData.title,
        description: description,
        type: formData.type,
        priority: formData.priority,
        columnId: startColumnId,
        projectId: formData.projectId,
        squadId: formData.squadId,
        assignee: formData.assignee || 'Sem responsável',
        externalTicket: formData.externalTicket,
        associatedSystems: associatedSystems,
        estimatedHours: sumHours,
        storyPoints: sumHours,
        component: formData.component,
        startDate: formData.startDate,
        endDate: formData.endDate,
        environment: formData.environment,
        reporter: formData.reporter,
        jiraDatesFlow: formData.jiraDatesFlow || {},
        customData: customData,
        parentId: currentBoard === 'atividades' ? formData.parentDemandaId : parentId,
        board: currentBoard,
        comments: 0
      };
      
      if (parentId) {
        ticketData.parentId = parentId;
      }
      
      await createTicket(ticketData);
      
      setFormData({
        title: '',
        type: 'Task',
        priority: 'medium',
        projectId: '',
        externalTicket: '',
        component: '',
        assignee: '',
        startDate: '',
        endDate: '',
        parentDemandaId: '',
        environment: '',
        reporter: '',
        jiraDatesFlow: {}
      });
      setAssociatedSystems([]);
      setDescription('');
      setCustomData({});
      onClose();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Ocorreu um erro ao salvar o ticket.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content maxWidth="600px" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <Dialog.Title>{currentBoard === 'atividades' ? 'Nova Atividade' : 'Nova Demanda'}</Dialog.Title>
        <Dialog.Description size="2" mb="4" color="gray">
          {currentBoard === 'atividades' ? 'Crie uma nova atividade atrelada a uma demanda pai.' : 'Crie uma nova demanda.'}
        </Dialog.Description>
        
        <form onSubmit={handleSubmit}>
          <Flex direction="column" gap="4">
            {currentBoard === 'atividades' && (
              <Box>
                <Text as="div" size="2" mb="1" weight="bold">Demanda Pai <span style={{ color: 'red' }}>*</span></Text>
                <Select.Root value={formData.parentDemandaId} onValueChange={(v) => handleSelectChange('parentDemandaId', v)}>
                  <Select.Trigger placeholder="Selecione a demanda relacionada..." style={{ width: '100%' }} />
                  <Select.Content>
                    {demandas.map(d => (
                      <Select.Item key={d.id} value={d.id}>{d.code} - {d.title}</Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Box>
            )}

            <Flex gap="4" align="end" wrap="wrap">
              <Box style={{ flex: '1 1 200px' }}>
                <Text as="div" size="2" mb="1" weight="bold">Projeto <span style={{ color: 'red' }}>*</span></Text>
                <Select.Root value={formData.projectId} onValueChange={(v) => handleSelectChange('projectId', v)}>
                  <Select.Trigger placeholder="Selecione o projeto..." style={{ width: '100%' }} />
                  <Select.Content>
                    {projects.map(p => (
                      <Select.Item key={p.id} value={p.id}>{p.name}</Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Box>

              {squads.length > 0 && (
                <Box style={{ flex: '1 1 200px' }}>
                  <Text as="div" size="2" mb="1" weight="bold">Squad <span style={{ color: 'red' }}>*</span></Text>
                  <Select.Root value={formData.squadId} onValueChange={(v) => handleSelectChange('squadId', v)}>
                    <Select.Trigger placeholder="Selecione a Squad..." style={{ width: '100%' }} />
                    <Select.Content>
                      {squads.map(s => (
                        <Select.Item key={s.id} value={s.id}>{s.name}</Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </Box>
              )}

              <Box style={{ flex: '1 1 200px' }}>
                <Text as="div" size="2" mb="1" weight="bold">Ticket Externo <span style={{ color: 'red' }}>*</span></Text>
                <TextField.Root 
                  name="externalTicket" 
                  placeholder="Ex: DEMANDA-123"
                  value={formData.externalTicket}
                  onChange={handleChange}
                >
                  <TextField.Slot side="right" pr="1">
                    <IconButton size="1" variant="soft" color="indigo" type="button" onClick={handleOpenJiraSearch} disabled={loadingJiraSearch} title="Pesquisar Demandas no Jira" mr="1" style={{ marginRight: '4px' }}>
                      <Search size={14} />
                    </IconButton>
                    <IconButton size="1" variant="soft" color="blue" type="button" onClick={handleImportJira} disabled={loadingJira} title="Importar dados do Jira">
                      {loadingJira ? <Loader2 className="spinner-icon" size={14} /> : <Download size={14} />}
                    </IconButton>
                  </TextField.Slot>
                </TextField.Root>
              </Box>
            </Flex>

            <Box>
              <Text as="div" size="2" mb="1" weight="bold">Título do Ticket <span style={{ color: 'red' }}>*</span></Text>
              <TextField.Root 
                name="title" 
                required 
                placeholder="Ex: Corrigir erro na tela de login"
                value={formData.title}
                onChange={handleChange}
              />
            </Box>
            
            <Flex gap="4">
              <Box style={{ flex: 1 }}>
                <Text as="div" size="2" mb="1" weight="bold">Tipo <span style={{ color: 'red' }}>*</span></Text>
                <Select.Root value={formData.type} onValueChange={(v) => handleSelectChange('type', v)}>
                  <Select.Trigger style={{ width: '100%' }} />
                  <Select.Content>
                    {ticketTypes.length > 0 ? ticketTypes.map(t => (
                      <Select.Item key={t.id} value={t.name}>{t.name}</Select.Item>
                    )) : (
                      <>
                        <Select.Item value="Task">Tarefa (Task)</Select.Item>
                        <Select.Item value="Bug">Bug (Erro)</Select.Item>
                      </>
                    )}
                  </Select.Content>
                </Select.Root>
              </Box>

              <Box style={{ flex: 1 }}>
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
              </Box>
            </Flex>

            <Flex gap="4">
              <Box style={{ flex: 1, backgroundColor: 'var(--gray-2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--gray-5)' }}>
                <Flex justify="between" align="center" mb="2">
                  <Text as="div" size="2" weight="bold">Sistemas Associados & Horas</Text>
                  <Button size="1" variant="soft" onClick={handleAddSystem} type="button">
                    <Plus size={14} /> Add Sistema
                  </Button>
                </Flex>
                
                {associatedSystems.length === 0 ? (
                  <Text size="1" color="gray">Nenhum sistema adicionado.</Text>
                ) : (
                  <Flex direction="column" gap="2">
                    {associatedSystems.map((item, idx) => (
                      <Flex key={idx} gap="2" align="center">
                        <Box style={{ flex: 2 }}>
                          <Select.Root value={item.system} onValueChange={(v) => handleSystemChange(idx, 'system', v)}>
                            <Select.Trigger style={{ width: '100%' }} />
                            <Select.Content>
                              {systems.map(s => (
                                <Select.Item key={s.id} value={s.name}>{s.name}</Select.Item>
                              ))}
                              {systems.length === 0 && <Select.Item value="none" disabled>Nenhum cadastrado</Select.Item>}
                            </Select.Content>
                          </Select.Root>
                        </Box>
                        <Box style={{ flex: 1 }}>
                          <TextField.Root 
                            type="number" 
                            placeholder="Horas" 
                            value={item.hours === 0 ? '' : item.hours} 
                            onChange={(e) => handleSystemChange(idx, 'hours', e.target.value)}
                          />
                        </Box>
                        <IconButton size="1" color="red" variant="ghost" type="button" onClick={() => handleRemoveSystem(idx)}>
                          <Trash2 size={16} />
                        </IconButton>
                      </Flex>
                    ))}
                  </Flex>
                )}
              </Box>

              <Box style={{ flex: 1 }}>
                <Text as="div" size="2" mb="1" weight="bold">Componente (Tag)</Text>
                <Select.Root value={formData.component} onValueChange={(v) => handleSelectChange('component', v)}>
                  <Select.Trigger placeholder="Selecione..." style={{ width: '100%' }} />
                  <Select.Content>
                    {components.map(c => (
                      <Select.Item key={c.id} value={c.name}>{c.name}</Select.Item>
                    ))}
                    {components.length === 0 && <Select.Item value="none" disabled>Nenhum cadastrado</Select.Item>}
                  </Select.Content>
                </Select.Root>
              </Box>
            </Flex>

            <Box>
              <Text as="div" size="2" mb="1" weight="bold">Responsável</Text>
              <Select.Root value={formData.assignee} onValueChange={(v) => handleSelectChange('assignee', v)}>
                <Select.Trigger placeholder="Selecione o responsável..." style={{ width: '100%' }} />
                <Select.Content>
                  <Select.Item value="">Sem responsável</Select.Item>
                  {users.map(u => {
                    const label = u.shortName || u.displayName || u.email;
                    return <Select.Item key={u.id} value={label}>{label}</Select.Item>
                  })}
                </Select.Content>
              </Select.Root>
            </Box>

            <Flex gap="4">
              <Box style={{ flex: 1 }}>
                <Text as="div" size="2" mb="1" weight="bold">Data Início</Text>
                <TextField.Root 
                  type="date"
                  name="startDate" 
                  value={formData.startDate}
                  onChange={handleChange}
                />
              </Box>

              <Box style={{ flex: 1 }}>
                <Text as="div" size="2" mb="1" weight="bold">Data Fim</Text>
                <TextField.Root 
                  type="date"
                  name="endDate" 
                  value={formData.endDate}
                  onChange={handleChange}
                />
              </Box>
            </Flex>
            
            <Flex gap="4">
              <Box style={{ flex: 1 }}>
                <Text as="div" size="2" mb="1" weight="bold">Relator (Origem Jira)</Text>
                <TextField.Root 
                  name="reporter" 
                  value={formData.reporter}
                  onChange={handleChange}
                  placeholder="Ex: Nome do Relator"
                />
              </Box>
              <Box style={{ flex: 1 }}>
                <Text as="div" size="2" mb="1" weight="bold">Ambiente (Jira)</Text>
                <TextField.Root 
                  name="environment" 
                  value={formData.environment}
                  onChange={handleChange}
                  placeholder="Ex: Produção"
                />
              </Box>
            </Flex>
            
            <Box>
              <Text as="div" size="2" mb="1" weight="bold">Descrição (Opcional)</Text>
              <RichTextEditor 
                content={description}
                onChange={setDescription}
                users={users}
              />
            </Box>

            {currentBoard === 'demandas' && (
              <Box style={{ backgroundColor: 'var(--indigo-2)', padding: '16px', borderRadius: '8px', border: '1px solid var(--indigo-5)', marginTop: '8px', marginBottom: '8px' }}>
                <Flex align="center" gap="2" mb="3">
                  <Text as="div" size="3" weight="bold" color="indigo">Fluxo de Datas Jira</Text>
                </Flex>
                <Grid columns="3" gap="3">
                  {[
                    { key: 'dataAnaliseTshirt', label: 'Análise T-Shirt' },
                    { key: 'tshirtEnviada', label: 'T-Shirt Enviada' },
                    { key: 'aprovacao1', label: 'Aprovação (Atend.)' },
                    { key: 'planejamentoSLA', label: 'Planejamento SLA' },
                    { key: 'planejamentoEnviado', label: 'Planejamento Enviado' },
                    { key: 'deadlineAprovacao', label: 'Deadline Aprovação' },
                    { key: 'aprovacao2', label: 'Aprovação (EF/SR)' },
                    { key: 'inicioDemanda', label: 'Início Demanda' },
                    { key: 'dataEntregaPlanejada', label: 'Entrega Planejada' },
                    { key: 'dataEntrega', label: 'Data Entrega' },
                    { key: 'aprovacaoHomologacao', label: 'Ap. Homologação' },
                  ].map(field => (
                    <Box key={field.key}>
                      <Text as="div" size="1" mb="1" weight="bold" color="gray">{field.label}</Text>
                      <TextField.Root 
                        type="date"
                        value={formData.jiraDatesFlow?.[field.key] || ''}
                        onChange={(e) => {
                           const newVal = e.target.value;
                           setFormData(prev => ({
                             ...prev,
                             jiraDatesFlow: { ...(prev.jiraDatesFlow || {}), [field.key]: newVal }
                           }));
                        }}
                      />
                    </Box>
                  ))}
                </Grid>
              </Box>
            )}
            
            {/* Dynamic Custom Fields */}
            {customFields.map(field => {
              const currentTypeObj = ticketTypes.find(t => t.name === formData.type);
              if (field.ticketTypeId !== 'all' && field.ticketTypeId !== currentTypeObj?.id) {
                return null;
              }
              const optionsArray = field.type === 'select' && field.options 
                ? field.options.split(',').map(o => o.trim()).filter(Boolean) 
                : [];
                
              return (
                <Box key={field.id} style={{ width: '100%' }}>
                  <Text as="div" size="2" mb="1" weight="bold">{field.name}</Text>
                  {field.type === 'textarea' ? (
                    <TextField.Root 
                      placeholder="..."
                      value={customData[field.name] || ''}
                      onChange={(e) => setCustomData({ ...customData, [field.name]: e.target.value })}
                    />
                  ) : field.type === 'select' ? (
                    <Select.Root 
                      value={customData[field.name] || ''}
                      onValueChange={(val) => setCustomData({ ...customData, [field.name]: val })}
                    >
                      <Select.Trigger placeholder="Selecione..." style={{ width: '100%' }} />
                      <Select.Content>
                        {optionsArray.map((opt, i) => (
                          <Select.Item key={i} value={opt}>{opt}</Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Root>
                  ) : (
                    <TextField.Root 
                      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                      placeholder="..."
                      value={customData[field.name] || ''}
                      onChange={(e) => setCustomData({ ...customData, [field.name]: e.target.value })}
                    />
                  )}
                </Box>
              );
            })}
          </Flex>
          
          <Flex gap="3" mt="5" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray" type="button" disabled={loading}>
                Cancelar
              </Button>
            </Dialog.Close>
            <Button type="submit" disabled={loading || !formData.title || !formData.projectId}>
              {loading ? <Loader2 className="spinner-icon" size={16} /> : 'Salvar Ticket'}
            </Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>

    <Dialog.Root open={isJiraSearchOpen} onOpenChange={setIsJiraSearchOpen}>
      <Dialog.Content maxWidth="700px" style={{ zIndex: 9999 }}>
        <Dialog.Title>Demandas Corporativas (Jira)</Dialog.Title>
        <Dialog.Description size="2" mb="4" color="gray">
          Selecione uma demanda para preencher automaticamente o formulário.
        </Dialog.Description>
        
        {loadingJiraSearch ? (
          <Flex justify="center" p="6"><Loader2 className="spinner-icon" size={32} /></Flex>
        ) : (
          <Flex direction="column" gap="3" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {jiraSearchResults.length === 0 ? (
              <Text>Nenhuma demanda encontrada no filtro.</Text>
            ) : (
              jiraSearchResults.map(issue => (
                <Box key={issue.code} p="3" style={{ border: '1px solid var(--gray-5)', borderRadius: '8px', cursor: 'pointer' }} onClick={() => handleSelectJiraTicket(issue)}>
                  <Flex justify="between" mb="1">
                    <Text weight="bold">{issue.code}</Text>
                    <Text size="1" color="gray">{issue.status}</Text>
                  </Flex>
                  <Text size="2">{issue.title}</Text>
                </Box>
              ))
            )}
          </Flex>
        )}
        <Flex gap="3" mt="5" justify="end">
          <Button variant="soft" color="gray" onClick={() => setIsJiraSearchOpen(false)}>Cancelar</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
    </>
  );
};

export default NewTicketModal;
