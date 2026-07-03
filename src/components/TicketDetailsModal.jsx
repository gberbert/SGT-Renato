import React, { useState, useEffect } from 'react';
import { Dialog, Button, Flex, Text, TextArea, Badge, Tabs, Box, TextField, ScrollArea, Card } from '@radix-ui/themes';
import { updateTicket, addComment, subscribeToComments, subscribeToSubtasks, uploadAttachment, subscribeToAttachments } from '../services/ticketService';
import { auth } from '../firebase';
import { Loader2, Send, Plus, Paperclip, File, Download } from 'lucide-react';
import NewTicketModal from './NewTicketModal';

const TicketDetailsModal = ({ isOpen, onClose, ticket }) => {
  const [description, setDescription] = useState('');
  const [commentText, setCommentText] = useState('');
  const [startDate, setStartDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [comments, setComments] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [isSubtaskModalOpen, setIsSubtaskModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (ticket) {
      setDescription(ticket.description || '');
      setStartDate(ticket.startDate || '');
      setDeadline(ticket.deadline || '');
      const unsubscribeComments = subscribeToComments(ticket.id, (data) => {
        setComments(data);
      });
      const unsubscribeSubtasks = subscribeToSubtasks(ticket.id, (data) => {
        setSubtasks(data);
      });
      const unsubscribeAttachments = subscribeToAttachments(ticket.id, (data) => {
        setAttachments(data);
      });
      return () => {
        unsubscribeComments();
        unsubscribeSubtasks();
        unsubscribeAttachments();
      };
    }
  }, [ticket]);

  if (!isOpen || !ticket) return null;

  const handleUpdateField = async (field, value) => {
    if (ticket[field] === value) return;
    try {
      await updateTicket(ticket.id, { [field]: value });
    } catch (err) {
      console.error(err);
    }
  };

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
          </Tabs.List>

          <Box pt="4" style={{ flexGrow: 1, overflow: 'hidden' }}>
            <Tabs.Content value="details" style={{ height: '100%' }}>
              <ScrollArea style={{ height: '350px', paddingRight: '16px' }}>
                <Flex direction="column" gap="4">
                  <Box>
                    <Text as="div" size="2" weight="bold" mb="2">Descrição</Text>
                    <TextArea 
                      size="3" 
                      placeholder="Adicione uma descrição rica aqui..." 
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onBlur={() => handleUpdateField('description', description)}
                      style={{ minHeight: '150px' }}
                    />
                  </Box>

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
                      <Text as="div" size="2" weight="bold" mb="1" color="gray">Prazo de Entrega (Deadline)</Text>
                      <TextField.Root 
                        type="date" 
                        value={deadline} 
                        onChange={(e) => setDeadline(e.target.value)}
                        onBlur={() => handleUpdateField('deadline', deadline)}
                      />
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
