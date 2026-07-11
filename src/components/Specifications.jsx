import React, { useState, useEffect } from 'react';
import { Flex, Text, Button, Table, Badge, IconButton, Box, Card, TextArea, Tabs } from '@radix-ui/themes';
import { Plus, FileText, Trash2, Download, Send, CheckCircle2 } from 'lucide-react';
import { subscribeToSpecifications, subscribeToEstimations, deleteSpecification, updateSpecExecutionStatus } from '../services/specService';
import { subscribeToTickets } from '../services/ticketService';
import { subscribeToAllocations } from '../services/allocationService';
import { subscribeToAISettings, saveAISettings } from '../services/settingsService';
import SpecificationGeneratorModal from './SpecificationGeneratorModal';
import SpecificationViewerModal from './SpecificationViewerModal';
import PdfExportWizard from './PdfExportWizard';
import { auth } from '../firebase';
import { subscribeToProjectSquads } from '../services/squadService';
import { subscribeToProjects } from '../services/projectService';

const Specifications = ({ userRole }) => {
  const [specs, setSpecs] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [estimations, setEstimations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [globalSquads, setGlobalSquads] = useState([]);
  const [projects, setProjects] = useState([]);
  const [allocations, setAllocations] = useState([]);
  
  const [aiSettings, setAiSettings] = useState({ efInitialPrompt: '' });
  const [savingAi, setSavingAi] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  
  const [viewerOpen, setViewerOpen] = useState(false);
  const [exportWizardOpen, setExportWizardOpen] = useState(false);
  const [currentSpec, setCurrentSpec] = useState(null);
  const [currentTab, setCurrentTab] = useState('pendente');

  useEffect(() => {
    let specsLoaded = false;
    let ticketsLoaded = false;
    let estimationsLoaded = false;
    let aiLoaded = false;

    const checkLoading = () => {
      if (specsLoaded && ticketsLoaded && estimationsLoaded && aiLoaded) setLoading(false);
    };

    const unsubSpecs = subscribeToSpecifications((data) => {
      setSpecs(data);
      specsLoaded = true;
      checkLoading();
    });

    const unsubTickets = subscribeToTickets((data) => {
      setTickets(data);
      ticketsLoaded = true;
      checkLoading();
    });

    const unsubEstimations = subscribeToEstimations((data) => {
      setEstimations(data);
      estimationsLoaded = true;
      checkLoading();
    });

    const unsubAi = subscribeToAISettings((data) => {
      if (data) setAiSettings(data);
      aiLoaded = true;
      checkLoading();
    });

    const unsubSquads = subscribeToProjectSquads('all', setGlobalSquads, console.error);
    const unsubProjects = subscribeToProjects(setProjects, console.error);
    const unsubAllocations = subscribeToAllocations(setAllocations);

    return () => {
      unsubSpecs();
      unsubTickets();
      unsubEstimations();
      unsubAi();
      unsubSquads();
      unsubProjects();
      unsubAllocations();
    };
  }, []);

  const handleDelete = async (id) => {
    if (confirm("Tem certeza que deseja excluir esta Especificação Funcional?")) {
      await deleteSpecification(id);
    }
  };

  const handleEdit = (spec) => {
    setCurrentSpec(spec);
    setIsGeneratorOpen(true);
  };

  const handleSendToReview = async (specId) => {
    try {
      await updateSpecExecutionStatus(specId, 'em_revisao');
    } catch (error) {
      console.error(error);
      alert('Erro ao enviar para revisão.');
    }
  };

  const handleSaveAiConfig = async () => {
    setSavingAi(true);
    try {
      await saveAISettings(aiSettings);
      alert("Configurações padrão salvas com sucesso!");
    } catch (err) {
      alert("Erro ao salvar as configurações.");
    } finally {
      setSavingAi(false);
    }
  };

  return (
    <div className="view-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="welcome-banner" style={{ marginBottom: 0 }}>
        <Flex justify="between" align="center" wrap="wrap" gap="4">
          <Box>
            <Text as="h1" size="6" weight="bold">Especificações Funcionais</Text>
            <Text as="p" size="3" color="gray">Gere e gerencie documentações funcionais com Inteligência Artificial.</Text>
          </Box>
          <Flex gap="3">
            {userRole === 'admin' && (
              <Button variant="soft" size="3" onClick={() => setShowConfig(!showConfig)}>
                Configurações da IA
              </Button>
            )}
              <Button size="3" onClick={() => { setCurrentSpec(null); setIsGeneratorOpen(true); }} style={{ cursor: 'pointer', background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', color: 'white' }}>
                <Plus size={18} /> Nova Espec. Func.
              </Button>
          </Flex>
        </Flex>
      </div>

      {userRole === 'admin' && showConfig && (
        <Card size="3" className="glass-panel" mb="4">
          <Text as="h2" size="4" weight="bold" mb="4">Padrões de Geração (Admin)</Text>
          <Flex direction="column" gap="4">
            <label>
              <Text as="div" size="2" mb="1" weight="bold">Prompt Inicial Padrão</Text>
              <TextArea 
                placeholder="Instruções comportamentais da IA..."
                value={aiSettings.efInitialPrompt || ''}
                onChange={(e) => setAiSettings({...aiSettings, efInitialPrompt: e.target.value})}
                style={{ minHeight: '100px' }}
              />
            </label>

            <Flex justify="end" mt="2">
              <Button onClick={handleSaveAiConfig} disabled={savingAi}>
                {savingAi ? "Salvando..." : "Salvar Padrões"}
              </Button>
            </Flex>
          </Flex>
        </Card>
      )}

      <Flex mb="4">
        <Tabs.Root value={currentTab} onValueChange={setCurrentTab} style={{ width: '100%' }}>
          <Tabs.List>
            <Tabs.Trigger value="pendente">Pendentes</Tabs.Trigger>
            <Tabs.Trigger value="concluido">Concluídas</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      </Flex>

      <div className="table-container glass-panel">
        <Table.Root variant="surface">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Título</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Estimativa Pai</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Demanda</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Responsável</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Data</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell align="right">Ações</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {loading ? (
              <Table.Row>
                <Table.Cell colSpan={6} style={{ textAlign: 'center', padding: '24px' }}>
                  Carregando especificações...
                </Table.Cell>
              </Table.Row>
            ) : specs.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  Nenhuma especificação funcional gerada ainda.
                </Table.Cell>
              </Table.Row>
            ) : specs.filter(spec => {
              if (userRole === 'admin') return true;
              
              const parentEstimativa = estimations.find(e => e.id === spec.parentId);
              const parentDemanda = tickets.find(t => t.id === parentEstimativa?.ticketId);
              const userName = auth.currentUser?.displayName || auth.currentUser?.email;

              if (userRole === 'user') {
                const isAllocated = allocations.some(a => a.activityId === spec.id && a.userId === auth.currentUser?.uid);
                return (spec.assignee === userName || spec.authorName === userName || isAllocated);
              }
              
              if (userRole === 'squad_leader') {
                const allowedSquadIds = globalSquads.filter(s => s.leaderId === auth.currentUser?.uid).map(s => s.id);
                if (!parentDemanda || !allowedSquadIds.includes(parentDemanda.squadId)) return false;
              }
              
              const execStatus = spec.executionStatus || 'pendente';
              if (currentTab === 'concluido') {
                return execStatus === 'concluido';
              } else {
                return execStatus !== 'concluido';
              }
            }).map(spec => {
              const parentEstimativa = estimations.find(e => e.id === spec.parentId);
              const parentDemanda = tickets.find(t => t.id === parentEstimativa?.ticketId);
              const dateObj = spec.createdAt?.toDate ? spec.createdAt.toDate() : new Date();

              return (
                <Table.Row key={spec.id} align="center">
                  <Table.Cell>
                    <Flex align="center" gap="2">
                      <FileText size={16} color="var(--primary)" />
                      <Text weight="bold">{spec.title}</Text>
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    {parentEstimativa ? (
                      <Badge color="green">
                        {parentEstimativa.ticketCode?.startsWith('EST-') 
                          ? parentEstimativa.ticketCode 
                          : `EST-${parentDemanda ? (parentDemanda.externalTicket || parentDemanda.code) : parentEstimativa.ticketCode}`}
                      </Badge>
                    ) : (
                      <Text color="gray">Orfã</Text>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    {parentDemanda ? (
                      <Badge color="blue">{parentDemanda.externalTicket || parentDemanda.code}</Badge>
                    ) : (
                      <Text color="gray">-</Text>
                    )}
                  </Table.Cell>
                  <Table.Cell>{spec.assignee || spec.authorName || 'Desconhecido'}</Table.Cell>
                  <Table.Cell>{dateObj.toLocaleDateString('pt-BR')} às {dateObj.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</Table.Cell>
                  <Table.Cell align="right">
                    <Flex gap="2" justify="end">
                      {spec.executionStatus === 'em_revisao' ? (
                        <Badge color="orange">Em Revisão</Badge>
                      ) : spec.executionStatus !== 'concluido' ? (
                        <Button variant="soft" size="1" onClick={() => handleSendToReview(spec.id)}>
                          <Send size={14} /> Revisão
                        </Button>
                      ) : (
                        <Badge color="green"><CheckCircle2 size={14}/> Concluído</Badge>
                      )}
                      <Button variant="soft" color="indigo" size="1" onClick={() => { setCurrentSpec(spec); setExportWizardOpen(true); }}>
                        <Download size={14} /> PDF
                      </Button>
                      <Button variant="soft" size="1" onClick={() => handleEdit(spec)}>Editar</Button>
                      <IconButton color="red" variant="soft" size="1" onClick={() => handleDelete(spec.id)}>
                        <Trash2 size={14} />
                      </IconButton>
                    </Flex>
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Root>
      </div>

      <SpecificationGeneratorModal 
        isOpen={isGeneratorOpen} 
        onClose={() => { setIsGeneratorOpen(false); setCurrentSpec(null); }} 
        tickets={tickets}
        estimations={estimations}
        userRole={userRole}
        initialSpec={currentSpec}
        projects={projects}
        squads={globalSquads}
      />

      <SpecificationViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        spec={currentSpec}
        estimations={estimations}
        tickets={tickets}
        projects={projects}
        squads={globalSquads}
      />

      <PdfExportWizard
        isOpen={exportWizardOpen}
        onClose={() => setExportWizardOpen(false)}
        spec={currentSpec}
        parentEstimativa={estimations.find(e => e.id === currentSpec?.parentId)}
        parentDemanda={tickets.find(t => t.id === estimations.find(e => e.id === currentSpec?.parentId)?.ticketId)}
        projects={projects}
        squads={globalSquads}
      />
    </div>
  );
};

export default Specifications;
