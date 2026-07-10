import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, 
  Flex, 
  Text, 
  Table, 
  Select, 
  TextField, 
  Button, 
  Card,
  Heading,
  ScrollArea,
  IconButton,
  Dialog,
  TextArea
} from '@radix-ui/themes';
import { Plus, Trash2, Save } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, addDoc, updateDoc, doc, getDocs, getDoc, query, where, deleteDoc } from 'firebase/firestore';
import { createTicket, updateTicket, deleteTicket } from '../services/ticketService';

const COMPLEXITIES = [
  { label: 'Muito Baixa', value: 'muitoBaixa' },
  { label: 'Baixa', value: 'baixa' },
  { label: 'Média', value: 'media' },
  { label: 'Alta', value: 'alta' },
  { label: 'Muito Alta', value: 'muitoAlta' }
];

const PHASE_DISTRIBUTION = {
  SR: 0.089,
  EF: 0.199,
  ET: 0.081,
  Construcao: 0.415,
  TestesUnitarios: 0.165,
  Homologacao: 0.051
};

const EstimationEditorModal = ({ open, onOpenChange, dbRules, systems, tickets, estimations, estimationToEdit, onSaveSuccess }) => {
  const [ticketSearch, setTicketSearch] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [macroDescription, setMacroDescription] = useState('');
  const [system, setSystem] = useState('');
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (estimationToEdit) {
        setSelectedTicketId(estimationToEdit.ticketId || '');
        const tk = tickets.find(t => t.id === estimationToEdit.ticketId);
        if (tk) {
          if (estimationToEdit.system || estimationToEdit.sistema) {
            setTicketSearch(`${tk.code} - ${tk.title} (${estimationToEdit.system || estimationToEdit.sistema})`);
          } else {
            setTicketSearch(`${tk.code} - ${tk.title}`);
          }
        } else {
          setTicketSearch('');
        }
        setSystem(estimationToEdit.system || estimationToEdit.sistema || '');
        setMacroDescription(estimationToEdit.macroDescription || '');
        setRows(estimationToEdit.rows || []);
      } else {
        setSelectedTicketId('');
        setTicketSearch('');
        setSystem('');
        setMacroDescription('');
        setRows([]);
      }
    }
  }, [open, estimationToEdit, tickets]);

  const expandedTickets = tickets
    .filter(t => !t.board || t.board === 'demandas')
    .flatMap(t => {
    if (t.associatedSystems && t.associatedSystems.length > 0) {
      return t.associatedSystems.map(sys => ({
        id: t.id,
        title: t.title,
        code: t.code,
        system: sys.system,
        label: `${t.code} - ${t.title} (${sys.system})`
      }));
    }
    return [{
      id: t.id,
      title: t.title,
      code: t.code,
      system: '',
      label: `${t.code} - ${t.title}`
    }];
  });

  const technologies = useMemo(() => {
    const techSet = new Set(dbRules.map(r => r.tecnologia));
    return Array.from(techSet).sort();
  }, [dbRules]);

  const getComponentsForTech = (tech, type) => {
    const excluded = ['Documentação Técnica', 'Testes Unitários'];
    const comps = dbRules
      .filter(r => r.tecnologia === tech && (!type || r.tipo === type) && !excluded.includes(r.componente))
      .map(r => r.componente);
    return Array.from(new Set(comps)).sort();
  };

  const getTypesForTech = (tech) => {
    const types = dbRules.filter(r => r.tecnologia === tech).map(r => r.tipo);
    return Array.from(new Set(types)).sort();
  };

  const handleAddRow = () => {
    const initialTech = technologies[0] || '';
    const initialTypes = getTypesForTech(initialTech);
    const initialType = initialTypes[0] || 'Novo';
    const initialComponents = getComponentsForTech(initialTech, initialType);
    
    setRows([
      ...rows, 
      {
        id: Date.now().toString(),
        description: '', 
        technology: initialTech,
        type: initialType,
        element: initialComponents[0] || '',
        complexity: 'baixa',
        quantity: 1
      }
    ]);
  };

  const handleRemoveRow = (id) => {
    setRows(rows.filter(r => r.id !== id));
  };

  const handleChangeRow = (id, field, value) => {
    setRows(rows.map(r => {
      if (r.id === id) {
        const updated = { ...r, [field]: value };
        if (field === 'technology') {
          const types = getTypesForTech(value);
          const defaultType = types[0] || 'Novo';
          updated.type = defaultType;
          const comps = getComponentsForTech(value, defaultType);
          updated.element = comps.length > 0 ? comps[0] : '';
        } else if (field === 'type') {
          const comps = getComponentsForTech(updated.technology, value);
          updated.element = comps.length > 0 ? comps[0] : '';
        }
        return updated;
      }
      return r;
    }));
  };

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

  const totalBaseHours = rows.reduce((acc, row) => acc + calculateRowPhases(row).Total, 0);

  const handleSaveEstimation = async () => {
    if (!selectedTicketId) {
      alert("Por favor, selecione uma Demanda (Ticket) para atrelar a estimativa.");
      return;
    }

    // Validação de unicidade
    if (estimations && !estimationToEdit) {
      const alreadyExists = estimations.some(e => e.ticketId === selectedTicketId && e.system === system);
      if (alreadyExists) {
        alert("Já existe uma estimativa criada para este Ticket e Sistema.");
        return;
      }
    } else if (estimations && estimationToEdit) {
      const alreadyExists = estimations.some(e => e.ticketId === selectedTicketId && e.system === system && e.id !== estimationToEdit.id);
      if (alreadyExists) {
        alert("Já existe OUTRA estimativa criada para este Ticket e Sistema.");
        return;
      }
    }
    
    setSaving(true);
    try {
      const currentUser = auth.currentUser;
      const userName = currentUser ? (currentUser.displayName || currentUser.email) : 'Usuário Desconhecido';
      const userUid = currentUser ? currentUser.uid : 'anon';
      
      const executionStatus = (macroDescription && macroDescription.trim() !== '' && rows.length > 0) ? 'concluido' : 'pendente';

      const estimationData = {
        ticketId: selectedTicketId,
        system,
        macroDescription,
        rows,
        totalBaseHours,
        executionStatus,
        updatedAt: new Date().toISOString()
      };
      
      let targetEstimationId = '';
      if (estimationToEdit && estimationToEdit.id) {
        // Se já existe, mantém autor e data de criação originais
        await updateDoc(doc(db, 'estimations', estimationToEdit.id), estimationData);
        targetEstimationId = estimationToEdit.id;
      } else {
        estimationData.createdAt = new Date().toISOString();
        estimationData.authorName = userName;
        estimationData.authorUid = userUid;
        const docRef = await addDoc(collection(db, 'estimations'), estimationData);
        targetEstimationId = docRef.id;
      }
      
      // -- NOVIDADE: Atualiza o Ticket atrelado --
      // Busca todas as estimativas deste ticket para garantir a soma correta
      const q = query(collection(db, 'estimations'), where('ticketId', '==', selectedTicketId));
      const querySnapshot = await getDocs(q);
      
      const tk = tickets.find(t => t.id === selectedTicketId);
      let newAssociatedSystems = [];
      
      if (tk && tk.associatedSystems) {
        newAssociatedSystems = tk.associatedSystems.map(sys => {
          // Atualiza as horas pro sistema que acabou de ser salvo
          if (sys.system === system) {
            return { ...sys, hours: totalBaseHours };
          }
          // Mantém as horas para outros sistemas (buscando na query se houver pra garantir)
          const est = querySnapshot.docs.find(d => d.data().system === sys.system && d.data().system !== system);
          if (est) {
            return { ...sys, hours: est.data().totalBaseHours || 0 };
          }
          return sys;
        });
      } else if (tk) {
        // Fallback pra tickets legados
        newAssociatedSystems = [{ system, hours: totalBaseHours }];
      }

      const sumOfHours = newAssociatedSystems.reduce((acc, curr) => acc + (parseFloat(curr.hours) || 0), 0);
      
      // Grava no ticket tanto num campo 'estimatedHours' quanto em 'storyPoints' para alimentar os gráficos
      // E atualiza a lista de sistemas com as horas novas
      await updateDoc(doc(db, 'tickets', selectedTicketId), {
        estimatedHours: sumOfHours,
        storyPoints: sumOfHours,
        associatedSystems: newAssociatedSystems,
        updatedAt: new Date().toISOString()
      });

      // -- VÍNCULO HARD: Sincronizar Atividades da Demanda --
      if (targetEstimationId && tk) {
        
        let latestTk = { ...tk };
        try {
          const tkSnap = await getDoc(doc(db, 'tickets', tk.id));
          if (tkSnap.exists()) {
            latestTk = { id: tkSnap.id, ...tkSnap.data() };
          }
        } catch(e) { console.error('Erro ao buscar ticket recente', e); }

        // Descobre a primeira coluna correta para Atividades deste projeto
        let firstColumn = 'col-backlog';
        if (tk.projectId) {
          const [projSnap, wfSnap] = await Promise.all([
            getDoc(doc(db, 'projects', tk.projectId)),
            getDocs(collection(db, 'workflows'))
          ]);
          
          if (projSnap.exists()) {
            const projData = projSnap.data();
            const targetWfId = projData.workflowAtividadesId || projData.workflowId;
            if (targetWfId) {
              const wfDoc = wfSnap.docs.find(w => w.id === targetWfId);
              if (wfDoc) {
                const wfData = wfDoc.data();
                if (wfData.columns && wfData.columns.length > 0) {
                  firstColumn = typeof wfData.columns[0] === 'string' ? wfData.columns[0] : (wfData.columns[0].id || wfData.columns[0].title);
                }
              }
            }
          }
        }

        // Busca atividades auto-geradas por esta estimativa
        const actQuery = query(
          collection(db, 'tickets'), 
          where('board', '==', 'atividades'), 
          where('sourceEstimationId', '==', targetEstimationId)
        );
        const actSnapshot = await getDocs(actQuery);
        const existingActivities = actSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        const currentRowIds = rows.map(r => r.id);

        // 1. Excluir atividades que não estão mais nas rows
        for (const act of existingActivities) {
          if (!currentRowIds.includes(act.sourceRowId)) {
            await deleteTicket(act.id, userName);
          }
        }

        // 2. Criar ou Atualizar as rows atuais
        for (const row of rows) {
          const rowHours = calculateRowPhases(row).Total;
          const actTitle = `${tk.externalTicket || tk.code} - ${row.description || row.element}`;
          const actDesc = `**Tecnologia:** ${row.technology}\n**Tipo:** ${row.type}\n**Elemento:** ${row.element}\n**Complexidade:** ${row.complexity}`;
          
          const existingAct = existingActivities.find(a => a.sourceRowId === row.id);

          if (existingAct) {
            // Atualizar
            await updateTicket(existingAct.id, {
              title: actTitle,
              description: actDesc,
              estimatedHours: rowHours,
              storyPoints: rowHours,
              squadId: latestTk.squadId || '',
              projectId: latestTk.projectId || ''
            }, userName);
          } else {
            // Criar nova atividade gerada
            await createTicket({
              code: `ATV-${latestTk.externalTicket || latestTk.code}-${Math.floor(Math.random() * 900) + 100}`,
              title: actTitle,
              description: actDesc,
              type: 'Task',
              priority: 'medium',
              columnId: firstColumn,
              projectId: latestTk.projectId || '',
              squadId: latestTk.squadId || '',
              assignee: 'Sem responsável',
              associatedSystems: [{ system, hours: rowHours }],
              estimatedHours: rowHours,
              storyPoints: rowHours,
              board: 'atividades',
              parentId: latestTk.id,
              isAutoGenerated: true,
              sourceEstimationId: targetEstimationId,
              sourceRowId: row.id,
              comments: 0
            });
          }
        }
      }
      
      onSaveSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao salvar", error);
      alert("Erro ao salvar estimativa.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content style={{ maxWidth: '95vw', maxHeight: '95vh' }}>
        <Dialog.Title>
          <Flex justify="between" align="center">
            <Text>{estimationToEdit ? 'Editar Estimativa' : 'Nova Estimativa'}</Text>
            <Button onClick={handleSaveEstimation} disabled={saving} color="green">
              <Save size={16} /> {saving ? 'Salvando...' : 'Salvar Estimativa'}
            </Button>
          </Flex>
        </Dialog.Title>

        <Box mt="4">
          <Card mb="4">
            <Heading size="3" mb="3">Dados da Demanda (Vínculo)</Heading>
            
            <Flex gap="4" align="start" mb="4">
              <Box flexGrow="1">
                <Text as="div" size="2" mb="1" weight="bold">Demanda / Ticket</Text>
                <input 
                  list="tickets-list-modal"
                  value={ticketSearch}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTicketSearch(val);
                    const found = expandedTickets.find(t => t.label === val);
                    if (found) {
                      setSelectedTicketId(found.id);
                      if (found.system) setSystem(found.system);
                    } else {
                      setSelectedTicketId('');
                    }
                  }}
                  placeholder="Digite para buscar um ticket..."
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid var(--gray-6)',
                    backgroundColor: 'var(--gray-2)',
                    color: 'var(--gray-12)'
                  }}
                />
                <datalist id="tickets-list-modal">
                  {expandedTickets.map((t, idx) => (
                    <option key={idx} value={t.label} />
                  ))}
                </datalist>
              </Box>
              <Box flexGrow="1">
                <Text as="div" size="2" mb="1" weight="bold">Responsável</Text>
                <TextField.Root 
                  value={estimationToEdit ? (estimationToEdit.assignee || estimationToEdit.authorName || 'Não Atribuido') : (auth.currentUser?.displayName || auth.currentUser?.email || 'Não Atribuido')} 
                  readOnly 
                  disabled
                />
              </Box>
              <Box flexGrow="1">
                <Text as="div" size="2" mb="1" weight="bold">Data da Estimativa</Text>
                <TextField.Root 
                  value={(() => {
                    if (estimationToEdit && estimationToEdit.createdAt) {
                      const d = new Date(estimationToEdit.createdAt);
                      return isNaN(d.getTime()) ? 'Não Planejada' : d.toLocaleDateString('pt-BR');
                    }
                    return estimationToEdit ? 'Não Planejada' : new Date().toLocaleDateString('pt-BR');
                  })()}
                  readOnly 
                  disabled
                />
              </Box>
            </Flex>

            <Flex gap="4" align="start" mb="4">
              <Box flexGrow="1">
                <Text as="div" size="2" mb="1" weight="bold">Sistema Associado</Text>
                <Select.Root value={system} onValueChange={setSystem} disabled>
                  <Select.Trigger placeholder="Selecione um sistema..." />
                  <Select.Content>
                    {systems && systems.map(s => (
                      <Select.Item key={s.id} value={s.name}>{s.name}</Select.Item>
                    ))}
                    {(!systems || systems.length === 0) && <Select.Item value="none" disabled>Nenhum sistema cadastrado</Select.Item>}
                  </Select.Content>
                </Select.Root>
              </Box>
            </Flex>

            <Box>
              <Text as="div" size="2" mb="1" weight="bold">Macro Descrição do Escopo</Text>
              <TextArea 
                placeholder="Descreva o escopo macro em alto nível para compor esta estimativa..." 
                value={macroDescription}
                onChange={(e) => setMacroDescription(e.target.value)}
                rows={3}
              />
            </Box>
          </Card>

          <Card>
            <Flex justify="between" align="center" mb="3">
              <Heading size="3">Detalhamento Técnico (Atividades)</Heading>
              <Button onClick={handleAddRow} size="2" variant="soft"><Plus size={16} /> Adicionar Funcionalidade</Button>
            </Flex>
            
            <ScrollArea type="auto" style={{ maxHeight: '60vh', border: '1px solid var(--gray-5)', borderRadius: 'var(--radius-3)' }}>
              <Table.Root variant="surface" size="1" style={{ whiteSpace: 'nowrap' }}>
                <Table.Header>
                  <Table.Row style={{ backgroundColor: 'var(--gray-3)' }}>
                    <Table.ColumnHeaderCell style={{ minWidth: '250px' }}>Descrição / Funcionalidade</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Tipo</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Tecnologia</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell style={{ minWidth: '220px' }}>Componente</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Complexidade</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell style={{ textAlign: 'center', width: '60px' }}>Qtd</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>SR</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>EF</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>ET</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>Construção</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>Testes Unit.</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>Homolog</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell style={{ textAlign: 'right', backgroundColor: 'var(--indigo-2)' }}>Total</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell style={{ width: '40px', textAlign: 'center' }}></Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {rows.length === 0 ? (
                    <Table.Row>
                      <Table.Cell colSpan={14} style={{ textAlign: 'center', padding: '32px' }}>
                        <Text color="gray">Nenhum componente adicionado. Clique em "Adicionar Funcionalidade".</Text>
                      </Table.Cell>
                    </Table.Row>
                  ) : rows.map(row => {
                    const phases = calculateRowPhases(row);
                    
                    return (
                      <Table.Row key={row.id}>
                        <Table.Cell style={{ padding: '4px' }}>
                          <TextField.Root 
                            size="1"
                            placeholder="Descreva..." 
                            value={row.description} 
                            onChange={(e) => handleChangeRow(row.id, 'description', e.target.value)}
                            style={{ minWidth: '200px' }}
                          />
                        </Table.Cell>
                        <Table.Cell style={{ padding: '4px' }}>
                          <Select.Root size="1" value={row.type || 'Novo'} onValueChange={(val) => handleChangeRow(row.id, 'type', val)}>
                            <Select.Trigger />
                            <Select.Content>
                              {getTypesForTech(row.technology).map(t => <Select.Item key={t} value={t}>{t}</Select.Item>)}
                            </Select.Content>
                          </Select.Root>
                        </Table.Cell>
                        <Table.Cell style={{ padding: '4px' }}>
                          <Select.Root size="1" value={row.technology} onValueChange={(val) => handleChangeRow(row.id, 'technology', val)}>
                            <Select.Trigger />
                            <Select.Content>
                              {technologies.map(t => <Select.Item key={t} value={t}>{t}</Select.Item>)}
                            </Select.Content>
                          </Select.Root>
                        </Table.Cell>
                        <Table.Cell style={{ padding: '4px' }}>
                          <Select.Root size="1" value={row.element} onValueChange={(val) => handleChangeRow(row.id, 'element', val)}>
                            <Select.Trigger />
                            <Select.Content>
                              {getComponentsForTech(row.technology, row.type).map(c => <Select.Item key={c} value={c}>{c}</Select.Item>)}
                            </Select.Content>
                          </Select.Root>
                        </Table.Cell>
                        <Table.Cell style={{ padding: '4px' }}>
                          <Select.Root size="1" value={row.complexity} onValueChange={(val) => handleChangeRow(row.id, 'complexity', val)}>
                            <Select.Trigger />
                            <Select.Content>
                              {COMPLEXITIES.map(c => <Select.Item key={c.value} value={c.value}>{c.label}</Select.Item>)}
                            </Select.Content>
                          </Select.Root>
                        </Table.Cell>
                        <Table.Cell style={{ padding: '4px' }}>
                          <TextField.Root 
                            size="1"
                            type="number" 
                            value={row.quantity} 
                            onChange={(e) => handleChangeRow(row.id, 'quantity', e.target.value)} 
                            style={{ width: '50px', textAlign: 'center' }}
                          />
                        </Table.Cell>
                        <Table.Cell style={{ textAlign: 'right', verticalAlign: 'middle', padding: '4px 8px' }}><Text size="1" color="gray">{phases.SR.toFixed(2)}</Text></Table.Cell>
                        <Table.Cell style={{ textAlign: 'right', verticalAlign: 'middle', padding: '4px 8px' }}><Text size="1" color="gray">{phases.EF.toFixed(2)}</Text></Table.Cell>
                        <Table.Cell style={{ textAlign: 'right', verticalAlign: 'middle', padding: '4px 8px' }}><Text size="1" color="gray">{phases.ET.toFixed(2)}</Text></Table.Cell>
                        <Table.Cell style={{ textAlign: 'right', verticalAlign: 'middle', padding: '4px 8px' }}><Text size="1" color="gray">{phases.Construcao.toFixed(2)}</Text></Table.Cell>
                        <Table.Cell style={{ textAlign: 'right', verticalAlign: 'middle', padding: '4px 8px' }}><Text size="1" color="gray">{phases.TestesUnitarios.toFixed(2)}</Text></Table.Cell>
                        <Table.Cell style={{ textAlign: 'right', verticalAlign: 'middle', padding: '4px 8px' }}><Text size="1" color="gray">{phases.Homologacao.toFixed(2)}</Text></Table.Cell>
                        <Table.Cell style={{ textAlign: 'right', verticalAlign: 'middle', backgroundColor: 'var(--indigo-2)', padding: '4px 8px' }}><Text size="2" weight="bold" color="indigo">{phases.Total.toFixed(2)}</Text></Table.Cell>
                        <Table.Cell style={{ textAlign: 'center', verticalAlign: 'middle', padding: '4px' }}>
                          <IconButton color="red" variant="ghost" size="1" onClick={() => handleRemoveRow(row.id)}>
                            <Trash2 size={16} />
                          </IconButton>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                  
                  {rows.length > 0 && (
                    <Table.Row style={{ backgroundColor: 'var(--gray-3)' }}>
                      <Table.Cell colSpan={12} style={{ textAlign: 'right', verticalAlign: 'middle', padding: '8px' }}><Text weight="bold">Total de Horas Base:</Text></Table.Cell>
                      <Table.Cell colSpan={2} style={{ verticalAlign: 'middle', padding: '8px', backgroundColor: 'var(--indigo-3)' }}><Text weight="bold" size="3" color="indigo">{totalBaseHours.toFixed(2)}h</Text></Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table.Root>
            </ScrollArea>
          </Card>
        </Box>
        <Flex justify="end" mt="4">
          <Dialog.Close>
            <Button variant="soft" color="gray">Fechar</Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default EstimationEditorModal;
