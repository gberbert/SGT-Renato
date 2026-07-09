import React, { useState, useEffect, useRef } from 'react';
import { Dialog, Button, Flex, Text, TextArea, Badge, Tabs, Box, TextField, ScrollArea, Card, Switch, Grid, Select } from '@radix-ui/themes';
import { updateTicket, deleteTicket, addComment, subscribeToComments, subscribeToSubtasks, uploadAttachment, subscribeToAttachments, subscribeToHistory, addWorkLog, subscribeToWorkLogs, subscribeToEstimationsByTicketId, getTicketById } from '../services/ticketService';
import { subscribeToProjects } from '../services/projectService';
import { subscribeToProjectSquads } from '../services/squadService';
import { subscribeToWorkflows, subscribeToCustomFields, subscribeToTicketTypes, subscribeToUsers } from '../services/settingsService';
import { auth } from '../firebase';
import { Loader2, Send, Plus, Paperclip, File, Download, ShieldAlert, Sparkles, Clock, Edit2, Trash2, X } from 'lucide-react';
import NewTicketModal from './NewTicketModal';
import RichTextEditor from './RichTextEditor';

const TicketDetailsModal = ({ isOpen, onClose, ticket, userRole }) => {
  const [description, setDescription] = useState('');
  const [commentText, setCommentText] = useState('');
  const [startDate, setStartDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [comments, setComments] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [history, setHistory] = useState([]);
  const [workLogs, setWorkLogs] = useState([]);
  
  // Advanced fields
  const [sprint, setSprint] = useState('');
  const [squadId, setSquadId] = useState('');
  const [totalEstimatedHours, setTotalEstimatedHours] = useState(0);
  const [labels, setLabels] = useState('');
  const [dependsOn, setDependsOn] = useState('');
  const [isBlocked, setIsBlocked] = useState(false);
  const [customData, setCustomData] = useState({});

  const [timeSpent, setTimeSpent] = useState('');
  const [timeDesc, setTimeDesc] = useState('');

  const [projects, setProjects] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [users, setUsers] = useState([]);
  const [squads, setSquads] = useState([]);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedCode, setEditedCode] = useState('');
  const [parentTicketInfo, setParentTicketInfo] = useState(null);

  const [isSubtaskModalOpen, setIsSubtaskModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments, isOpen]);

  useEffect(() => {
    if (ticket) {
      setDescription(ticket.description || '');
      setEditedTitle(ticket.title || '');
      setEditedCode(ticket.code || '');
      setStartDate(ticket.startDate || '');
      setDeadline(ticket.deadline || '');
      setSprint(ticket.sprint || '');
      setSquadId(ticket.squadId || '');
      setLabels(ticket.labels || '');
      setDependsOn(ticket.dependsOn || '');
      setIsBlocked(ticket.isBlocked || false);
      setCustomData(ticket.customData || {});

      if (ticket.board === 'atividades' && ticket.parentId) {
        getTicketById(ticket.parentId).then(pt => {
          if (pt) setParentTicketInfo(pt);
        });
      } else {
        setParentTicketInfo(null);
      }

      const unsubscribeComments = subscribeToComments(ticket.id, (data) => {
        setComments(data);
      });
      const unsubscribeSubtasks = subscribeToSubtasks(ticket.id, (data) => {
        setSubtasks(data);
      });
      const unsubscribeAttachments = subscribeToAttachments(ticket.id, (data) => {
        setAttachments(data);
      });
      const unsubscribeHistory = subscribeToHistory(ticket.id, (data) => {
        setHistory(data);
      });
      const unsubscribeWorkLogs = subscribeToWorkLogs(ticket.id, (data) => {
        setWorkLogs(data);
      });
      const unsubscribeEstimations = subscribeToEstimationsByTicketId(ticket.id, (data) => {
        const total = data.reduce((acc, curr) => acc + (curr.totalBaseHours || 0), 0);
        setTotalEstimatedHours(total);
      });
      const unsubscribeProjects = subscribeToProjects((data) => {
        setProjects(data);
      });
      const unsubscribeWorkflows = subscribeToWorkflows((data) => {
        setWorkflows(data);
      });
      const unsubscribeCustomFields = subscribeToCustomFields((data) => {
        setCustomFields(data);
      });
      const unsubscribeTicketTypes = subscribeToTicketTypes((data) => {
        setTicketTypes(data);
      });
      const unsubscribeUsers = subscribeToUsers((data) => {
        setUsers(data);
      });
      const unsubscribeSquads = subscribeToProjectSquads(ticket.projectId, (data) => {
        setSquads(data);
      }, console.error);

      return () => {
        unsubscribeComments();
        unsubscribeSubtasks();
        unsubscribeAttachments();
        unsubscribeHistory();
        unsubscribeWorkLogs();
        unsubscribeEstimations();
        unsubscribeProjects();
        unsubscribeWorkflows();
        unsubscribeCustomFields();
        unsubscribeTicketTypes();
        unsubscribeUsers();
        unsubscribeSquads();
      };
    }
  }, [isOpen, ticket]);

  if (!isOpen || !ticket) return null;

  const handleUpdateField = async (field, value) => {
    if (ticket[field] === value) return;
    try {
      const userName = auth.currentUser?.displayName || auth.currentUser?.email || 'Usuário SGT';
      await updateTicket(ticket.id, { [field]: value }, userName);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateCustomField = async (fieldName, value) => {
    const updatedCustomData = { ...customData, [fieldName]: value };
    setCustomData(updatedCustomData);
    try {
      const userName = auth.currentUser?.displayName || auth.currentUser?.email || 'Usuário SGT';
      await updateTicket(ticket.id, { customData: updatedCustomData }, userName);
    } catch (err) {
      console.error(err);
    }
  };

  const currentProject = projects.find(p => p.id === ticket.projectId);
  const currentWorkflow = workflows.find(w => w.id === currentProject?.workflowId);
  const currentColumnIndex = currentWorkflow?.columns?.findIndex(c => c.id === ticket.columnId) ?? -1;
  
  // Get all columns from start up to current column
  const activeColumns = currentColumnIndex >= 0 
    ? currentWorkflow.columns.slice(0, currentColumnIndex + 1) 
    : [];

  const handleSaveTitle = async () => {
    if ((!editedTitle.trim() && !editedCode.trim()) || (editedTitle === ticket.title && editedCode === ticket.code)) {
      setIsEditingTitle(false);
      return;
    }
    setLoading(true);
    try {
      const userName = auth.currentUser?.displayName || 'Sistema';
      const updates = {};
      if (editedTitle !== ticket.title) updates.title = editedTitle;
      if (editedCode !== ticket.code) updates.code = editedCode;

      if (Object.keys(updates).length > 0) {
        await updateTicket(ticket.id, updates, userName);
        ticket.title = editedTitle;
        ticket.code = editedCode;
      }
      setIsEditingTitle(false);
    } catch (err) {
      alert("Erro ao atualizar ticket");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTicket = async () => {
    if (window.confirm('Tem certeza que deseja excluir este ticket?')) {
      const userName = auth.currentUser?.displayName || 'Sistema';
      try {
        await deleteTicket(ticket.id, userName);
        onClose();
      } catch (err) {
        alert("Erro ao excluir ticket");
      }
    }
  };

  const handleSendComment = async (e) => {
    if (e) e.preventDefault();
    if (!commentText.trim() || commentText === '<p></p>') return;
    setLoading(true);
    try {
      await addComment(ticket.id, {
        text: commentText,
        authorId: auth.currentUser?.uid,
        authorName: auth.currentUser?.displayName || auth.currentUser?.email || 'Usuário SGT'
      });
      setCommentText('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const uploaderInfo = {
        uid: auth.currentUser?.uid,
        name: auth.currentUser?.displayName || auth.currentUser?.email || 'Usuário'
      };
      await uploadAttachment(ticket.id, file, uploaderInfo);
    } catch (err) {
      alert("Falha ao enviar anexo.");
    } finally {
      setUploading(false);
      // reset the input
      e.target.value = null;
    }
  };

  const handleAddWorkLog = async (e) => {
    e.preventDefault();
    if (!timeSpent || isNaN(timeSpent) || Number(timeSpent) <= 0) return;
    setLoading(true);
    try {
      const userName = auth.currentUser?.displayName || auth.currentUser?.email || 'Usuário SGT';
      await addWorkLog(ticket.id, Number(timeSpent), timeDesc, userName);
      setTimeSpent('');
      setTimeDesc('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content className="ticket-modal" maxWidth="900px" style={{ display: 'flex', flexDirection: 'column', height: '90vh', maxHeight: '90vh', overflow: 'hidden' }} onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <Flex direction="column" mb="4">
          <Flex justify="between" align="center" mb="2">
            <Flex align="center" gap="3">
              {!isEditingTitle && (
                ticket.board === 'atividades' && parentTicketInfo ? (
                  <span style={{ border: '1px solid var(--primary)', color: 'var(--primary)', background: 'rgba(99, 102, 241, 0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.875rem', fontWeight: 'bold' }}>
                    {parentTicketInfo.title}
                  </span>
                ) : (
                  <Text size="2" color="gray" weight="medium">{ticket.code}</Text>
                )
              )}
              <Badge color={ticket.priority === 'critical' ? 'red' : 'blue'} variant="soft" size="1">{ticket.type}</Badge>
            </Flex>
            <Flex align="center" gap="4">
              {!isEditingTitle && !ticket.isAutoGenerated && (
                <Flex gap="3" align="center">
                  <Edit2 size={16} style={{ cursor: 'pointer', color: 'var(--gray-10)', transition: 'color 0.2s' }} onClick={() => setIsEditingTitle(true)} />
                  <Trash2 size={16} style={{ cursor: 'pointer', color: 'var(--danger)', transition: 'color 0.2s' }} onClick={handleDeleteTicket} />
                </Flex>
              )}
              <Dialog.Close>
                <Box style={{ cursor: 'pointer', color: 'var(--gray-10)', display: 'flex', alignItems: 'center' }}>
                  <X size={20} />
                </Box>
              </Dialog.Close>
            </Flex>
          </Flex>
          
          <Box>
            {isEditingTitle ? (
              <Flex gap="2" align="center">
                <TextField.Root 
                  value={editedCode} 
                  onChange={(e) => setEditedCode(e.target.value)} 
                  style={{ width: '120px' }}
                  placeholder="Código"
                />
                <TextField.Root 
                  value={editedTitle} 
                  onChange={(e) => setEditedTitle(e.target.value)} 
                  style={{ flexGrow: 1 }}
                  placeholder="Título"
                />
                <Button size="1" onClick={handleSaveTitle}>Salvar</Button>
                <Button size="1" variant="soft" color="gray" onClick={() => { setIsEditingTitle(false); setEditedTitle(ticket.title); setEditedCode(ticket.code); }}>Cancelar</Button>
              </Flex>
            ) : (
              <Dialog.Title size="6" style={{ lineHeight: '1.2', margin: 0 }}>{ticket.title}</Dialog.Title>
            )}
          </Box>
        </Flex>

        <Tabs.Root className="ticket-tabs" defaultValue="details" style={{ height: 'calc(90vh - 100px)', display: 'flex', flexDirection: 'column' }}>
          <Tabs.List className="ticket-tabs-list">
            <Tabs.Trigger value="details">Detalhes</Tabs.Trigger>
            <Tabs.Trigger value="chat">Chat do Ticket</Tabs.Trigger>
            {ticket.board !== 'atividades' && (
              <Tabs.Trigger value="subtasks">Atividades ({subtasks.length})</Tabs.Trigger>
            )}
            <Tabs.Trigger value="attachments">Anexos ({attachments.length})</Tabs.Trigger>
            <Tabs.Trigger value="history">Histórico</Tabs.Trigger>
            {userRole === 'admin' && <Tabs.Trigger value="time">Tempo (Admin)</Tabs.Trigger>}
          </Tabs.List>

          <Box pt="4" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Tabs.Content value="chat" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Box style={{ flexGrow: 1, minHeight: 0, marginBottom: '8px' }}>
                  <ScrollArea style={{ height: '100%', paddingRight: '16px', background: 'var(--gray-2)', borderRadius: '8px', padding: '12px' }}>
                  <Flex direction="column" gap="4" style={{ minHeight: '100%' }}>
                    <Box style={{ flexGrow: 1 }} />
                    {comments.length === 0 ? (
                      <Text color="gray" align="center" mt="5">Nenhuma mensagem ainda.</Text>
                    ) : (
                      comments.map(c => {
                        const isMe = c.authorId === auth.currentUser?.uid;
                        return (
                          <Flex key={c.id} justify={isMe ? "end" : "start"}>
                            <Box 
                              style={{ 
                                maxWidth: '85%', 
                                background: isMe ? 'var(--indigo-4)' : 'var(--surface)', 
                                border: isMe ? 'none' : '1px solid var(--gray-5)',
                                borderRadius: '12px',
                                borderTopRightRadius: isMe ? '2px' : '12px',
                                borderTopLeftRadius: !isMe ? '2px' : '12px',
                                padding: '10px 14px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                              }}
                            >
                              <Flex justify="between" mb="1" gap="4" align="center">
                                <Text size="1" weight="bold" color={isMe ? "indigo" : "gray"}>
                                  {isMe ? 'Você' : c.authorName}
                                </Text>
                                <Text size="1" color={isMe ? "indigo" : "gray"} style={{ opacity: 0.7 }}>
                                  {c.createdAt?.toDate ? c.createdAt.toDate().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                                </Text>
                              </Flex>
                              <div className="rich-text-content" style={{ fontSize: '0.9rem' }} dangerouslySetInnerHTML={{ __html: c.text }} />
                            </Box>
                          </Flex>
                        );
                      })
                    )}
                    <div ref={chatEndRef} />
                  </Flex>
                </ScrollArea>
                </Box>

                <Box>
                  <RichTextEditor 
                    content={commentText}
                    onChange={(val) => setCommentText(val)}
                    users={[{ id: 'todos', displayName: 'Todos', shortName: 'Todos' }, ...users]}
                    minHeight="60px"
                  />
                  <Flex justify="end" mt="2">
                    <Button onClick={handleSendComment} disabled={!commentText.trim() || commentText === '<p></p>' || loading}>
                      {loading ? <Loader2 size={16} className="spinner-icon" /> : <Send size={16} />}
                      Enviar Mensagem
                    </Button>
                  </Flex>
                </Box>
              </Box>
            </Tabs.Content>

            <Tabs.Content value="details" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box style={{ height: '100%' }}>
                <ScrollArea style={{ height: '100%', paddingRight: '16px' }}>
                <Flex direction="column" gap="4">
                  <Box>
                    {ticket.isAutoGenerated && (
                      <Card variant="surface" style={{ background: 'var(--amber-3)', border: '1px solid var(--amber-6)', marginBottom: '16px' }}>
                        <Flex align="center" gap="2">
                          <Text size="2" color="amber" weight="bold">⚠️ Atividade Gerada Automaticamente</Text>
                        </Flex>
                        <Text size="2" color="amber" mt="1">
                          Edições estruturais e exclusão devem ser feitas através da tela de Estimativas da Demanda Pai.
                        </Text>
                      </Card>
                    )}
                    <Text as="div" size="2" weight="bold" mb="2">Descrição Técnica</Text>
                    <RichTextEditor 
                      content={description}
                      onChange={(val) => setDescription(val)}
                      onBlur={() => handleUpdateField('description', description)}
                      enableMentions={false}
                      readOnly={ticket.isAutoGenerated}
                    />
                  </Box>

                  {activeColumns.map((col, colIdx) => {
                    const fields = col.customFields || [];
                    if (fields.length === 0) return null;

                    return (
                      <Card key={col.id} variant="surface" style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.2)', marginBottom: '16px' }}>
                        <Flex align="center" gap="2" mb="3">
                          <Sparkles size={16} color="var(--primary)" />
                          <Text weight="bold" color="indigo">Campos Exclusivos: {col.title}</Text>
                        </Flex>
                        <Grid columns="2" gap="4">
                          {fields.map((field, idx) => {
                            const optionsArray = field.type === 'select' && field.options 
                              ? field.options.split(',').map(o => o.trim()).filter(Boolean) 
                              : [];

                            return (
                              <Box key={idx} style={{ gridColumn: field.type === 'textarea' ? 'span 2' : 'span 1' }}>
                                <Text as="div" size="2" weight="bold" mb="1" color="gray">{field.name}</Text>
                                {field.type === 'textarea' ? (
                                  <TextArea 
                                    placeholder="..."
                                    value={customData[field.name] || ''}
                                    onChange={(e) => setCustomData({ ...customData, [field.name]: e.target.value })}
                                    onBlur={() => handleUpdateCustomField(field.name, customData[field.name])}
                                  />
                                ) : field.type === 'select' ? (
                                  <Select.Root 
                                    value={customData[field.name] || ''}
                                    onValueChange={(val) => handleUpdateCustomField(field.name, val)}
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
                                    onBlur={() => handleUpdateCustomField(field.name, customData[field.name])}
                                  />
                                )}
                              </Box>
                            );
                          })}
                        </Grid>
                      </Card>
                    );
                  })}

                  {/* GLOBAL CUSTOM FIELDS */}
                  {customFields.length > 0 && (
                    <Card variant="surface" style={{ background: 'rgba(255, 165, 0, 0.05)', border: '1px solid rgba(255, 165, 0, 0.2)', marginBottom: '16px' }}>
                      <Flex align="center" gap="2" mb="3">
                        <Sparkles size={16} color="orange" />
                        <Text weight="bold" color="orange">Campos Customizados (Globais)</Text>
                      </Flex>
                      <Grid columns="2" gap="4">
                        {customFields.map(field => {
                          const currentTypeObj = ticketTypes.find(t => t.name === ticket.type);
                          if (field.ticketTypeId !== 'all' && field.ticketTypeId !== currentTypeObj?.id) {
                            return null;
                          }
                          const optionsArray = field.type === 'select' && field.options 
                            ? field.options.split(',').map(o => o.trim()).filter(Boolean) 
                            : [];

                          return (
                            <Box key={field.id} style={{ gridColumn: field.type === 'textarea' ? 'span 2' : 'span 1' }}>
                              <Text as="div" size="2" weight="bold" mb="1" color="gray">{field.name}</Text>
                              {field.type === 'textarea' ? (
                                <TextArea 
                                  placeholder="..."
                                  value={customData[field.name] || ''}
                                  onChange={(e) => setCustomData({ ...customData, [field.name]: e.target.value })}
                                  onBlur={() => handleUpdateCustomField(field.name, customData[field.name])}
                                />
                              ) : field.type === 'select' ? (
                                <Select.Root 
                                  value={customData[field.name] || ''}
                                  onValueChange={(val) => handleUpdateCustomField(field.name, val)}
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
                                  onBlur={() => handleUpdateCustomField(field.name, customData[field.name])}
                                />
                              )}
                            </Box>
                          );
                        })}
                      </Grid>
                    </Card>
                  )}

                  <Grid columns="2" gap="4">
                    {squads.length > 0 && (
                      <Box>
                        <Text as="div" size="2" weight="bold" mb="1" color="gray">Squad</Text>
                        <Select.Root 
                          value={squadId || 'none'} 
                          disabled={ticket.isAutoGenerated}
                          onValueChange={(val) => {
                            const actualVal = val === 'none' ? '' : val;
                            setSquadId(actualVal);
                            handleUpdateField('squadId', actualVal);
                          }}
                        >
                          <Select.Trigger style={{ width: '100%' }} />
                          <Select.Content>
                            <Select.Item value="none">Sem Squad</Select.Item>
                            {squads.map(s => (
                              <Select.Item key={s.id} value={s.id}>{s.name}</Select.Item>
                            ))}
                          </Select.Content>
                        </Select.Root>
                      </Box>
                    )}
                    <Box>
                      <Text as="div" size="2" weight="bold" mb="1" color="gray">Responsável</Text>
                      <Select.Root 
                        value={!ticket.assignee || ticket.assignee === 'Sem responsável' ? 'none' : ticket.assignee} 
                        onValueChange={(val) => {
                          const assignedValue = val === 'none' ? 'Sem responsável' : val;
                          handleUpdateField('assignee', assignedValue);
                        }}
                      >
                        <Select.Trigger style={{ width: '100%' }} />
                        <Select.Content>
                          <Select.Item value="none">Sem responsável</Select.Item>
                          {users.map(u => (
                            <Select.Item key={u.id} value={u.name || u.email}>{u.name || u.email}</Select.Item>
                          ))}
                        </Select.Content>
                      </Select.Root>
                    </Box>
                    <Box>
                      <Text as="div" size="2" weight="bold" mb="1" color="gray">Prioridade</Text>
                      <Text as="div" size="3" style={{ textTransform: 'capitalize' }}>{ticket.priority}</Text>
                    </Box>
                    <Box>
                      <Text as="div" size="2" weight="bold" mb="1" color="gray">Data de Início</Text>
                      <TextField.Root 
                        type="date" 
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)}
                        onBlur={() => handleUpdateField('startDate', startDate)}
                        disabled={ticket.isAutoGenerated}
                      />
                    </Box>
                    <Box>
                      <Text as="div" size="2" weight="bold" mb="1" color="gray">Prazo (Deadline)</Text>
                      <TextField.Root 
                        type="date" 
                        value={deadline} 
                        onChange={(e) => setDeadline(e.target.value)}
                        onBlur={() => handleUpdateField('deadline', deadline)}
                        disabled={ticket.isAutoGenerated}
                      />
                    </Box>
                    <Box>
                      <Text as="div" size="2" weight="bold" mb="1" color="gray">Sprint</Text>
                      <TextField.Root 
                        placeholder="Ex: Sprint 4"
                        value={sprint} 
                        onChange={(e) => setSprint(e.target.value)}
                        onBlur={() => handleUpdateField('sprint', sprint)}
                        disabled={ticket.isAutoGenerated}
                      />
                    </Box>
                    <Box style={{ gridColumn: 'span 2' }}>
                      <Text as="div" size="2" weight="bold" mb="1" color="gray">Sistemas Associados</Text>
                      {(!ticket.associatedSystems || ticket.associatedSystems.length === 0) ? (
                        <Text as="div" size="2" color="gray">Nenhum sistema associado</Text>
                      ) : (
                        <Flex gap="2" wrap="wrap">
                          {ticket.associatedSystems.map((item, idx) => (
                            <Box key={idx} style={{ background: 'var(--gray-3)', padding: '4px 8px', borderRadius: '4px' }}>
                              <Text size="2" weight="bold">{item.system}</Text>
                              <Text size="2" color="gray" ml="2">{item.hours}h</Text>
                            </Box>
                          ))}
                        </Flex>
                      )}
                    </Box>

                    {ticket.board === 'atividades' && ticket.parentId && (
                      <Box>
                        <Text as="div" size="2" weight="bold" mb="1" color="gray">Demanda Pai</Text>
                        <Text as="div" size="3">{parentTicketInfo ? `${parentTicketInfo.code} - ${parentTicketInfo.title}` : ticket.parentId}</Text>
                      </Box>
                    )}

                    <Box>
                      <Text as="div" size="2" weight="bold" mb="1" color="gray">Horas Estimadas (Base)</Text>
                      <TextField.Root 
                        type="text"
                        placeholder="Sem estimativa..."
                        value={totalEstimatedHours > 0 ? `${totalEstimatedHours.toFixed(2)}h` : ''} 
                        readOnly
                        disabled
                      />
                    </Box>
                    <Box>
                      <Text as="div" size="2" weight="bold" mb="1" color="gray">Tags / Labels</Text>
                      <TextField.Root 
                        placeholder="frontend, ui, bug..."
                        value={labels} 
                        onChange={(e) => setLabels(e.target.value)}
                        onBlur={() => handleUpdateField('labels', labels)}
                        disabled={ticket.isAutoGenerated}
                      />
                    </Box>
                    <Box>
                      <Text as="div" size="2" weight="bold" mb="1" color="gray">Depende de (ID do Ticket)</Text>
                      <TextField.Root 
                        placeholder="Ex: TCK-123"
                        value={dependsOn} 
                        onChange={(e) => setDependsOn(e.target.value)}
                        onBlur={() => handleUpdateField('dependsOn', dependsOn)}
                        disabled={ticket.isAutoGenerated}
                      />
                    </Box>
                    <Box>
                      <Flex align="center" gap="2" mt="4">
                        <Switch 
                          checked={isBlocked} 
                          onCheckedChange={(checked) => {
                            setIsBlocked(checked);
                            handleUpdateField('isBlocked', checked);
                          }} 
                        />
                        <Text size="2" weight="bold" color={isBlocked ? "red" : "gray"}>
                          {isBlocked ? "Ticket Bloqueado" : "Marcar como Bloqueado"}
                        </Text>
                      </Flex>
                    </Box>
                  </Grid>

                </Flex>
                </ScrollArea>
              </Box>
            </Tabs.Content>

            {ticket.board !== 'atividades' && (
            <Tabs.Content value="subtasks" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Flex justify="between" align="center" mb="3">
                <Text size="2" color="gray">Atividades agrupadas dentro desta demanda</Text>
                <Button size="1" onClick={() => setIsSubtaskModalOpen(true)}>
                  <Plus size={14} /> Criar Atividade
                </Button>
              </Flex>
              <ScrollArea style={{ flexGrow: 1, height: '300px', paddingRight: '16px' }}>
                <Flex direction="column" gap="3">
                  {subtasks.length === 0 ? (
                    <Text color="gray" align="center" mt="5">Nenhuma atividade criada.</Text>
                  ) : (
                    subtasks.map(sub => (
                      <Card key={sub.id} size="1" style={{ borderLeft: `3px solid var(--primary)` }}>
                        <Flex justify="between" align="center">
                          <Box>
                            <Text size="1" color="indigo" weight="bold">{sub.code}</Text>
                            <Text as="div" size="2" weight="medium">{sub.title}</Text>
                          </Box>
                          <Badge color={sub.statusId === 'col-done' ? 'green' : 'blue'} variant="soft">
                            {sub.statusId?.replace('col-', '')}
                          </Badge>
                        </Flex>
                      </Card>
                    ))
                  )}
                </Flex>
              </ScrollArea>
            </Tabs.Content>
            )}

            <Tabs.Content value="attachments" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Flex justify="between" align="center" mb="3">
                <Text size="2" color="gray">Arquivos anexados a este ticket</Text>
                <label>
                  <Button as="span" size="1" disabled={uploading} style={{ cursor: 'pointer' }}>
                    {uploading ? <Loader2 size={14} className="spinner-icon" /> : <Paperclip size={14} />}
                    {uploading ? 'Enviando...' : 'Anexar Arquivo'}
                  </Button>
                  <input 
                    type="file" 
                    style={{ display: 'none' }} 
                    onChange={handleFileUpload} 
                    disabled={uploading}
                  />
                </label>
              </Flex>
              <ScrollArea style={{ flexGrow: 1, height: '300px', paddingRight: '16px' }}>
                <Flex direction="column" gap="3">
                  {attachments.length === 0 ? (
                    <Text color="gray" align="center" mt="5">Nenhum arquivo anexado.</Text>
                  ) : (
                    attachments.map(att => (
                      <Card key={att.id} size="1">
                        <Flex justify="between" align="center">
                          <Flex align="center" gap="3">
                            <File size={24} color="var(--primary)" />
                            <Box>
                              <Text as="div" size="2" weight="bold">{att.name}</Text>
                              <Text size="1" color="gray">
                                {(att.size / 1024).toFixed(1)} KB • {att.uploadedBy} • {att.createdAt?.toDate ? att.createdAt.toDate().toLocaleDateString() : 'Agora'}
                              </Text>
                            </Box>
                          </Flex>
                          <Button size="1" variant="soft" asChild>
                            <a href={att.url} target="_blank" rel="noopener noreferrer">
                              <Download size={14} /> Baixar
                            </a>
                          </Button>
                        </Flex>
                      </Card>
                    ))
                  )}
                </Flex>
              </ScrollArea>
            </Tabs.Content>

            <Tabs.Content value="history" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <ScrollArea style={{ flexGrow: 1, height: '300px', paddingRight: '16px' }}>
                <Flex direction="column" gap="3">
                  {history.length === 0 ? (
                    <Text color="gray" align="center" mt="5">Nenhum log de auditoria encontrado.</Text>
                  ) : (
                    history.map(log => (
                      <Card key={log.id} size="1" style={{ borderLeft: '3px solid var(--gray-7)' }}>
                        <Flex direction="column" gap="1">
                          <Flex justify="between">
                            <Text size="2" weight="bold" color="indigo">{log.userName}</Text>
                            <Text size="1" color="gray">
                              {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString() : 'Agora'}
                            </Text>
                          </Flex>
                          <Text size="2">{log.action}</Text>
                        </Flex>
                      </Card>
                    ))
                  )}
                </Flex>
              </ScrollArea>
            </Tabs.Content>

            {userRole === 'admin' && (
              <Tabs.Content value="time" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Card variant="surface" mb="4" style={{ background: 'var(--surface)', padding: '16px' }}>
                  <Text as="div" size="2" weight="bold" mb="2">Apontar Horas</Text>
                  <form onSubmit={handleAddWorkLog}>
                    <Flex gap="3" align="end">
                      <Box>
                        <Text as="div" size="1" color="gray" mb="1">Minutos</Text>
                        <TextField.Root 
                          type="number"
                          placeholder="Ex: 120"
                          value={timeSpent}
                          onChange={(e) => setTimeSpent(e.target.value)}
                          style={{ width: '100px' }}
                        />
                      </Box>
                      <Box style={{ flexGrow: 1 }}>
                        <Text as="div" size="1" color="gray" mb="1">Descrição / O que foi feito?</Text>
                        <TextField.Root 
                          placeholder="Desenvolvimento da tela XYZ..."
                          value={timeDesc}
                          onChange={(e) => setTimeDesc(e.target.value)}
                        />
                      </Box>
                      <Button type="submit" disabled={loading || !timeSpent}>
                        {loading ? <Loader2 size={16} className="spinner-icon" /> : <Clock size={16} />} 
                        Apontar
                      </Button>
                    </Flex>
                  </form>
                </Card>

                <ScrollArea style={{ flexGrow: 1, height: '200px', paddingRight: '16px' }}>
                  <Flex direction="column" gap="3">
                    {workLogs.length === 0 ? (
                      <Text color="gray" align="center" mt="5">Nenhum apontamento registrado.</Text>
                    ) : (
                      workLogs.map(log => (
                        <Card key={log.id} size="1">
                          <Flex justify="between" align="start">
                            <Box>
                              <Text size="2" weight="bold" color="indigo">{log.userName}</Text>
                              <Text as="div" size="2" mt="1">{log.description || 'Sem descrição'}</Text>
                            </Box>
                            <Box style={{ textAlign: 'right' }}>
                              <Badge color="orange">{log.timeSpentMinutes} min</Badge>
                              <Text as="div" size="1" color="gray" mt="1">
                                {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString() : 'Agora'}
                              </Text>
                            </Box>
                          </Flex>
                        </Card>
                      ))
                    )}
                  </Flex>
                </ScrollArea>
              </Tabs.Content>
            )}

          </Box>
        </Tabs.Root>
      </Dialog.Content>
      {isSubtaskModalOpen && (
        <NewTicketModal 
          isOpen={isSubtaskModalOpen} 
          onClose={() => setIsSubtaskModalOpen(false)} 
          parentId={ticket.id} 
        />
      )}
    </Dialog.Root>
  );
};

export default TicketDetailsModal;
