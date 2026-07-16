import React, { useState, useEffect } from 'react';
import { Flex, Text, Table, Badge, Select, Card, Tabs, Button, IconButton } from '@radix-ui/themes';
import { KanbanSquare, Send, CheckCircle2 } from 'lucide-react';
import { subscribeToTickets } from '../services/ticketService';
import { subscribeToTShirts, updateTShirt } from '../services/tshirtService';
import { auth } from '../firebase';
import { subscribeToProjectSquads } from '../services/squadService';
import { subscribeToAllocations } from '../services/allocationService';

const TShirts = ({ userRole }) => {
  const [tickets, setTickets] = useState([]);
  const [tshirts, setTshirts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [globalSquads, setGlobalSquads] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [currentTab, setCurrentTab] = useState('pendente');

  useEffect(() => {
    let tLoaded = false;
    let tsLoaded = false;

    const unsubTickets = subscribeToTickets((data) => {
      // Filtrar apenas demandas
      setTickets(data.filter(t => t.board === 'demandas'));
      tLoaded = true;
      if (tsLoaded) setLoading(false);
    });

    const unsubTShirts = subscribeToTShirts((data) => {
      setTshirts(data);
      tsLoaded = true;
      if (tLoaded) setLoading(false);
    });

    const unsubSquads = subscribeToProjectSquads('all', setGlobalSquads, console.error);
    const unsubAllocations = subscribeToAllocations(setAllocations);

    return () => {
      unsubTickets();
      unsubTShirts();
      unsubSquads();
      unsubAllocations();
    };
  }, []);

  const handleSizeChange = async (tshirtId, newSize) => {
    await updateTShirt(tshirtId, { size: newSize });
  };

  const handleSendToReview = async (tshirtId) => {
    await updateTShirt(tshirtId, { executionStatus: 'em_revisao' });
  };

  if (loading) return <Flex p="4" justify="center"><Text>Carregando...</Text></Flex>;

  return (
    <div className="page-container">
      <Flex justify="between" align="center" mb="6">
        <Flex align="center" gap="3">
          <KanbanSquare size={32} className="text-primary" />
          <Text as="h1" size="6" weight="bold">T-Shirt Size</Text>
        </Flex>
      </Flex>

      <Flex mb="4">
        <Tabs.Root value={currentTab} onValueChange={setCurrentTab} style={{ width: '100%' }}>
          <Tabs.List>
            <Tabs.Trigger value="pendente">Pendentes</Tabs.Trigger>
            <Tabs.Trigger value="concluido">Concluídas</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      </Flex>

      <Card size="3" className="glass-panel">
        <div className="table-responsive">
          <Table.Root variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Ticket Externo</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Título</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>T-Shirt Size</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Responsável</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Última Atualização</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell align="right">Ações</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {tickets.filter(ticket => {
                const tshirt = tshirts.find(ts => ts.ticketId === ticket.id);
                if (!tshirt) return false;

                const execStatus = tshirt.executionStatus || 'pendente';
                const matchesTab = currentTab === 'concluido' ? execStatus === 'concluido' : execStatus !== 'concluido';
                if (!matchesTab) return false;

                if (userRole === 'admin') return true;
                
                const userName = auth.currentUser?.displayName || auth.currentUser?.email;
                if (userRole === 'user') {
                  const isAllocated = allocations.some(a => a.activityId === tshirt.id && a.userId === auth.currentUser?.uid);
                  return tshirt.assignee === userName || isAllocated;
                }
                
                if (userRole === 'squad_leader') {
                  const allowedSquadIds = globalSquads.filter(s => s.leaderId === auth.currentUser?.uid).map(s => s.id);
                  const tIds = ticket.squadIds || (ticket.squadId ? [ticket.squadId] : []);
                  if (!tIds.some(id => allowedSquadIds.includes(id))) return false;
                }
                
                return true;
              }).map(ticket => {
                const tshirt = tshirts.find(ts => ts.ticketId === ticket.id);
                const dateObj = tshirt.updatedAt ? tshirt.updatedAt.toDate() : tshirt.createdAt?.toDate() || new Date();

                return (
                  <Table.Row key={ticket.id} align="center">
                    <Table.Cell>
                      <Badge color="blue">{ticket.externalTicket || ticket.code}</Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Text weight="bold">{ticket.title}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Select.Root value={tshirt.size || ''} onValueChange={(val) => handleSizeChange(tshirt.id, val)}>
                        <Select.Trigger placeholder="Selecione o Tamanho" />
                        <Select.Content>
                          <Select.Item value="">Não Estimado</Select.Item>
                          <Select.Item value="PP">PP</Select.Item>
                          <Select.Item value="P">P</Select.Item>
                          <Select.Item value="M">M</Select.Item>
                          <Select.Item value="G">G</Select.Item>
                          <Select.Item value="GG">GG</Select.Item>
                        </Select.Content>
                      </Select.Root>
                    </Table.Cell>
                    <Table.Cell>{tshirt.assignee || 'Sem Responsável'}</Table.Cell>
                    <Table.Cell>{dateObj.toLocaleDateString('pt-BR')} às {dateObj.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</Table.Cell>
                    <Table.Cell align="right">
                      {tshirt.executionStatus === 'em_revisao' ? (
                        <Badge color="orange">Em Revisão</Badge>
                      ) : tshirt.executionStatus !== 'concluido' ? (
                        <Button variant="soft" size="1" onClick={() => handleSendToReview(tshirt.id)} disabled={!tshirt.size}>
                          <Send size={14} /> Enviar p/ Revisão
                        </Button>
                      ) : (
                        <Badge color="green"><CheckCircle2 size={14}/> Concluído</Badge>
                      )}
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </div>
      </Card>
    </div>
  );
};

export default TShirts;
