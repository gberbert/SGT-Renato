import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Flex, 
  Text, 
  Table, 
  Button, 
  Card,
  Heading,
  Spinner,
  IconButton,
  Tabs
} from '@radix-ui/themes';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import EstimationEditorModal from './EstimationEditorModal';
import EstimationRulesAdmin from './EstimationRulesAdmin';

const Estimations = () => {
  const [estimations, setEstimations] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [dbRules, setDbRules] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [estimationToEdit, setEstimationToEdit] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [estSnap, tksSnap, rulesSnap] = await Promise.all([
        getDocs(collection(db, 'estimations')),
        getDocs(collection(db, 'tickets')),
        getDocs(collection(db, 'estimationRules'))
      ]);

      setEstimations(estSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setTickets(tksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setDbRules(rulesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Erro ao carregar dados", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleNewEstimation = () => {
    setEstimationToEdit(null);
    setModalOpen(true);
  };

  const handleEditEstimation = (est) => {
    setEstimationToEdit(est);
    setModalOpen(true);
  };

  const handleDeleteEstimation = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir esta estimativa?")) {
      try {
        await deleteDoc(doc(db, 'estimations', id));
        setEstimations(estimations.filter(e => e.id !== id));
      } catch (error) {
        console.error("Erro ao deletar estimativa", error);
        alert("Erro ao excluir estimativa.");
      }
    }
  };

  const getTicketTitle = (ticketId) => {
    const tk = tickets.find(t => t.id === ticketId);
    return tk ? tk.title : ticketId;
  };

  if (loading) {
    return (
      <Flex justify="center" align="center" style={{ height: '100vh' }}>
        <Spinner size="3" />
      </Flex>
    );
  }

  return (
    <Box p="4">
      <Tabs.Root defaultValue="estimativas">
        <Tabs.List mb="4">
          <Tabs.Trigger value="estimativas">Minhas Estimativas</Tabs.Trigger>
          <Tabs.Trigger value="regras">Base de Conhecimento (Regras)</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="estimativas">
          <Flex justify="end" mb="4">
            <Button onClick={handleNewEstimation}>
              <Plus size={16} /> Nova Estimativa
            </Button>
          </Flex>

          <Card>
            <Table.Root variant="surface">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Demanda / Ticket</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Título</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Total Horas (Base)</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Última Atualização</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>Ações</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {estimations.length === 0 ? (
                  <Table.Row>
                    <Table.Cell colSpan={5} style={{ textAlign: 'center', padding: '32px' }}>
                      <Text color="gray">Nenhuma estimativa cadastrada. Clique em "Nova Estimativa".</Text>
                    </Table.Cell>
                  </Table.Row>
                ) : estimations.map(est => (
                  <Table.Row key={est.id}>
                    <Table.Cell>
                      <Text weight="bold">{getTicketTitle(est.ticketId)}</Text>
                    </Table.Cell>
                    <Table.Cell>{est.title}</Table.Cell>
                    <Table.Cell>
                      <Text color="indigo" weight="bold">{(est.totalBaseHours || 0).toFixed(2)}h</Text>
                    </Table.Cell>
                    <Table.Cell>
                      {est.updatedAt ? new Date(est.updatedAt).toLocaleDateString('pt-BR') : '-'}
                    </Table.Cell>
                    <Table.Cell style={{ textAlign: 'right' }}>
                      <Flex gap="2" justify="end">
                        <IconButton variant="ghost" color="blue" onClick={() => handleEditEstimation(est)}>
                          <Edit2 size={16} />
                        </IconButton>
                        <IconButton variant="ghost" color="red" onClick={() => handleDeleteEstimation(est.id)}>
                          <Trash2 size={16} />
                        </IconButton>
                      </Flex>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Card>
        </Tabs.Content>

        <Tabs.Content value="regras">
          <EstimationRulesAdmin dbRules={dbRules} onRulesChange={loadData} />
        </Tabs.Content>
      </Tabs.Root>

      <EstimationEditorModal 
        open={modalOpen} 
        onOpenChange={setModalOpen}
        dbRules={dbRules}
        tickets={tickets}
        estimationToEdit={estimationToEdit}
        onSaveSuccess={loadData}
      />
    </Box>
  );
};

export default Estimations;
