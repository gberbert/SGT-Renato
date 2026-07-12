import React, { useState, useEffect } from 'react';
import { Flex, Text, Card, Badge, Button, Box, Table, Avatar, ScrollArea, IconButton, Dialog, TextField, Select } from '@radix-ui/themes';
import { subscribeToTickets, updateTicketStatus, updateTicketAssignee, updatePlanningStatus, createTicket, deleteTicket } from '../services/ticketService';
import { subscribeToEstimations, subscribeToSpecifications, updateEstimationPlanningStatus, updateSpecPlanningStatus } from '../services/specService';
import { subscribeToTechSpecs, updateTechSpecPlanningStatus } from '../services/techSpecService';
import { subscribeToTShirts, updateTShirtPlanningStatus } from '../services/tshirtService';
import { subscribeToProjectSquads } from '../services/squadService';
import { subscribeToUsers } from '../services/settingsService';
import { subscribeToAllocations, allocateActivity, unallocateActivity, isWorkingDay, adjustAllocationHours } from '../services/allocationService';
import { auth, db } from '../firebase';
import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import { DndContext, useDraggable, useDroppable, DragOverlay } from '@dnd-kit/core';
import { Calendar, Users, ChevronLeft, ArrowRight, CheckCircle2, X, ChevronDown, ChevronUp, Plus, Minus } from 'lucide-react';
import UserDetailsModal from './UserDetailsModal';

const DraggableActivity = ({ id, activity, children }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `draggable-${id}`,
    data: { activity }
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ opacity: isDragging ? 0.5 : 1, cursor: 'grab' }}>
      {children}
    </div>
  );
};

const DroppableCell = ({ id, children, isOver }) => {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} style={{ 
      minHeight: '48px', 
      height: '100%',
      padding: '4px', 
      border: '1px dashed var(--gray-6)', 
      backgroundColor: isOver ? 'var(--gray-3)' : 'transparent',
      borderRadius: '4px',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between'
    }}>
      {children}
    </div>
  );
};

