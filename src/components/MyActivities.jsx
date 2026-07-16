import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Flex, Text, Badge, Button, Tabs, Box, Grid, Table, IconButton } from '@radix-ui/themes';
import { FileText, Calculator, Shirt, FileCode, Clock, CheckCircle2, ArrowRight, LayoutList, LayoutGrid, Check } from 'lucide-react';
import { subscribeToAllocations } from '../services/allocationService';
import { subscribeToProjectSquads } from '../services/squadService';
import { subscribeToTickets, updateExecutionStatus } from '../services/ticketService';
import { subscribeToEstimations, subscribeToSpecifications, updateEstimationExecutionStatus, updateSpecExecutionStatus } from '../services/specService';
import { subscribeToTechSpecs, updateTechSpecExecutionStatus } from '../services/techSpecService';
import { subscribeToTShirts, updateTShirtExecutionStatus } from '../services/tshirtService';

const MyActivities = ({ user }) => {
  const [allocations, setAllocations] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [estimations, setEstimations] = useState([]);
  const [specifications, setSpecifications] = useState([]);
  const [techSpecs, setTechSpecs] = useState([]);
  const [tshirts, setTshirts] = useState([]);
  const [globalSquads, setGlobalSquads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState('pendente');
  const [viewMode, setViewMode] = useState('card');

  useEffect(() => {
    if (!user) return;

    const unsubAlloc = subscribeToAllocations(setAllocations);
    const unsubTickets = subscribeToTickets(setTickets);
    const unsubEstimations = subscribeToEstimations(setEstimations);
    const unsubSpecs = subscribeToSpecifications(setSpecifications);
    const unsubTechSpecs = subscribeToTechSpecs(setTechSpecs);
    const unsubTShirts = subscribeToTShirts(setTshirts);
    const unsubSquads = subscribeToProjectSquads('all', setGlobalSquads, console.error);

    setLoading(false);

    return () => {
      unsubAlloc();
      unsubTickets();
      unsubEstimations();
      unsubSpecs();
      unsubTechSpecs();
      unsubTShirts();
      unsubSquads();
    };
  }, [user]);

  if (!user) {
    return <Text color="red">Usuário não autenticado.</Text>;
  }

  // Filter allocations for the current user
  const myAllocations = allocations.filter(a => a.userId === user.uid);

  // Group allocations by activityId
  const groupedAllocations = {};
  myAllocations.forEach(alloc => {
    if (!groupedAllocations[alloc.activityId]) {
      groupedAllocations[alloc.activityId] = {
        activityId: alloc.activityId,
        activityType: alloc.activityType,
        totalHours: 0,
        dates: [],
        createdAt: alloc.createdAt?.toDate ? alloc.createdAt.toDate() : new Date(alloc.createdAt || Date.now()),
        assignerName: alloc.assignerName || 'Sistema'
      };
    }
    groupedAllocations[alloc.activityId].totalHours += parseFloat(alloc.hours || 0);
    groupedAllocations[alloc.activityId].dates.push(new Date(`${alloc.date}T12:00:00Z`));
    const allocDate = alloc.createdAt?.toDate ? alloc.createdAt.toDate() : new Date(alloc.createdAt || Date.now());
    if (allocDate < groupedAllocations[alloc.activityId].createdAt) {
      groupedAllocations[alloc.activityId].createdAt = allocDate;
      groupedAllocations[alloc.activityId].assignerName = alloc.assignerName || 'Sistema';
    }
  });

  const leaderSquads = globalSquads.filter(s => s.leaderId === user.uid);
  const leaderSquadIds = leaderSquads.map(s => s.id);

  if (leaderSquadIds.length > 0) {
    const addReviewItem = (item, type, titlePrefix, typeDisplay, icon) => {
      if (!groupedAllocations[item.id]) {
        const dDate = item.updatedAt?.toDate ? item.updatedAt.toDate() : (item.createdAt?.toDate ? item.createdAt.toDate() : new Date());
        groupedAllocations[item.id] = {
          activityId: item.id,
          activityType: type,
          totalHours: item.totalBaseHours || 0,
          dates: [dDate],
          createdAt: dDate,
          assignerName: item.authorName || item.assignee || 'Usuário',
          executionStatus: item.executionStatus,
          isReview: true,
          forcedTitle: titlePrefix,
          forcedTypeDisplay: typeDisplay,
          forcedIcon: icon
        };
      } else {
        groupedAllocations[item.id].isReview = true;
      }
    };

    tshirts.forEach(ts => {
      if (ts.executionStatus === 'em_revisao' || ts.executionStatus === 'concluido') {
        const dem = tickets.find(t => t.id === ts.ticketId);
        if (dem && (dem.squadIds?.some(id => leaderSquadIds.includes(id)) || leaderSquadIds.includes(dem.squadId))) addReviewItem(ts, 'tshirt', `T-Shirt: ${dem.title}`, 'Aprovação: T-Shirt', <Shirt size={16} color="var(--orange-9)" />);
      }
    });

    estimations.forEach(est => {
      if (est.executionStatus === 'em_revisao' || est.executionStatus === 'concluido') {
        const dem = tickets.find(t => t.id === est.ticketId);
        if (dem && (dem.squadIds?.some(id => leaderSquadIds.includes(id)) || leaderSquadIds.includes(dem.squadId))) addReviewItem(est, 'estimativa', `Estimativa: ${dem.title}`, 'Aprovação: Estimativa', <Calculator size={16} color="var(--orange-9)" />);
      }
    });

    specifications.forEach(spec => {
      if (spec.executionStatus === 'em_revisao' || spec.executionStatus === 'concluido') {
        const parentEstimativa = estimations.find(e => e.id === spec.parentId);
        const dem = tickets.find(t => t.id === parentEstimativa?.ticketId);
        if (dem && (dem.squadIds?.some(id => leaderSquadIds.includes(id)) || leaderSquadIds.includes(dem.squadId))) addReviewItem(spec, 'ef', spec.title, 'Aprovação: Espec. Funcional', <FileText size={16} color="var(--orange-9)" />);
      }
    });

    techSpecs.forEach(spec => {
      if (spec.executionStatus === 'em_revisao' || spec.executionStatus === 'concluido') {
        const parentEstimativa = estimations.find(e => e.id === spec.parentId);
        const dem = tickets.find(t => t.id === parentEstimativa?.ticketId);
        if (dem && (dem.squadIds?.some(id => leaderSquadIds.includes(id)) || leaderSquadIds.includes(dem.squadId))) addReviewItem(spec, 'et', spec.title, 'Aprovação: Espec. Técnica', <FileCode size={16} color="var(--orange-9)" />);
      }
    });
  }

  const activitiesList = Object.values(groupedAllocations).map(group => {
    let title = 'Atividade Não Encontrada';
    let typeDisplay = 'Desconhecido';
    let icon = <Clock size={16} />;
    let executionStatus = 'pendente';
    if (group.activityType === 'atividade') {
      const act = tickets.find(t => t.id === group.activityId);
      title = act ? act.title : title;
      executionStatus = act ? (act.executionStatus || 'pendente') : 'pendente';
      const actBoard = act ? (act.board || 'demandas') : 'demandas';
      const isDemanda = actBoard === 'demandas';
      typeDisplay = isDemanda ? 'Demanda' : 'Desenvolvimento';
      icon = <Check size={16} color="var(--indigo-9)" />;
      group.actualBoard = isDemanda ? 'demandas' : 'atividades';
    } else if (group.activityType === 'estimativa') {
      const est = estimations.find(e => e.id === group.activityId);
      const dem = tickets.find(t => t.id === est?.ticketId);
      title = dem ? `Estimativa: ${dem.title}` : 'Estimativa de Esforço';
      executionStatus = est ? (est.executionStatus || 'pendente') : 'pendente';
      typeDisplay = 'Estimativa';
      icon = <Calculator size={16} color="var(--cyan-9)" />;
    } else if (group.activityType === 'ef') {
      const ef = specifications.find(s => s.id === group.activityId);
      title = ef ? ef.title : title;
      executionStatus = ef ? (ef.executionStatus || 'pendente') : 'pendente';
      typeDisplay = 'Espec. Funcional';
      icon = <FileText size={16} color="var(--blue-9)" />;
    } else if (group.activityType === 'et') {
      const et = techSpecs.find(ts => ts.id === group.activityId);
      title = et ? et.title : title;
      executionStatus = et ? (et.executionStatus || 'pendente') : 'pendente';
      typeDisplay = 'Espec. Técnica';
      icon = <FileCode size={16} color="var(--violet-9)" />;
    } else if (group.activityType === 'tshirt') {
      const ts = tshirts.find(t => t.id === group.activityId);
      const dem = tickets.find(t => t.id === ts?.ticketId);
      title = dem ? `T-Shirt: ${dem.title}` : 'T-Shirt Size';
      executionStatus = ts ? (ts.executionStatus || 'pendente') : 'pendente';
      typeDisplay = 'T-Shirt';
      icon = <Shirt size={16} color="var(--pink-9)" />;
    }

    const deliveryDate = new Date(Math.max(...group.dates.map(d => d.getTime())));

    return {
      ...group,
      title: group.forcedTitle || title,
      typeDisplay: group.forcedTypeDisplay || typeDisplay,
      icon: group.forcedIcon || icon,
      deliveryDate,
      executionStatus: group.executionStatus || executionStatus
    };
  });

  activitiesList.sort((a, b) => {
    const timeA = isNaN(a.deliveryDate.getTime()) ? 0 : a.deliveryDate.getTime();
    const timeB = isNaN(b.deliveryDate.getTime()) ? 0 : b.deliveryDate.getTime();
    return timeA - timeB;
  });

  const navigate = useNavigate();

  const handleExecuteAction = (item) => {
    if (item.activityType === 'atividade') {
      navigate(item.actualBoard === 'demandas' ? '/demandas' : '/atividades');
    } else if (item.activityType === 'estimativa') {
      navigate('/estimativas');
    } else if (item.activityType === 'ef' || item.activityType === 'et') {
      navigate('/especificacoes');
    } else if (item.activityType === 'tshirt') {
      navigate('/t-shirt');
    }
  };

  const handleApprove = async (item, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!confirm('Deseja aprovar este item?')) return;
    
    try {
      if (item.activityType === 'tshirt') await updateTShirtExecutionStatus(item.activityId, 'concluido');
      else if (item.activityType === 'estimativa') await updateEstimationExecutionStatus(item.activityId, 'concluido');
      else if (item.activityType === 'ef') await updateSpecExecutionStatus(item.activityId, 'concluido');
      else if (item.activityType === 'et') await updateTechSpecExecutionStatus(item.activityId, 'concluido');
    } catch (err) {
      console.error(err);
      alert('Erro ao aprovar.');
    }
  };

  const filteredActivities = activitiesList.filter(a => a.executionStatus === currentTab || (currentTab === 'pendente' && a.executionStatus === 'em_revisao'));

  return (
    <div className="view-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="welcome-banner" style={{ marginBottom: 0 }}>
        <Text as="h1" size="6" weight="bold">Minhas Atividades</Text>
        <Text as="p" size="3" color="gray">Consulte e execute as atividades atribuídas a você.</Text>
      </div>

      <Flex justify="between" align="center" mb="4">
        <Tabs.Root value={currentTab} onValueChange={setCurrentTab} style={{ width: '100%' }}>
          <Flex justify="between" align="center">
            <Tabs.List>
              <Tabs.Trigger value="pendente">
                Pendentes <Badge color="indigo" variant="soft" ml="2">{activitiesList.filter(a => a.executionStatus === 'pendente' || a.executionStatus === 'em_revisao').length}</Badge>
              </Tabs.Trigger>
              <Tabs.Trigger value="concluido">
                Concluídas <Badge color="green" variant="soft" ml="2">{activitiesList.filter(a => a.executionStatus === 'concluido').length}</Badge>
              </Tabs.Trigger>
            </Tabs.List>
            
            <Flex gap="2">
              <IconButton 
                variant={viewMode === 'list' ? 'soft' : 'ghost'} 
                color={viewMode === 'list' ? 'indigo' : 'gray'}
                onClick={() => setViewMode('list')}
                title="Visualização em Lista"
              >
                <LayoutList size={18} />
              </IconButton>
              <IconButton 
                variant={viewMode === 'card' ? 'soft' : 'ghost'} 
                color={viewMode === 'card' ? 'indigo' : 'gray'}
                onClick={() => setViewMode('card')}
                title="Visualização em Cards"
              >
                <LayoutGrid size={18} />
              </IconButton>
            </Flex>
          </Flex>

          <Box pt="4">
          {loading ? (
            <Text color="gray">Carregando suas atividades...</Text>
          ) : filteredActivities.length === 0 ? (
            <Card size="3" variant="surface" style={{ textAlign: 'center', padding: '40px' }}>
              <CheckCircle2 size={48} color="var(--gray-8)" style={{ margin: '0 auto 16px' }} />
              <Text as="div" size="4" weight="bold" mb="2">Tudo limpo por aqui!</Text>
              <Text color="gray">
                {currentTab === 'pendente' 
                  ? 'Você não tem nenhuma atividade pendente no momento.' 
                  : 'Você ainda não possui atividades concluídas.'}
              </Text>
            </Card>
          ) : viewMode === 'list' ? (
            <Card size="3" variant="surface">
              <Table.Root variant="surface">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>Tipo</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Título</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Quem atribuiu</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Tempo</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Prazo</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell align="right">Ação</Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {filteredActivities.map(item => {
                    const now = new Date();
                    now.setHours(0,0,0,0);
                    const isLate = !isNaN(item.deliveryDate.getTime()) && item.deliveryDate < now && item.executionStatus === 'pendente';
                    
                    return (
                      <Table.Row key={item.activityId} align="center">
                        <Table.Cell>
                          <Flex align="center" gap="2">
                            {item.icon}
                            <Text size="2" weight="bold">{item.typeDisplay}</Text>
                          </Flex>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="2">{item.title}</Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge color="gray" variant="soft">{item.assignerName}</Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge color="blue" variant="soft">{item.totalHours}h</Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge color={item.executionStatus === 'concluido' ? 'green' : (isLate ? 'red' : 'green')} variant="soft">
                            {(!isNaN(item.deliveryDate.getTime())) ? item.deliveryDate.toLocaleDateString('pt-BR') : '-'}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell justify="end">
                          <Flex gap="2" justify="end">
                            {item.isReview && item.executionStatus === 'em_revisao' && (
                              <Button 
                                size="1" 
                                color="green" 
                                variant="solid" 
                                onClick={(e) => handleApprove(item, e)}
                                title="Aprovar"
                              >
                                <Check size={14} /> Aprovar
                              </Button>
                            )}
                            <Button 
                              size="1"
                              color="indigo" 
                              variant={item.executionStatus === 'concluido' ? 'soft' : 'solid'}
                              style={{ cursor: 'pointer' }}
                              onClick={() => handleExecuteAction(item)}
                            >
                              <ArrowRight size={14} style={{ marginRight: '4px' }} /> 
                              Ir
                            </Button>
                          </Flex>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Root>
            </Card>
          ) : (
            <Grid columns="repeat(auto-fill, minmax(320px, 1fr))" gap="4">
              {filteredActivities.map(item => {
                const now = new Date();
                now.setHours(0,0,0,0);
                const isLate = !isNaN(item.deliveryDate.getTime()) && item.deliveryDate < now && item.executionStatus === 'pendente';

                return (
                  <Card key={item.activityId} size="2" variant="surface">
                    <Flex direction="column" gap="3" style={{ height: '100%' }}>
                      <Flex justify="between" align="start">
                        <Flex gap="2" align="center">
                          {item.icon}
                          <Text size="1" weight="bold" color="gray">{item.typeDisplay}</Text>
                        </Flex>
                        <Badge color="blue" variant="soft">{item.totalHours}h</Badge>
                      </Flex>
                      
                      <Text as="div" size="3" weight="bold" style={{ flexGrow: 1 }}>
                        {item.title}
                      </Text>
                      
                      <Flex direction="column" gap="1" mt="2">
                        <Text size="1" color="gray">
                          Atribuído por: <Text weight="bold">{item.assignerName}</Text>
                        </Text>
                        <Flex align="center" gap="2">
                          <Text size="1" color="gray">Prazo:</Text>
                          <Badge color={item.executionStatus === 'concluido' ? 'green' : (isLate ? 'red' : 'green')} variant="soft">
                            {(!isNaN(item.deliveryDate.getTime())) ? item.deliveryDate.toLocaleDateString('pt-BR') : '-'}
                          </Badge>
                        </Flex>
                      </Flex>

                      <Box mt="2" style={{ borderTop: '1px solid var(--gray-4)', paddingTop: '12px' }}>
                        <Flex gap="2">
                          <Button 
                            color="indigo" 
                            variant={item.executionStatus === 'concluido' ? 'soft' : 'solid'}
                            style={{ flexGrow: 1, cursor: 'pointer' }}
                            onClick={() => handleExecuteAction(item)}
                          >
                            <ArrowRight size={16} style={{ marginRight: '8px' }} /> 
                            Ir para a Tarefa
                          </Button>
                          {item.isReview && item.executionStatus === 'em_revisao' && (
                            <Button 
                              color="green" 
                              variant="solid" 
                              onClick={(e) => handleApprove(item, e)}
                              title="Aprovar"
                            >
                              <Check size={16} />
                            </Button>
                          )}
                        </Flex>
                      </Box>
                    </Flex>
                  </Card>
                );
              })}
            </Grid>
          )}
        </Box>
        </Tabs.Root>
      </Flex>
    </div>
  );
};

export default MyActivities;
