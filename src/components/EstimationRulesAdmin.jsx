import React, { useState, useMemo } from 'react';
import { 
  Box, 
  Flex, 
  Text, 
  Table, 
  Button, 
  Card,
  Heading,
  Select,
  TextField,
  IconButton,
  ScrollArea,
  Dialog
} from '@radix-ui/themes';
import { Plus, Edit2, Trash2, Save } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

const EstimationRulesAdmin = ({ dbRules, onRulesChange }) => {
  const [selectedTech, setSelectedTech] = useState('Todas');
  
  // Dialog State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    tecnologia: '',
    tipo: 'Novo',
    categoria: '',
    componente: '',
    muitoBaixa: 0,
    baixa: 0,
    media: 0,
    alta: 0,
    muitoAlta: 0
  });

  const technologies = useMemo(() => {
    const techSet = new Set(dbRules.map(r => r.tecnologia));
    return ['Todas', ...Array.from(techSet).sort()];
  }, [dbRules]);

  const filteredRules = useMemo(() => {
    if (selectedTech === 'Todas') return dbRules;
    return dbRules.filter(r => r.tecnologia === selectedTech);
  }, [dbRules, selectedTech]);

  const handleOpenModal = (rule = null) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        tecnologia: rule.tecnologia || '',
        tipo: rule.tipo || 'Novo',
        categoria: rule.categoria || '',
        componente: rule.componente || '',
        muitoBaixa: rule.muitoBaixa || 0,
        baixa: rule.baixa || 0,
        media: rule.media || 0,
        alta: rule.alta || 0,
        muitoAlta: rule.muitoAlta || 0
      });
    } else {
      setEditingRule(null);
      setFormData({
        tecnologia: selectedTech !== 'Todas' ? selectedTech : '',
        tipo: 'Novo',
        categoria: '',
        componente: '',
        muitoBaixa: 0,
        baixa: 0,
        media: 0,
        alta: 0,
        muitoAlta: 0
      });
    }
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir esta regra base?")) {
      try {
        await deleteDoc(doc(db, 'estimationRules', id));
        onRulesChange();
      } catch (error) {
        console.error("Erro ao deletar regra", error);
        alert("Erro ao excluir.");
      }
    }
  };

  const handleSave = async () => {
    if (!formData.tecnologia || !formData.componente) {
      alert("Tecnologia e Componente são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      if (editingRule) {
        await updateDoc(doc(db, 'estimationRules', editingRule.id), formData);
      } else {
        await addDoc(collection(db, 'estimationRules'), formData);
      }
      setModalOpen(false);
      onRulesChange();
    } catch (error) {
      console.error("Erro ao salvar regra", error);
      alert("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Flex direction={{ initial: 'column', sm: 'row' }} justify="between" align={{ initial: 'stretch', sm: 'center' }} gap="4" mb="4">
        <Flex direction={{ initial: 'column', sm: 'row' }} gap="3" align={{ initial: 'start', sm: 'center' }}>
          <Text weight="bold">Filtrar por Tecnologia:</Text>
          <Select.Root value={selectedTech} onValueChange={setSelectedTech}>
            <Select.Trigger style={{ minWidth: '200px' }} />
            <Select.Content>
              {technologies.map(t => <Select.Item key={t} value={t}>{t}</Select.Item>)}
            </Select.Content>
          </Select.Root>
        </Flex>
        
        <Button onClick={() => handleOpenModal(null)}>
          <Plus size={16} /> Nova Regra Base
        </Button>
      </Flex>

      <Card>
        <ScrollArea type="auto" style={{ maxHeight: '65vh' }}>
          <Table.Root variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Tecnologia</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Tipo</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Componente</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>MB</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>B</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>M</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>A</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>MA</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>Ações</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {filteredRules.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={9} style={{ textAlign: 'center', padding: '32px' }}>
                    <Text color="gray">Nenhuma regra encontrada para o filtro.</Text>
                  </Table.Cell>
                </Table.Row>
              ) : filteredRules.map(r => (
                <Table.Row key={r.id}>
                  <Table.Cell>{r.tecnologia}</Table.Cell>
                  <Table.Cell>{r.tipo}</Table.Cell>
                  <Table.Cell>{r.componente}</Table.Cell>
                  <Table.Cell>{r.muitoBaixa}</Table.Cell>
                  <Table.Cell>{r.baixa}</Table.Cell>
                  <Table.Cell>{r.media}</Table.Cell>
                  <Table.Cell>{r.alta}</Table.Cell>
                  <Table.Cell>{r.muitoAlta}</Table.Cell>
                  <Table.Cell style={{ textAlign: 'right' }}>
                    <Flex gap="2" justify="end">
                      <IconButton variant="ghost" color="blue" onClick={() => handleOpenModal(r)}>
                        <Edit2 size={16} />
                      </IconButton>
                      <IconButton variant="ghost" color="red" onClick={() => handleDelete(r.id)}>
                        <Trash2 size={16} />
                      </IconButton>
                    </Flex>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </ScrollArea>
      </Card>

      <Dialog.Root open={modalOpen} onOpenChange={setModalOpen}>
        <Dialog.Content style={{ maxWidth: '600px' }}>
          <Dialog.Title>{editingRule ? 'Editar Regra' : 'Nova Regra'}</Dialog.Title>
          
          <Flex direction="column" gap="3" mt="4">
            <Flex gap="3">
              <Box flexGrow="1">
                <Text as="div" size="2" mb="1" weight="bold">Tecnologia</Text>
                <TextField.Root 
                  value={formData.tecnologia} 
                  onChange={(e) => setFormData({...formData, tecnologia: e.target.value})} 
                />
              </Box>
              <Box flexGrow="1">
                <Text as="div" size="2" mb="1" weight="bold">Tipo (Novo/Ajuste)</Text>
                <TextField.Root 
                  value={formData.tipo} 
                  onChange={(e) => setFormData({...formData, tipo: e.target.value})} 
                />
              </Box>
            </Flex>
            
            <Box>
              <Text as="div" size="2" mb="1" weight="bold">Componente</Text>
              <TextField.Root 
                value={formData.componente} 
                onChange={(e) => setFormData({...formData, componente: e.target.value})} 
              />
            </Box>
            
            <Text as="div" size="2" mt="2" weight="bold">Horas Base por Complexidade:</Text>
            <Flex gap="3">
              <Box>
                <Text as="div" size="1" mb="1">Muito Baixa</Text>
                <TextField.Root type="number" value={formData.muitoBaixa} onChange={(e) => setFormData({...formData, muitoBaixa: parseFloat(e.target.value) || 0})} />
              </Box>
              <Box>
                <Text as="div" size="1" mb="1">Baixa</Text>
                <TextField.Root type="number" value={formData.baixa} onChange={(e) => setFormData({...formData, baixa: parseFloat(e.target.value) || 0})} />
              </Box>
              <Box>
                <Text as="div" size="1" mb="1">Média</Text>
                <TextField.Root type="number" value={formData.media} onChange={(e) => setFormData({...formData, media: parseFloat(e.target.value) || 0})} />
              </Box>
              <Box>
                <Text as="div" size="1" mb="1">Alta</Text>
                <TextField.Root type="number" value={formData.alta} onChange={(e) => setFormData({...formData, alta: parseFloat(e.target.value) || 0})} />
              </Box>
              <Box>
                <Text as="div" size="1" mb="1">Muito Alta</Text>
                <TextField.Root type="number" value={formData.muitoAlta} onChange={(e) => setFormData({...formData, muitoAlta: parseFloat(e.target.value) || 0})} />
              </Box>
            </Flex>
          </Flex>

          <Flex justify="end" mt="5" gap="3">
            <Dialog.Close>
              <Button variant="soft" color="gray">Cancelar</Button>
            </Dialog.Close>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Regra'}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

    </Box>
  );
};

export default EstimationRulesAdmin;
