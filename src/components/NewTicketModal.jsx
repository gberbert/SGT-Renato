import React, { useState, useEffect } from 'react';
import { Dialog, Button, Flex, Text, TextField, Select, Box, Grid } from '@radix-ui/themes';
import { createTicket } from '../services/ticketService';
import { subscribeToTicketTypes, subscribeToUsers, subscribeToSystems, subscribeToComponents, subscribeToCustomFields } from '../services/settingsService';
import { subscribeToProjects } from '../services/projectService';
import { auth } from '../firebase';
import RichTextEditor from './RichTextEditor';
import { Loader2 } from 'lucide-react';

const NewTicketModal = ({ isOpen, onClose, parentId = null }) => {
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    type: 'Task',
    priority: 'medium',
    projectId: '',
    externalTicket: '',
    system: '',
    component: '',
    assignee: '',
    startDate: '',
    endDate: ''
  });

  const [ticketTypes, setTicketTypes] = useState([]);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [systems, setSystems] = useState([]);
  const [components, setComponents] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [customData, setCustomData] = useState({});

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

    return () => {
      unsubscribeTypes();
      unsubscribeUsers();
      unsubscribeProjects();
      unsubscribeSystems();
      unsubscribeComponents();
      unsubscribeCustomFields();
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.projectId) return;
    setLoading(true);
    
    try {
      const proj = projects.find(p => p.id === formData.projectId);
      const projKey = proj ? proj.key : 'SGT';

      const DEFAULT_COLUMN_ID = 'col-backlog';

      const ticketData = {
        code: `${projKey}-${Math.floor(Math.random() * 9000) + 1000}`,
        title: formData.title,
        description: description,
        type: formData.type,
        priority: formData.priority,
        columnId: DEFAULT_COLUMN_ID,
        projectId: formData.projectId,
        assignee: formData.assignee || 'Sem responsável',
        externalTicket: formData.externalTicket,
        system: formData.system,
        component: formData.component,
        startDate: formData.startDate,
        endDate: formData.endDate,
        customData: customData,
        parentId: parentId,
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
        system: '',
        component: '',
        assignee: '',
        startDate: '',
        endDate: ''
      });
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
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content maxWidth="600px">
        <Dialog.Title>Novo Ticket</Dialog.Title>
        <Dialog.Description size="2" mb="4" color="gray">
          Crie uma nova demanda (O status inicial será sempre 'Backlog').
        </Dialog.Description>
        
        <form onSubmit={handleSubmit}>
          <Flex direction="column" gap="4">
            <Flex gap="4">
              <Box style={{ flex: 1 }}>
                <Text as="div" size="2" mb="1" weight="bold">Projeto</Text>
                <Select.Root value={formData.projectId} onValueChange={(v) => handleSelectChange('projectId', v)}>
                  <Select.Trigger placeholder="Selecione um projeto..." style={{ width: '100%' }} />
                  <Select.Content>
                    {projects.map(p => (
                      <Select.Item key={p.id} value={p.id}>{p.name}</Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Box>

              <Box style={{ flex: 1 }}>
                <Text as="div" size="2" mb="1" weight="bold">Ticket Externo</Text>
                <TextField.Root 
                  name="externalTicket" 
                  placeholder="Ex: DEMANDA-123"
                  value={formData.externalTicket}
                  onChange={handleChange}
                />
              </Box>
            </Flex>

            <Box>
              <Text as="div" size="2" mb="1" weight="bold">Título do Ticket</Text>
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
                <Text as="div" size="2" mb="1" weight="bold">Tipo</Text>
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
              <Box style={{ flex: 1 }}>
                <Text as="div" size="2" mb="1" weight="bold">Sistema</Text>
                <Select.Root value={formData.system} onValueChange={(v) => handleSelectChange('system', v)}>
                  <Select.Trigger placeholder="Selecione..." style={{ width: '100%' }} />
                  <Select.Content>
                    {systems.map(s => (
                      <Select.Item key={s.id} value={s.name}>{s.name}</Select.Item>
                    ))}
                    {systems.length === 0 && <Select.Item value="none" disabled>Nenhum cadastrado</Select.Item>}
                  </Select.Content>
                </Select.Root>
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
            
            <Box>
              <Text as="div" size="2" mb="1" weight="bold">Descrição (Opcional)</Text>
              <RichTextEditor 
                content={description}
                onChange={setDescription}
              />
            </Box>
            
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
  );
};

export default NewTicketModal;