const CapacityPlanning = ({ userRole }) => {
  const [tickets, setTickets] = useState([]);
  const [estimations, setEstimations] = useState([]);
  const [specifications, setSpecifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [squads, setSquads] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [techSpecs, setTechSpecs] = useState([]);
  const [tshirts, setTshirts] = useState([]);

  const [selectedDemanda, setSelectedDemanda] = useState(null);
  const [activeDragItem, setActiveDragItem] = useState(null);
  const [calendarStartDate, setCalendarStartDate] = useState(() => new Date());
  const [isPendingExpanded, setIsPendingExpanded] = useState(true);
  const [selectedCellInfo, setSelectedCellInfo] = useState(null);
  const [selectedUserForModal, setSelectedUserForModal] = useState(null);
  const [newActivityTitle, setNewActivityTitle] = useState('');
  const [newActivityHours, setNewActivityHours] = useState('');
  const [isRecurrent, setIsRecurrent] = useState(false);
  const [recurrentEndDate, setRecurrentEndDate] = useState('');
  const [includeWeekends, setIncludeWeekends] = useState(false);

  const shiftCalendar = (days) => {
    setCalendarStartDate(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + days);
      return next;
    });
  };

  useEffect(() => {
    const unsubTickets = subscribeToTickets(setTickets);
    const unsubEstimations = subscribeToEstimations(setEstimations);
    const unsubSpecs = subscribeToSpecifications(setSpecifications);
    const unsubUsers = subscribeToUsers(setUsers);
    const unsubSquads = subscribeToProjectSquads('all', setSquads, console.error);
    const unsubAlloc = subscribeToAllocations(setAllocations);
    const unsubTechSpecs = subscribeToTechSpecs(setTechSpecs);
    const unsubTShirts = subscribeToTShirts(setTshirts);

    return () => {
      unsubTickets();
      unsubEstimations();
      unsubSpecs();
      unsubUsers();
      unsubSquads();
      unsubAlloc();
      unsubTechSpecs();
      unsubTShirts();
    };
  }, []);

  if (userRole !== 'admin' && userRole !== 'squad_leader') {
    return <Text color="red">Acesso negado.</Text>;
  }

  const isLeader = userRole === 'squad_leader' && auth.currentUser;
  const allowedSquadIds = isLeader ? squads.filter(s => s.leaderId === auth.currentUser.uid).map(s => s.id) : [];

  // --- View 1: List of Pending Demandas ---
  let demands = tickets.filter(t => (t.board || 'demandas') === 'demandas' && t.columnId !== 'col-done' && t.columnId !== 'col-concluido');
  
  if (isLeader) {
    demands = demands.filter(d => allowedSquadIds.includes(d.squadId));
  }
  
  const demandsWithPendingActivities = demands.filter(d => {
    const ests = estimations.filter(e => e.ticketId === d.id);
    const efs = specifications.filter(s => ests.some(e => e.id === s.parentId));
    const ets = techSpecs.filter(ts => ests.some(e => e.id === ts.parentId));
    const tshs = tshirts.filter(ts => ts.ticketId === d.id);
    const ativs = tickets.filter(t => t.board === 'atividades' && t.parentId === d.id);
    
    // Check if any is unassigned or not planned
    const hasPendingEst = ests.some(e => !e.assignee || e.planningStatus !== 'Planejada');
    const hasPendingEf = efs.some(ef => ef.authorName === 'Não Atribuído' || ef.planningStatus !== 'Planejada');
    const hasPendingEt = ets.some(et => et.authorName === 'Não Atribuído' || et.planningStatus !== 'Planejada');
    const hasPendingTshirt = tshs.some(ts => ts.assignee === 'Não Atribuído' || ts.planningStatus !== 'Planejada');
    const hasPendingAtiv = ativs.some(a => !a.assignee || a.assignee === 'Sem responsável' || a.planningStatus !== 'Planejada');

    return hasPendingEst || hasPendingEf || hasPendingEt || hasPendingTshirt || hasPendingAtiv;
  });

  const handleDragStart = (event) => {
    const { active } = event;
    setActiveDragItem(active.data.current.activity);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveDragItem(null);
    if (!over) return;

    const activity = active.data.current.activity;
    const [userId, dateStr] = over.id.split('|'); // format: userId|YYYY-MM-DD
    const assignedUser = users.find(u => u.id === userId);
    const userName = assignedUser ? (assignedUser.displayName || assignedUser.shortName || assignedUser.name || assignedUser.email || userId) : userId;

    let isForcedHE = false;
    const targetDateObj = new Date(`${dateStr}T12:00:00Z`);
    if (!isWorkingDay(targetDateObj)) {
      if (!window.confirm("Este é um dia não útil (sábado, domingo ou feriado). Deseja executar esta atividade em horas extras?")) {
        return;
      }
      isForcedHE = true;
    }

    try {
      const hours = activity.hours || 8;
      const assignerName = auth.currentUser?.displayName || auth.currentUser?.email || 'Sistema';
      
      await allocateActivity(activity.id, activity.type, hours, userId, dateStr, allocations, isForcedHE, assignerName);

      // Update planningStatus on the correct service based on type
      if (activity.type === 'atividade') {
        await updatePlanningStatus(activity.id, 'Planejada');
        // Also ensure assignee is saved on the ticket
        await updateTicketAssignee(activity.id, userName);
      } else if (activity.type === 'estimativa') {
        await updateEstimationPlanningStatus(activity.id, 'Planejada', userName);
      } else if (activity.type === 'ef') {
        await updateSpecPlanningStatus(activity.id, 'Planejada', userName);
      } else if (activity.type === 'et') {
        await updateTechSpecPlanningStatus(activity.id, 'Planejada', userName);
      } else if (activity.type === 'tshirt') {
        await updateTShirtPlanningStatus(activity.id, 'Planejada', userName);
      }
      
      // Verification for Demanda Pai completion
      if (selectedDemanda && selectedDemanda !== 'all') {
        if (pendingActivities.length === 1 && pendingActivities[0].id === activity.id) {
          // Last one just got planned! Update Demanda Pai
          await updatePlanningStatus(selectedDemanda.id, 'Planejada');
        }
      }

      // alert("Alocação concluída com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Erro na alocação");
    }
  };

  const handleUnallocate = async (activityId, activityType) => {
    const activityObj = allActivities.find(a => a.id === activityId);
    const isAvulsa = activityObj && activityObj.type === 'atividade' && (!activityObj.original.parentId);

    if (isAvulsa) {
      if (!window.confirm("Deseja realmente excluir esta atividade avulsa? Ela será removida permanentemente do sistema.")) return;
    } else {
      if (!window.confirm("Deseja realmente remover o planejamento desta atividade? Todas as horas alocadas serão apagadas e ela voltará para a lista de pendentes.")) return;
    }
    
    try {
      await unallocateActivity(activityId);
      
      if (activityType === 'atividade') {
        if (isAvulsa) {
          try {
            await deleteTicket(activityId);
          } catch(err) { console.warn('Atividade avulsa pode já ter sido excluída', err); }
        } else {
          try {
            await updatePlanningStatus(activityId, 'Pendente');
            await updateTicketAssignee(activityId, 'Sem responsável');
          } catch(err) { console.warn('Atividade pode já ter sido excluída', err); }
        }
      } else if (activityType === 'estimativa') {
        try {
          await updateEstimationPlanningStatus(activityId, 'Pendente', 'Não Atribuído');
        } catch(err) { console.warn('Estimativa pode já ter sido excluída', err); }
      } else if (activityType === 'ef') {
        try {
          await updateSpecPlanningStatus(activityId, 'Pendente', 'Não Atribuído');
        } catch(err) { console.warn('EF pode já ter sido excluída', err); }
      } else if (activityType === 'et') {
        try {
          await updateTechSpecPlanningStatus(activityId, 'Pendente', 'Não Atribuído');
        } catch(err) { console.warn('ET pode já ter sido excluída', err); }
      } else if (activityType === 'tshirt') {
        try {
          await updateTShirtPlanningStatus(activityId, 'Pendente', 'Não Atribuído');
        } catch(err) { console.warn('T-Shirt pode já ter sido excluída', err); }
      }
      
      // alert("Planejamento removido!");
    } catch (e) {
      console.error(e);
      alert("Erro ao remover planejamento.");
    }
  };

  const handleAddAvulsa = async () => {
    if (!newActivityTitle || !newActivityHours) return alert("Preencha o título e as horas da nova atividade.");
    const hours = parseInt(newActivityHours, 10);
    if (isNaN(hours) || hours <= 0) return alert("Horas inválidas");

    try {
      const ticketData = {
        title: newActivityTitle,
        board: 'atividades',
        estimatedHours: hours,
        assignee: selectedCellInfo.userId,
        columnId: 'col-todo',
        planningStatus: 'Planejada',
        status: 'A Fazer'
      };
      
      const activityId = await createTicket(ticketData);

      const batch = writeBatch(db);

      if (isRecurrent && recurrentEndDate) {
        let currentDate = new Date(`${selectedCellInfo.dateStr}T12:00:00Z`);
        const endDateObj = new Date(`${recurrentEndDate}T12:00:00Z`);
        
        while (currentDate <= endDateObj) {
          const isWorkDay = isWorkingDay(currentDate);
          if (includeWeekends || isWorkDay) {
            const allocRef = doc(collection(db, 'allocations'));
            batch.set(allocRef, {
              id: allocRef.id,
              activityId,
              activityType: 'atividade',
              userId: selectedCellInfo.userId,
              date: currentDate.toISOString().split('T')[0],
              hours: hours,
              assignerName: auth.currentUser?.displayName || auth.currentUser?.email || 'Sistema',
              createdAt: new Date()
            });
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
      } else {
        const allocRef = doc(collection(db, 'allocations'));
        batch.set(allocRef, {
          id: allocRef.id,
          activityId,
          activityType: 'atividade',
          userId: selectedCellInfo.userId,
          date: selectedCellInfo.dateStr,
          hours: hours,
          assignerName: auth.currentUser?.displayName || auth.currentUser?.email || 'Sistema',
          createdAt: new Date()
        });
      }

      await batch.commit();

      setNewActivityTitle('');
      setNewActivityHours('');
      setIsRecurrent(false);
      setRecurrentEndDate('');
      setIncludeWeekends(false);
    } catch (e) {
      console.error(e);
      alert("Erro ao criar nova atividade");
    }
  };

  if (!selectedDemanda) {
    return (
      <div className="view-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="welcome-banner" style={{ marginBottom: 0 }}>
          <Text as="h1" size="6" weight="bold">Planejamento de Capacidade</Text>
          <Text as="p" size="3" color="gray">Aloque recursos e planeje o cronograma das squads.</Text>
        </div>

        <Card size="3" className="glass-panel">
          <Flex justify="between" align="center" mb="4">
            <Text as="h2" size="4" weight="bold">Demandas Pendentes de Alocação</Text>
            <Button onClick={() => setSelectedDemanda('all')} color="indigo" variant="soft">
              <Calendar size={16} style={{ marginRight: '8px' }} /> Ver Calendário Geral
            </Button>
          </Flex>
          <Table.Root variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Demanda</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Squad</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Prioridade</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell align="right">Ações</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {demandsWithPendingActivities.map(d => {
                const sq = squads.find(s => s.id === d.squadId);
                return (
                  <Table.Row key={d.id} align="center">
                    <Table.Cell>
                      <Flex align="center" gap="2">
                        <Badge color="blue">{d.code}</Badge>
                        <Text weight="bold">{d.title}</Text>
                      </Flex>
                    </Table.Cell>
                    <Table.Cell>{sq?.name || '-'}</Table.Cell>
                    <Table.Cell>
                      <Badge color={d.priority === 'high' ? 'red' : d.priority === 'medium' ? 'orange' : 'green'}>
                        {d.priority === 'high' ? 'Alta' : d.priority === 'medium' ? 'Média' : 'Baixa'}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell align="right">
                      <Button variant="soft" onClick={() => setSelectedDemanda(d)}>Planejar</Button>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
              {demandsWithPendingActivities.length === 0 && (
                <Table.Row>
                  <Table.Cell colSpan={4} style={{ textAlign: 'center', padding: '24px' }}>
                    Todas as demandas estão devidamente alocadas!
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Root>
        </Card>
      </div>
    );
  }

  // --- View 2: Detailed Allocation Calendar ---

  // Gather Activities for selected Demanda
  let dEsts = [];
  let dEfs = [];
  let dEts = [];
  let dTshs = [];
  let dAtivs = [];

  if (selectedDemanda === 'all') {
    dEsts = estimations;
    dEfs = specifications;
    dEts = techSpecs;
    dTshs = tshirts;
    dAtivs = tickets.filter(t => t.board === 'atividades');
  } else {
    dEsts = estimations.filter(e => e.ticketId === selectedDemanda.id);
    dEfs = specifications.filter(s => dEsts.some(e => e.id === s.parentId));
    dEts = techSpecs.filter(ts => dEsts.some(e => e.id === ts.parentId));
    dTshs = tshirts.filter(ts => ts.ticketId === selectedDemanda.id);
    dAtivs = tickets.filter(t => t.board === 'atividades' && t.parentId === selectedDemanda.id);
  }

  const allActivities = [];
  const pushedAtivIds = new Set();
  const pushedEfIds = new Set();
  const pushedEtIds = new Set();

  dTshs.forEach(ts => {
    const dem = tickets.find(t => t.id === ts.ticketId);
    if (!dem) return;
    const demandaSystems = (dem.associatedSystems && dem.associatedSystems.length > 0) 
      ? dem.associatedSystems.map(s => s.system).join(', ') 
      : dem.system;
    allActivities.push({ id: ts.id, type: 'tshirt', title: 'T-Shirt', hours: 1, original: ts, planningStatus: ts.planningStatus || 'Pendente', assignee: ts.assignee, demandaCode: dem.code, sistema: demandaSystems });
  });

  dEsts.forEach(est => {
    const dem = tickets.find(t => t.id === est.ticketId);
    if (!dem) return;
    const dCode = dem.code;

    allActivities.push({ id: est.id, type: 'estimativa', title: 'Estimativa de Esforço', hours: 1, original: est, planningStatus: est.planningStatus || 'Pendente', demandaCode: dCode, sistema: est.system || est.sistema });
    
    const efHours = est.sumEF ? Math.round(est.sumEF * 0.3) : 8;
    const ativHours = est.sumEt ? Math.round(est.sumEt * 0.3) : 8;

    const relatedEfs = dEfs.filter(ef => ef.parentId === est.id);
    const relatedEts = dEts.filter(et => et.parentId === est.id);
    const relatedAtivs = dAtivs.filter(a => a.parentId === dem.id && !pushedAtivIds.has(a.id));
    
    const demandaSystems = (dem.associatedSystems && dem.associatedSystems.length > 0) 
      ? dem.associatedSystems.map(s => s.system).join(', ') 
      : dem.system;

    allActivities.push(
      ...relatedEfs.map(ef => { pushedEfIds.add(ef.id); return { id: ef.id, type: 'ef', title: ef.title, hours: efHours, original: ef, planningStatus: ef.planningStatus || 'Pendente', assignee: ef.assignee || ef.authorName || 'Não Atribuído', demandaCode: dCode, sistema: est.system || est.sistema } }),
      ...relatedEts.map(et => { pushedEtIds.add(et.id); return { id: et.id, type: 'et', title: et.title, hours: 8, original: et, planningStatus: et.planningStatus || 'Pendente', assignee: et.assignee || et.authorName || 'Não Atribuído', demandaCode: dCode, sistema: est.system || est.sistema } }),
      ...relatedAtivs.map(a => { pushedAtivIds.add(a.id); return { id: a.id, type: 'atividade', title: a.title, hours: a.estimatedHours || ativHours, original: a, planningStatus: a.planningStatus || 'Pendente', assignee: a.assignee || 'Sem responsável', demandaCode: dCode, sistema: (a.associatedSystems && a.associatedSystems.length > 0) ? a.associatedSystems.map(s => s.system).join(', ') : (a.system || demandaSystems) } })
    );
  });

  // Push remaining orphan/avulsa activities
  dAtivs.forEach(a => {
    if (!pushedAtivIds.has(a.id)) {
      const dem = tickets.find(t => t.id === a.parentId);
      const demandaSystems = (dem?.associatedSystems && dem.associatedSystems.length > 0) 
        ? dem.associatedSystems.map(s => s.system).join(', ') 
        : dem?.system || '';
      allActivities.push({ id: a.id, type: 'atividade', title: a.title, hours: a.estimatedHours || 8, original: a, planningStatus: a.planningStatus || 'Pendente', assignee: a.assignee, demandaCode: dem?.code || 'Orfã/Avulsa', sistema: (a.associatedSystems && a.associatedSystems.length > 0) ? a.associatedSystems.map(s => s.system).join(', ') : (a.system || demandaSystems) });
    }
  });

  dEfs.forEach(ef => {
    if (!pushedEfIds.has(ef.id)) {
      allActivities.push({ id: ef.id, type: 'ef', title: ef.title, hours: 8, original: ef, planningStatus: ef.planningStatus || 'Pendente', assignee: ef.assignee || ef.authorName || 'Não Atribuído', demandaCode: 'Orfã', sistema: '' });
    }
  });

  dEts.forEach(et => {
    if (!pushedEtIds.has(et.id)) {
      allActivities.push({ id: et.id, type: 'et', title: et.title, hours: 8, original: et, planningStatus: et.planningStatus || 'Pendente', assignee: et.assignee || et.authorName || 'Não Atribuído', demandaCode: 'Orfã', sistema: '' });
    }
  });

  const pendingActivities = allActivities.filter(a => {
    if (a.type === 'atividade') return !a.assignee || a.assignee === 'Sem responsável' || a.planningStatus !== 'Planejada';
    if (a.type === 'ef') return !a.assignee || a.assignee === 'Não Atribuído' || a.planningStatus !== 'Planejada';
    if (a.type === 'et') return !a.assignee || a.assignee === 'Não Atribuído' || a.planningStatus !== 'Planejada';
    if (a.type === 'tshirt') return !a.assignee || a.assignee === 'Não Atribuído' || a.planningStatus !== 'Planejada';
    return !a.assignee || !a.original.assignee || a.planningStatus !== 'Planejada';
  });

  // Get Squad members
  let squadMembers = [];
  if (selectedDemanda === 'all') {
    if (isLeader) {
      squadMembers = users.filter(u => {
        return squads.filter(s => allowedSquadIds.includes(s.id)).some(s => {
          const inUsers = s.users?.some(su => su.id === u.id);
          const inMembers = s.members?.includes(u.id);
          return inUsers || inMembers || u.squadId === s.id;
        });
      });
    } else {
      squadMembers = users;
    }
  } else {
    const squad = squads.find(s => s.id === selectedDemanda.squadId);
    squadMembers = users.filter(u => {
      const inUsers = squad?.users?.some(su => su.id === u.id);
      const inMembers = squad?.members?.includes(u.id);
      return inUsers || inMembers || u.squadId === squad?.id;
    });
  }

  // Generate Next 14 Days
  const days = [];
  let curr = new Date(calendarStartDate);
  for (let i = 0; i < 14; i++) {
    days.push(curr.toISOString().split('T')[0]);
    curr.setDate(curr.getDate() + 1);
  }

  return (
    <div className="view-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      <Flex justify="between" align="center" style={{ backgroundColor: 'var(--gray-2)', padding: '12px 16px', borderRadius: '8px' }}>
        <Flex align="center" gap="4">
          <Button variant="soft" color="gray" onClick={() => setSelectedDemanda(null)}>
            <ChevronLeft size={16} /> Voltar
          </Button>
          <Text size="5" weight="bold">Planejamento: {selectedDemanda === 'all' ? 'Calendário Geral' : selectedDemanda.code}</Text>
        </Flex>
        {pendingActivities.length > 0 && (
          <Badge 
            color="blue" 
            variant="soft" 
            size="2" 
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            onClick={() => setIsPendingExpanded(!isPendingExpanded)}
          >
            Atividades Pendentes ({pendingActivities.length})
            {isPendingExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Badge>
        )}
      </Flex>

      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* Top: Unallocated Activities */}
        {pendingActivities.length > 0 && isPendingExpanded && (
          <ScrollArea style={{ maxHeight: '140px', paddingBottom: '8px' }}>
            <Flex gap="2" wrap="wrap" style={{ padding: '4px' }}>
              {pendingActivities.map(a => (
                <DraggableActivity key={a.id} id={a.id} activity={a}>
                  <Card size="1" style={{ minWidth: '200px', maxWidth: '200px', backgroundColor: 'var(--surface)', padding: '8px', cursor: 'grab' }}>
                    <Flex align="center" justify="between" mb="1" wrap="wrap" gap="1">
                      <Flex align="center" gap="1">
                        <Badge color={a.type === 'atividade' ? 'blue' : 'green'} style={{ fontSize: '9px' }}>{a.type === 'atividade' ? 'DESENVOLVIMENTO' : a.type.toUpperCase()}</Badge>
                        {a.sistema && (
                          <Badge color="gray" variant="surface" style={{ fontSize: '9px' }}>{a.sistema}</Badge>
                        )}
                      </Flex>
                      <Flex align="center" gap="1">
                        <Text size="1" color="gray" style={{ fontSize: '10px', flexShrink: 0 }}>{a.demandaCode} • {a.hours}h</Text>
                        {a.type === 'atividade' && (!a.original.parentId || !tickets.some(t => t.id === a.original.parentId)) && (
                          <div onPointerDown={(e) => e.stopPropagation()}>
                            <IconButton 
                              size="1" 
                              variant="ghost" 
                              color="red" 
                              style={{ height: '14px', width: '14px', minHeight: '14px', padding: 0 }}
                              onClick={() => {
                                if (window.confirm("Deseja excluir esta atividade permanentemente do sistema?")) {
                                  deleteTicket(a.id).catch(err => console.error("Erro ao excluir", err));
                                }
                              }}
                            >
                              <X size={10} />
                            </IconButton>
                          </div>
                        )}
                      </Flex>
                    </Flex>
                    <Text size="1" weight="bold" style={{ display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '11px' }}>
                      {a.title}
                    </Text>
                  </Card>
                </DraggableActivity>
              ))}
            </Flex>
          </ScrollArea>
        )}

        {/* Bottom: Calendar Grid */}
        <ScrollArea style={{ height: 'calc(100vh - 200px)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', width: 'max-content' }}>
            
            {/* Header Row */}
            <div style={{ display: 'flex' }}>
              <div style={{ width: '160px', flexShrink: 0, position: 'sticky', left: 0, zIndex: 10, backgroundColor: 'var(--color-panel)', borderRight: '1px solid var(--gray-5)', borderBottom: '1px solid var(--gray-5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', height: '40px' }}>
                <Text weight="bold" size="1">Membro</Text>
                <Flex gap="1">
                  <IconButton size="1" variant="ghost" onClick={() => shiftCalendar(-7)}><ChevronLeft size={12} /></IconButton>
                  <IconButton size="1" variant="ghost" onClick={() => setCalendarStartDate(new Date())} title="Hoje"><Calendar size={12} /></IconButton>
                  <IconButton size="1" variant="ghost" onClick={() => shiftCalendar(7)}><ArrowRight size={12} /></IconButton>
                </Flex>
              </div>
              {days.map(dStr => {
                const dateObj = new Date(`${dStr}T12:00:00Z`);
                const isWorkDay = isWorkingDay(dateObj);
                return (
                  <div key={dStr} style={{ width: '130px', flexShrink: 0, borderRight: '1px solid var(--gray-4)', borderBottom: '1px solid var(--gray-5)', height: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: isWorkDay ? 'var(--gray-2)' : 'var(--amber-3)' }}>
                    <Text size="1" color={isWorkDay ? "gray" : "amber"} style={{ fontSize: '10px', fontWeight: isWorkDay ? 'normal' : 'bold' }}>{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][dateObj.getDay()]}</Text>
                    <Text size="1" weight="bold">{dateObj.getDate()}/{dateObj.getMonth()+1}</Text>
                  </div>
                );
              })}
            </div>

            {/* Body Rows */}
            {squadMembers.map(u => (
              <div key={u.id} style={{ display: 'flex' }}>
                {/* User Cell */}
                <div 
                  onClick={() => setSelectedUserForModal(u)}
                  style={{ width: '160px', flexShrink: 0, position: 'sticky', left: 0, zIndex: 9, backgroundColor: 'var(--color-panel)', borderRight: '1px solid var(--gray-5)', borderBottom: '1px solid var(--gray-4)', padding: '4px 8px', minHeight: '48px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                >
                  <Avatar size="2" src={u.photoURL} fallback={(u.displayName || u.shortName || u.name || u.email || 'U').charAt(0)} radius="full" />
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <Text size="1" weight="bold" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.displayName || u.shortName || u.name || u.email}</Text>
                    <Text size="1" color="gray" style={{ fontSize: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.role || 'Membro'}</Text>
                  </div>
                </div>
                
                {/* Day Cells */}
                {days.map(dStr => {
                  const dateObj = new Date(`${dStr}T12:00:00Z`);
                  const isWorkDay = isWorkingDay(dateObj);
                  const bgCell = isWorkDay ? 'transparent' : 'var(--amber-2)';
                  const uAllocs = allocations.filter(a => a.userId === u.id && a.date === dStr);
                  const totalHours = uAllocs.reduce((acc, curr) => acc + curr.hours, 0);

                  return (
                    <div 
                      key={`${u.id}|${dStr}`} 
                      style={{ width: '130px', flexShrink: 0, borderRight: '1px solid var(--gray-4)', borderBottom: '1px solid var(--gray-4)', padding: '4px', backgroundColor: bgCell, cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedCellInfo({ userId: u.id, dateStr: dStr, userName: u.name, isWorkDay, totalHours });
                      }}
                    >
                      <DroppableCell id={`${u.id}|${dStr}`}>
                        <div style={{ maxHeight: '42px', overflow: 'hidden', marginBottom: '2px' }}>
                          <Flex direction="column" gap="1">
                            {uAllocs.slice(0, 2).map((al, idx) => {
                              let actCode = 'Ativ';
                              if (al.activityType === 'atividade') {
                                const act = tickets.find(t => t.id === al.activityId);
                                const dem = tickets.find(t => t.id === act?.parentId);
                                actCode = dem ? dem.code : (act?.title || 'Avulsa');
                              } else if (al.activityType === 'estimativa') {
                                const est = estimations.find(e => e.id === al.activityId);
                                const dem = tickets.find(t => t.id === est?.ticketId);
                                actCode = dem ? dem.code : 'EST';
                              } else if (al.activityType === 'ef') {
                                const ef = specifications.find(s => s.id === al.activityId);
                                const est = estimations.find(e => e.id === ef?.parentId);
                                const dem = tickets.find(t => t.id === est?.ticketId);
                                actCode = dem ? dem.code : 'EF';
                              } else if (al.activityType === 'et') {
                                const et = techSpecs.find(s => s.id === al.activityId);
                                const est = estimations.find(e => e.id === et?.parentId);
                                const dem = tickets.find(t => t.id === est?.ticketId);
                                actCode = dem ? dem.code : 'ET';
                              } else if (al.activityType === 'tshirt') {
                                const ts = tshirts.find(s => s.id === al.activityId);
                                const dem = tickets.find(t => t.id === ts?.ticketId);
                                actCode = dem ? dem.code : 'T-Shirt';
                              }
                              return (
                                <Badge key={idx} color="indigo" size="1" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', padding: '2px 4px' }}>
                                  <span title={`${actCode}`} style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {actCode} - {al.hours}h
                                  </span>
                                </Badge>
                              )
                            })}
                          </Flex>
                        </div>
                        <Flex justify="between" align="center" style={{ marginTop: '2px', minHeight: '14px' }}>
                          <Box>
                            {isWorkDay ? (
                              <Flex align="center" gap="1">
                                {totalHours > 0 && totalHours < 8 && <Text as="div" size="1" color="gray" style={{ fontSize: '9px' }}>+{8 - totalHours}h livres</Text>}
                                {totalHours === 0 && <Text as="div" size="1" color="gray" style={{ fontSize: '9px' }}>Livre</Text>}
                                {totalHours > 8 && (
                                  <Badge color="red" variant="solid" style={{ fontSize: '8px', padding: '0 3px', minHeight: '12px', height: '14px', display: 'flex', alignItems: 'center' }}>
                                    {totalHours - 8}HE
                                  </Badge>
                                )}
                              </Flex>
                            ) : (
                              <>
                                {totalHours > 0 && (
                                  <Badge color="red" variant="solid" style={{ fontSize: '8px', padding: '0 3px', minHeight: '12px', height: '14px', display: 'flex', alignItems: 'center' }}>
                                    {totalHours}HE
                                  </Badge>
                                )}
                              </>
                            )}
                          </Box>
                          {uAllocs.length > 2 && (
                            <Text as="div" size="1" color="indigo" weight="bold" style={{ fontSize: '9px', textAlign: 'right' }}>
                              + {uAllocs.length - 2} itens...
                            </Text>
                          )}
                        </Flex>
                      </DroppableCell>
                    </div>
                  );
                })}
              </div>
            ))}

          </div>
        </ScrollArea>

        <DragOverlay>
          {activeDragItem ? (
            <Card size="1" style={{ width: '200px', backgroundColor: 'var(--gray-2)', opacity: 0.8, boxShadow: '0 10px 20px rgba(0,0,0,0.2)' }}>
               <Text size="2" weight="bold">{activeDragItem.title}</Text>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Modal Details of Cell */}
      <Dialog.Root open={!!selectedCellInfo} onOpenChange={(open) => !open && setSelectedCellInfo(null)}>
        <Dialog.Content style={{ maxWidth: 450 }} onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          {selectedCellInfo && (
            <>
              <Dialog.Title>
                Atividades do Dia
              </Dialog.Title>
              <Flex justify="between" align="center" mb="4">
                <Text as="div" size="2" color="gray">
                  {selectedCellInfo.userName} • {new Date(`${selectedCellInfo.dateStr}T12:00:00Z`).toLocaleDateString('pt-BR')}
                </Text>
                {(() => {
                  const cellAllocs = allocations.filter(a => a.userId === selectedCellInfo.userId && a.date === selectedCellInfo.dateStr);
                  const currentTotalHours = cellAllocs.reduce((acc, curr) => acc + curr.hours, 0);
                  return (
                    <Flex gap="2">
                      <Badge color="green" variant="soft">
                        {selectedCellInfo.isWorkDay ? Math.min(8, currentTotalHours) : 0}h Úteis
                      </Badge>
                      <Badge color="red" variant="soft">
                        {selectedCellInfo.isWorkDay ? Math.max(0, currentTotalHours - 8) : currentTotalHours}h Extras
                      </Badge>
                    </Flex>
                  );
                })()}
              </Flex>
              <Flex direction="column" gap="3">
                {(() => {
                  const cellAllocs = allocations.filter(a => a.userId === selectedCellInfo.userId && a.date === selectedCellInfo.dateStr);
                  if (cellAllocs.length === 0) {
                    return <Text color="gray" align="center">Nenhuma atividade planejada.</Text>;
                  }
                  return cellAllocs.map((al, idx) => {
                    let title = 'Atividade';
                    let actCode = 'Ativ';
                    let sistema = null;
                    if (al.activityType === 'atividade') {
                      const act = tickets.find(t => t.id === al.activityId);
                      const dem = tickets.find(t => t.id === act?.parentId);
                      title = act?.title || title;
                      actCode = dem ? dem.code : (act?.code || 'Avulsa');
                      const actSystems = act?.associatedSystems?.length ? act.associatedSystems.map(s => s.system).join(', ') : act?.system;
                      const demSystems = dem ? (dem.associatedSystems?.length ? dem.associatedSystems.map(s => s.system).join(', ') : dem.system) : null;
                      sistema = actSystems || demSystems;
                    } else if (al.activityType === 'estimativa') {
                      const est = estimations.find(e => e.id === al.activityId);
                      const dem = tickets.find(t => t.id === est?.ticketId);
                      title = 'Estimativa de Esforço';
                      actCode = dem ? dem.code : 'EST';
                      sistema = est?.system || est?.sistema;
                    } else if (al.activityType === 'ef') {
                      const ef = specifications.find(s => s.id === al.activityId);
                      const est = estimations.find(e => e.id === ef?.parentId);
                      const dem = tickets.find(t => t.id === est?.ticketId);
                      title = ef?.title || 'Espec. Func.';
                      actCode = dem ? dem.code : 'EF';
                      sistema = est?.system || est?.sistema;
                    } else if (al.activityType === 'et') {
                      const et = techSpecs.find(s => s.id === al.activityId);
                      const est = estimations.find(e => e.id === et?.parentId);
                      const dem = tickets.find(t => t.id === est?.ticketId);
                      title = et?.title || 'Espec. Técnica';
                      actCode = dem ? dem.code : 'ET';
                      sistema = est?.system || est?.sistema;
                    } else if (al.activityType === 'tshirt') {
                      const ts = tshirts.find(s => s.id === al.activityId);
                      const dem = tickets.find(t => t.id === ts?.ticketId);
                      title = 'T-Shirt';
                      actCode = dem ? dem.code : 'T-Shirt';
                      sistema = dem ? (dem.associatedSystems?.length ? dem.associatedSystems.map(s => s.system).join(', ') : dem.system) : null;
                    }

                    return (
                      <Card key={idx} size="1" variant="surface">
                        <Flex justify="between" align="start" gap="3">
                          <Box style={{ flex: 1, minWidth: 0 }}>
                            <Flex gap="1" mb="1" wrap="wrap">
                              <Badge color="indigo">{actCode} - {al.hours}h</Badge>
                              {sistema && <Badge color="gray" variant="surface">{sistema}</Badge>}
                            </Flex>
                            <Text as="div" size="2" weight="bold" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</Text>
                          </Box>
                          <Flex gap="2" style={{ flexShrink: 0 }}>
                            <Button
                              color="amber"
                              variant="soft"
                              size="1"
                              onClick={async () => {
                                try {
                                  await adjustAllocationHours(al.id, al.activityId, -1, allocations);
                                } catch (e) {
                                  alert("Erro ao remover hora extra");
                                }
                              }}
                            >
                              <Minus size={14} style={{ marginRight: '4px' }} /> 1h
                            </Button>
                            <Button
                              color="orange"
                              variant="soft"
                              size="1"
                              onClick={async () => {
                                try {
                                  await adjustAllocationHours(al.id, al.activityId, 1, allocations);
                                } catch (e) {
                                  alert("Erro ao adicionar hora extra");
                                }
                              }}
                            >
                              <Plus size={14} style={{ marginRight: '4px' }} /> 1h
                            </Button>
                            <Button 
                              color="red" 
                              variant="soft" 
                              size="1"
                              onClick={() => handleUnallocate(al.activityId, al.activityType)}
                            >
                              <X size={14} style={{ marginRight: '4px' }} /> Remover
                            </Button>
                          </Flex>
                        </Flex>
                      </Card>
                    );
                  });
                })()}
              </Flex>

              <Box mt="4" pt="4" style={{ borderTop: '1px solid var(--gray-5)' }}>
                <Text as="div" size="3" weight="bold" mb="3">Incluir Nova Atividade Avulsa</Text>
                <Flex direction="column" gap="3">
                  <TextField.Root placeholder="Título da Atividade" value={newActivityTitle} onChange={e => setNewActivityTitle(e.target.value)} />
                  
                  <Flex gap="3" align="center">
                    <TextField.Root type="number" placeholder="Horas" value={newActivityHours} onChange={e => setNewActivityHours(e.target.value)} min="1" max="24" style={{ flex: 1 }} />
                    <Button onClick={handleAddAvulsa} color="indigo">Incluir</Button>
                  </Flex>

                  <Flex align="center" gap="2" mt="2">
                    <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={isRecurrent} onChange={e => setIsRecurrent(e.target.checked)} />
                      Repetir (Recorrência)?
                    </label>
                  </Flex>

                  {isRecurrent && (
                    <Box style={{ padding: '12px', background: 'var(--gray-2)', borderRadius: 'var(--border-radius)', marginTop: '4px' }}>
                      <Flex direction="column" gap="3">
                        <Flex direction="column" gap="1">
                          <Text size="1" weight="bold">Até quando? (Data Fim)</Text>
                          <input type="date" value={recurrentEndDate} onChange={e => setRecurrentEndDate(e.target.value)} style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--gray-5)' }} />
                        </Flex>
                        <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={includeWeekends} onChange={e => setIncludeWeekends(e.target.checked)} />
                          Considerar finais de semana e feriados
                        </label>
                      </Flex>
                    </Box>
                  )}
                </Flex>
              </Box>

              <Flex justify="end" mt="4">
                <Dialog.Close>
                  <Button variant="soft" color="gray">Fechar</Button>
                </Dialog.Close>
              </Flex>
            </>
          )}
        </Dialog.Content>
      </Dialog.Root>

      {/* User Details Modal */}
      <UserDetailsModal 
        open={!!selectedUserForModal} 
        onOpenChange={(open) => !open && setSelectedUserForModal(null)} 
        user={selectedUserForModal} 
      />

    </div>
  );
};

export default CapacityPlanning;
