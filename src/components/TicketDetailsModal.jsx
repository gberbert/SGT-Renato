import React, { useState, useEffect } from 'react';
import { Dialog, Button, Flex, Text, TextArea, Badge, Tabs, Box, TextField, ScrollArea, Card, Switch, Grid, Select } from '@radix-ui/themes';
import { updateTicket, addComment, subscribeToComments, subscribeToSubtasks, uploadAttachment, subscribeToAttachments, subscribeToHistory, addWorkLog, subscribeToWorkLogs } from '../services/ticketService';
import { subscribeToProjects } from '../services/projectService';
import { subscribeToWorkflows, subscribeToCustomFields, subscribeToTicketTypes } from '../services/settingsService';
import { auth } from '../firebase';
import { Loader2, Send, Plus, Paperclip, File, Download, ShieldAlert, Sparkles, Clock } from 'lucide-react';
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
  const [storyPoints, setStoryPoints] = useState('');
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

  const [isSubtaskModalOpen, setIsSubtaskModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (ticket) {
      setDescription(ticket.description || '');
      setStartDate(ticket.startDate || '');
      setDeadline(ticket.deadline || '');
      setSprint(ticket.sprint || '');
      setStoryPoints(ticket.storyPoints || '');
      setLabels(ticket.labels || '');
      setDependsOn(ticket.dependsOn || '');
      setIsBlocked(ticket.isBlocked || false);
      setCustomData(ticket.customData || {});

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
      return () => {
        unsubscribeComments();
        unsubscribeSubtasks();
        unsubscribeAttachments();
        unsubscribeHistory();
        unsubscribeWorkLogs();
        unsubscribeProjects();
        unsubscribeWorkflows();
        unsubscribeCustomFields();
        unsubscribeTicketTypes();
      };
    }
  }, [ticket]);

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

  const handleSendComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
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
      <Dialog.Content maxWidth="700px" style={{ minHeight: '500px', display: 'flex', flexDirection: 'column' }}>
        <Flex justify="between" align="start" mb="4">
          <Box>
            <Text as="div" size="2" color="indigo" weight="bold">{ticket.code}</Text>
            <Dialog.Title mt="1">{ticket.title}</Dialog.Title>
          </Box>
          <Badge color={ticket.priority === 'critical' ? 'red' : 'blue'}>{ticket.type}</Badge>
        </Flex>

        <Tabs.Root defaultValue="details" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          <Tabs.List>
            <Tabs.Trigger value="details">Detalhes</Tabs.Trigger>
            <Tabs.Trigger value="subtasks">Sub-tarefas ({subtasks.length})</Tabs.Trigger>
            <Tabs.Trigger value="attachments">Anexos ({attachments.length})</Tabs.Trigger>
            <Tabs.Trigger value="comments">Comentários ({comments.length})</Tabs.Trigger>
            <Tabs.Trigger value="history">Histórico</Tabs.Trigger>
            {userRole === 'admin' && <Tabs.Trigger value="time">Tempo (Admin)</Tabs.Trigger>}
          </Tabs.List>

          <Box pt="4" style={{ flexGrow: 1, overflow: 'hidden' }}>
            <Tabs.Content value="details" style={{ height: '100%' }}>
              <ScrollArea style={{ height: '350px', paddingRight: '16px' }}>
                <Flex direction="column" gap="4">
                  <Box>
                    <Text as="div" size="2" weight="bold" mb="2">Descrição</Text>
                    <RichTextEditor 
                      content={description}
                      onChange={(val) => setDescription(val)}
                      onBlur={() => handleUpdateField('description', description)}
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
                    <Box>
                      <Text as="div" size="2" weight="bold" mb="1" color="gray">Responsável</Text>
                      <Text as="div" size="3">{ticket.assignee}</Text>
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
                      />
                    </Box>
                    <Box>
                      <Text as="div" size="2" weight="bold" mb="1" color="gray">Prazo (Deadline)</Text>
                      <TextField.Root 
                        type="date" 
                        value={deadline} 
                        onChange={(e) => setDeadline(e.target.value)}
                        onBlur={() => handleUpdateField('deadline', deadline)}
                      />
                    </Box>
                    <Box>
                      <Text as="div" size="2" weight="bold" mb="1" color="gray">Sprint</Text>
                      <TextField.Root 
                        placeholder="Ex: Sprint 4"
                        value={sprint} 
                        onChange={(e) => setSprint(e.target.value)}
                        onBlur={() => handleUpdateField('sprint', sprint)}
                      />
                    </Box>
                    <Box>
                      <Text as="div" size="2" weight="bold" mb="1" color="gray">Story Points</Text>
                      <TextField.Root 
                        type="number"
                        placeholder="Esforço (ex: 5)"
                        value={storyPoints} 
                        onChange={(e) => setStoryPoints(e.target.value)}
                        onBlur={() => handleUpdateField('storyPoints', storyPoints)}
                      />
                    </Box>
                    <Box>
                      <Text as="div" size="2" weight="bold" mb="1" color="gray">Tags / Labels</Text>
                      <TextField.Root 
                        placeholder="frontend, ui, bug..."
                        value={labels} 
                        onChange={(e) => setLabels(e.target.value)}
                        onBlur={() => handleUpdateField('labels', labels)}
                      />
                    </Box>
                    <Box>
                      <Text as="div" size="2" weight="bold" mb="1" color="gray">Depende de (ID do Ticket)</Text>
                      <TextField.Root 
                        placeholder="Ex: TCK-123"
                        value={dependsOn} 
                        onChange={(e) => setDependsOn(e.target.value)}
                        onBlur={() => handleUpdateField('dependsOn', dependsOn)}
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
            </Tabs.Content>

            <Tabs.Content value="subtasks" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Flex justify="between" align="center" mb="3">
                <Text size="2" color="gray">Tarefas agrupadas dentro deste ticket</Text>
                <Button size="1" onClick={() => setIsSubtaskModalOpen(true)}>
                  <Plus size={14} /> Criar Sub-tarefa
                </Button>
              </Flex>
              <ScrollArea style={{ flexGrow: 1, height: '300px', paddingRight: '16px' }}>
                <Flex direction="column" gap="3">
                  {subtasks.length === 0 ? (
                    <Text color="gray" align="center" mt="5">Nenhuma sub-tarefa criada.</Text>
                  ) : (
                    subtasks.map(sub => (
                      <Card key={sub.id} size="1" style={{ borderLeft: `3px solid var(--primary)` }}>
                        <Flex justify="between" align="center">
                          <Box>
                            <Text size="1" color="indigo" weight="bold">{sub.code}</Text>
                            <Text as="div" size="2" weight="medium">{sub.title}</Text>
                          </Box>
                          <Badge color={sub.columnId === 'col-done' ? 'green' : 'orange'}>
                            {sub.columnId === 'col-done' ? 'Concluída' : 'Pendente'}
                          </Badge>
                        </Flex>
                      </Card>
                    ))
                  )}
                </Flex>
              </ScrollArea>
            </Tabs.Content>

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

            <Tabs.Content value="comments" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <ScrollArea style={{ flexGrow: 1, height: '300px', paddingRight: '16px', marginBottom: '16px' }}>
                <Flex direction="column" gap="4">
                  {comments.length === 0 ? (
                    <Text color="gray" align="center" mt="5">Nenhum comentário ainda.</Text>
                  ) : (
                    comments.map(c => (
                      <Card key={c.id} size="1">
                        <Flex direction="column" gap="1">
                          <Flex justify="between">
                            <Text size="2" weight="bold">{c.authorName}</Text>
                            <Text size="1" color="gray">
                              {c.createdAt?.toDate ? c.createdAt.toDate().toLocaleString() : 'Agora'}
                            </Text>
                          </Flex>
                          <Text size="2">{c.text}</Text>
                        </Flex>
                      </Card>
                    ))
                  )}
                </Flex>
              </ScrollArea>

              <form onSubmit={handleSendComment}>
                <Flex gap="2">
                  <TextField.Root 
                    style={{ flexGrow: 1 }}
                    placeholder="Escreva um comentário..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                  />
                  <Button type="submit" disabled={!commentText.trim() || loading}>
                    {loading ? <Loader2 size={16} className="spinner-icon" /> : <Send size={16} />}
                  </Button>
                </Flex>
              </form>
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

        <Flex gap="3" mt="5" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray">Fechar</Button>
          </Dialog.Close>
        </Flex>
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
