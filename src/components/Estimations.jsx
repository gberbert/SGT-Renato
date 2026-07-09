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
import { Plus, Edit2, Trash2, FileText } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs, deleteDoc, doc, getDoc } from 'firebase/firestore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import EstimationEditorModal from './EstimationEditorModal';
import EstimationRulesAdmin from './EstimationRulesAdmin';

const Estimations = () => {
  const [estimations, setEstimations] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [dbRules, setDbRules] = useState([]);
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [estimationToEdit, setEstimationToEdit] = useState(null);

  // Filtros e Paginação
  const [ticketFilter, setTicketFilter] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  const loadData = async () => {
    setLoading(true);
    try {
      const [estSnap, tksSnap, rulesSnap, sysSnap] = await Promise.all([
        getDocs(collection(db, 'estimations')),
        getDocs(collection(db, 'tickets')),
        getDocs(collection(db, 'estimationRules')),
        getDocs(collection(db, 'systems'))
      ]);

      setEstimations(estSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setTickets(tksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setDbRules(rulesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setSystems(sysSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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

  const handleExportPDF = async (est) => {
    try {
      // 1. Fetch Ticket
      const ticketRef = doc(db, 'tickets', est.ticketId);
      const ticketSnap = await getDoc(ticketRef);
      let ticketData = { title: est.ticketId };
      let gerenteGeral = 'Não informado';
      
      if (ticketSnap.exists()) {
        ticketData = ticketSnap.data();
        // 2. Fetch Project if exists
        if (ticketData.projectId) {
          const projRef = doc(db, 'projects', ticketData.projectId);
          const projSnap = await getDoc(projRef);
          if (projSnap.exists() && projSnap.data().gerenteGeral) {
            gerenteGeral = projSnap.data().gerenteGeral;
          }
        }
      }

      // 3. Gerar PDF
      const docPdf = new jsPDF();
      
      // Cabeçalho
      docPdf.setFillColor(0, 84, 166); // NTT DATA Blue
      docPdf.rect(0, 0, 210, 30, 'F');
      
      docPdf.setTextColor(255, 255, 255);
      docPdf.setFontSize(22);
      docPdf.setFont("helvetica", "bold");
      docPdf.text("NTT DATA", 14, 20);
      
      docPdf.setFontSize(12);
      docPdf.setFont("helvetica", "normal");
      docPdf.text("Relatório de Estimativa de Demanda", 196, 20, { align: "right" });
      
      // Metadados
      docPdf.setTextColor(0, 0, 0);
      docPdf.setFontSize(10);
      const today = new Date();
      docPdf.text(`Data da Geração: ${today.toLocaleDateString('pt-BR')} ${today.toLocaleTimeString('pt-BR')}`, 14, 40);
      docPdf.text(`Demanda: ${ticketData.title || ticketData.id || est.ticketId}`, 14, 47);
      docPdf.text(`Sistema: ${est.system || 'N/A'}`, 14, 54);
      docPdf.text(`Responsável: ${gerenteGeral}`, 14, 61);
      docPdf.text(`Autor da Estimativa: ${est.authorName || 'Desconhecido'}`, 14, 68);

      let currentY = 82;

      // Introdução e Defesa Técnica
      docPdf.setFontSize(12);
      docPdf.setFont("helvetica", "bold");
      docPdf.text("Introdução e Fundamentação Metodológica", 14, currentY);
      currentY += 7;

      const introText = "A estimativa de esforço deste projeto reflete uma disciplina de engenharia de alta complexidade. A precificação não se limita à escrita de código, englobando todo o ciclo de vida do software para garantir previsibilidade e qualidade.\n\nA distribuição de esforço adotada está plenamente alinhada com as melhores práticas globais da indústria, sustentada por modelos como o COCOMO II, métricas do ISBSG, RUP e diretrizes do PMI. Conforme a Curva de Boehm, o investimento em especificação e design mitiga custos exponenciais de correção de defeitos.\n\nA alocação para Construção e Testes garante uma arquitetura robusta (onde a codificação pura representa apenas de 20% a 30% do esforço, segundo Pressman). Os percentuais desta estimativa são a tradução matemática das metodologias mundiais, configurando uma proposta técnica, sólida e transparente.";
      
      docPdf.setFontSize(9);
      docPdf.setFont("helvetica", "normal");
      const splitIntro = docPdf.splitTextToSize(introText, 180);
      docPdf.text(splitIntro, 14, currentY);
      currentY += (splitIntro.length * 4.5) + 10;

      // Descrição Macro
      docPdf.setFontSize(12);
      docPdf.setFont("helvetica", "bold");
      docPdf.text("Descrição da Demanda", 14, currentY);
      currentY += 7;
      
      docPdf.setFontSize(10);
      docPdf.setFont("helvetica", "normal");
      const splitDesc = docPdf.splitTextToSize(est.macroDescription || 'Nenhuma descrição fornecida.', 180);
      docPdf.text(splitDesc, 14, currentY);
      currentY += (splitDesc.length * 5) + 10;

      // Consolidado por Fase
      docPdf.setFontSize(12);
      docPdf.setFont("helvetica", "bold");
      docPdf.text("Consolidado de Horas por Fase", 14, currentY);
      currentY += 5;

      // Recalcular consolidado
      const PHASE_DISTRIBUTION = {
        SR: 0.089,
        EF: 0.199,
        ET: 0.081,
        Construcao: 0.415,
        TestesUnitarios: 0.165,
        Homologacao: 0.051
      };

      // Funções de Cálculo
      const getRuleBaseHours = (tech, type, comp, compx) => {
        const rule = dbRules.find(r => r.tecnologia === tech && r.tipo === type && r.componente === comp);
        if (rule && rule[compx] !== undefined) {
          return parseFloat(rule[compx]) || 0;
        }
        return 0;
      };

      const calculateRowPhases = (row) => {
        const unitHours = getRuleBaseHours(row.technology, row.type, row.element, row.complexity);
        const base = unitHours * parseInt(row.quantity || 1);
        
        return {
          SR: base * PHASE_DISTRIBUTION.SR,
          EF: base * PHASE_DISTRIBUTION.EF,
          ET: base * PHASE_DISTRIBUTION.ET,
          Construcao: base * PHASE_DISTRIBUTION.Construcao,
          TestesUnitarios: base * PHASE_DISTRIBUTION.TestesUnitarios,
          Homologacao: base * PHASE_DISTRIBUTION.Homologacao,
          Total: base
        };
      };

      let sumSR = 0, sumEF = 0, sumET = 0, sumConst = 0, sumTestes = 0, sumHom = 0;
      (est.rows || []).forEach(r => {
        const phases = calculateRowPhases(r);
        sumSR += phases.SR;
        sumEF += phases.EF;
        sumET += phases.ET;
        sumConst += phases.Construcao;
        sumTestes += phases.TestesUnitarios;
        sumHom += phases.Homologacao;
      });

      autoTable(docPdf, {
        startY: currentY,
        head: [['Fase', 'Horas Estimadas']],
        body: [
          ['Especificação de Requisitos (SR) - 8.9%', sumSR.toFixed(2)],
          ['Especificação Funcional (EF) - 19.9%', sumEF.toFixed(2)],
          ['Especificação Técnica (ET) - 8.1%', sumET.toFixed(2)],
          ['Construção - 41.5%', sumConst.toFixed(2)],
          ['Testes Unitários - 16.5%', sumTestes.toFixed(2)],
          ['Homologação - 5.1%', sumHom.toFixed(2)],
        ],
        foot: [['Total Geral', est.totalBaseHours ? est.totalBaseHours.toFixed(2) : '0.00']],
        theme: 'striped',
        headStyles: { fillColor: [0, 84, 166] },
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
      });
      
      currentY = docPdf.lastAutoTable.finalY + 15;

      // Lista de Funcionalidades
      docPdf.setFontSize(12);
      docPdf.setFont("helvetica", "bold");
      docPdf.text("Lista de Funcionalidades (Detalhamento)", 14, currentY);
      currentY += 5;

      const featuresBody = (est.rows || []).map(r => [
        r.technology || '',
        r.element || '',
        r.complexity || '',
        calculateRowPhases(r).Total.toFixed(2)
      ]);

      autoTable(docPdf, {
        startY: currentY,
        head: [['Tecnologia', 'Componente', 'Complexidade', 'Total Base (h)']],
        body: featuresBody,
        theme: 'grid',
        headStyles: { fillColor: [100, 100, 100] }
      });

      // Rodapé
      const pageCount = docPdf.internal.getNumberOfPages();
      for(let i = 1; i <= pageCount; i++) {
        docPdf.setPage(i);
        docPdf.setFontSize(8);
        docPdf.setTextColor(150);
        docPdf.text(`NTT DATA - Gerado pelo SGT | Página ${i} de ${pageCount}`, 14, 290);
      }

      docPdf.save(`NTT_DATA_Estimativa_${ticketData.code || est.ticketId}.pdf`);

    } catch (err) {
      console.error("Erro ao gerar PDF", err);
      alert("Erro ao gerar PDF.");
    }
  };

  const getTicketTitle = (ticketId) => {
    const tk = tickets.find(t => t.id === ticketId);
    return tk ? tk.title : ticketId;
  };

  const filteredEstimations = estimations.filter(est => {
    const ticketTitle = getTicketTitle(est.ticketId).toLowerCase();
    const ticketId = (est.ticketId || '').toLowerCase();
    const author = (est.authorName || '').toLowerCase();
    
    const matchesTicket = !ticketFilter || ticketTitle.includes(ticketFilter.toLowerCase()) || ticketId.includes(ticketFilter.toLowerCase());
    const matchesAuthor = !authorFilter || author.includes(authorFilter.toLowerCase());
    
    return matchesTicket && matchesAuthor;
  });

  const totalPages = Math.ceil(filteredEstimations.length / ITEMS_PER_PAGE);
  const paginatedEstimations = filteredEstimations.slice(
    (currentPage - 1) * ITEMS_PER_PAGE, 
    currentPage * ITEMS_PER_PAGE
  );

  const handleFilterChange = (setter) => (e) => {
    setter(e.target.value);
    setCurrentPage(1);
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
          <Flex justify="between" align="end" mb="4" gap="4">
            <Flex gap="3" flexGrow="1">
              <Box style={{ flex: 1, maxWidth: '300px' }}>
                <Text as="div" size="2" mb="1" weight="bold">Filtrar por Demanda</Text>
                <input 
                  type="text"
                  placeholder="ID ou Título da Demanda..."
                  value={ticketFilter}
                  onChange={handleFilterChange(setTicketFilter)}
                  style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid var(--gray-6)', backgroundColor: 'var(--gray-2)', color: 'var(--gray-12)' }}
                />
              </Box>
              <Box style={{ flex: 1, maxWidth: '300px' }}>
                <Text as="div" size="2" mb="1" weight="bold">Filtrar por Responsável</Text>
                <input 
                  type="text"
                  placeholder="Nome do Responsável..."
                  value={authorFilter}
                  onChange={handleFilterChange(setAuthorFilter)}
                  style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid var(--gray-6)', backgroundColor: 'var(--gray-2)', color: 'var(--gray-12)' }}
                />
              </Box>
            </Flex>
            <Button onClick={handleNewEstimation}>
              <Plus size={16} /> Nova Estimativa
            </Button>
          </Flex>

          <Card>
            <Table.Root variant="surface">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Demanda / Ticket</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Responsável</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Total Horas (Base)</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Última Atualização</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>Ações</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {paginatedEstimations.length === 0 ? (
                  <Table.Row>
                    <Table.Cell colSpan={5} style={{ textAlign: 'center', padding: '32px' }}>
                      <Text color="gray">Nenhuma estimativa encontrada para os filtros aplicados.</Text>
                    </Table.Cell>
                  </Table.Row>
                ) : paginatedEstimations.map(est => (
                  <Table.Row key={est.id}>
                    <Table.Cell>
                      <Text weight="bold">{getTicketTitle(est.ticketId)}</Text>
                    </Table.Cell>
                    <Table.Cell>{est.authorName || 'Desconhecido'}</Table.Cell>
                    <Table.Cell>
                      <Text color="indigo" weight="bold">{(est.totalBaseHours || 0).toFixed(2)}h</Text>
                    </Table.Cell>
                    <Table.Cell>
                      {est.updatedAt ? new Date(est.updatedAt).toLocaleDateString('pt-BR') : '-'}
                    </Table.Cell>
                    <Table.Cell style={{ textAlign: 'right' }}>
                      <Flex gap="2" justify="end">
                        <IconButton size="1" variant="ghost" color="indigo" onClick={() => handleExportPDF(est)} title="Gerar PDF NTT DATA">
                          <FileText size={16} />
                        </IconButton>
                        <IconButton size="1" variant="ghost" onClick={() => handleEditEstimation(est)}>
                          <Edit2 size={16} />
                        </IconButton>
                        <IconButton size="1" variant="ghost" color="red" onClick={() => handleDeleteEstimation(est.id)}>
                          <Trash2 size={16} />
                        </IconButton>
                      </Flex>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
            
            {totalPages > 1 && (
              <Flex justify="center" align="center" gap="4" p="3" style={{ borderTop: '1px solid var(--gray-5)' }}>
                <Button 
                  variant="soft" 
                  disabled={currentPage === 1} 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <Text size="2" color="gray">
                  Página <Text weight="bold">{currentPage}</Text> de {totalPages}
                </Text>
                <Button 
                  variant="soft" 
                  disabled={currentPage === totalPages} 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                >
                  Próxima
                </Button>
              </Flex>
            )}
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
        systems={systems}
        tickets={tickets}
        estimations={estimations}
        estimationToEdit={estimationToEdit}
        onSaveSuccess={loadData}
      />
    </Box>
  );
};

export default Estimations;
