import React, { useState, useEffect } from 'react';
import { Dialog, Button, Flex, Text, TextField, Select, Badge, Card, IconButton } from '@radix-ui/themes';
import { Plus, Trash2, X, Settings2 } from 'lucide-react';
import { saveWorkflow } from '../services/settingsService';

const WorkflowStagesModal = ({ isOpen, onClose, workflow }) => {
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (workflow && workflow.columns) {
      setColumns(JSON.parse(JSON.stringify(workflow.columns)));
    } else {
      setColumns([]);
    }
  }, [workflow, isOpen]);

  const handleAddField = (colIndex) => {
    const newCols = [...columns];
    if (!newCols[colIndex].customFields) newCols[colIndex].customFields = [];
    newCols[colIndex].customFields.push({ name: '', type: 'text' });
    setColumns(newCols);
  };

  const handleRemoveField = (colIndex, fieldIndex) => {
    const newCols = [...columns];
    newCols[colIndex].customFields.splice(fieldIndex, 1);
    setColumns(newCols);
  };

  const handleFieldChange = (colIndex, fieldIndex, key, value) => {
    const newCols = [...columns];
    newCols[colIndex].customFields[fieldIndex][key] = value;
    setColumns(newCols);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await saveWorkflow({
        ...workflow,
        columns: columns
      });
      onClose();
    } catch (e) {
      alert("Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  };

  if (!workflow) return null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content maxWidth="600px" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
        <Dialog.Title>Editar Etapas: {workflow.name}</Dialog.Title>
        <Dialog.Description size="2" mb="4" color="gray">
          Configure campos exclusivos que aparecerão apenas quando o ticket estiver em cada etapa específica.
        </Dialog.Description>

        <Flex direction="column" gap="4">
          {columns.map((col, colIndex) => (
            <Card key={col.id} variant="surface">
              <Flex justify="between" align="center" mb="3">
                <Flex align="center" gap="2">
                  <Badge color="blue">{col.title}</Badge>
                  <Text size="2" color="gray">({col.id})</Text>
                </Flex>
                <Button size="1" variant="soft" onClick={() => handleAddField(colIndex)}>
                  <Plus size={14} /> Adicionar Campo
                </Button>
              </Flex>

              {(!col.customFields || col.customFields.length === 0) ? (
                <Text size="2" color="gray">Nenhum campo exclusivo nesta etapa.</Text>
              ) : (
                <Flex direction="column" gap="3">
                  {col.customFields.map((field, fieldIndex) => (
                    <Flex key={fieldIndex} gap="2" align="center">
                      <TextField.Root 
                        placeholder="Nome do Campo (Ex: Link do PR)"
                        value={field.name}
                        onChange={(e) => handleFieldChange(colIndex, fieldIndex, 'name', e.target.value)}
                        style={{ flex: 2 }}
                      />
                      <Select.Root 
                        value={field.type} 
                        onValueChange={(val) => handleFieldChange(colIndex, fieldIndex, 'type', val)}
                      >
                        <Select.Trigger style={{ flex: 1 }} />
                        <Select.Content>
                          <Select.Item value="text">Texto Curto</Select.Item>
                          <Select.Item value="textarea">Texto Longo</Select.Item>
                          <Select.Item value="number">Número</Select.Item>
                          <Select.Item value="link">URL / Link</Select.Item>
                          <Select.Item value="date">Data</Select.Item>
                          <Select.Item value="select">Lista (Select)</Select.Item>
                        </Select.Content>
                      </Select.Root>
                      
                      {field.type === 'select' && (
                        <TextField.Root 
                          placeholder="Opções separadas por vírgula (Ex: P,M,G)"
                          value={field.options || ''}
                          onChange={(e) => handleFieldChange(colIndex, fieldIndex, 'options', e.target.value)}
                          style={{ flex: 2 }}
                        />
                      )}

                      <IconButton size="2" color="red" variant="soft" onClick={() => handleRemoveField(colIndex, fieldIndex)}>
                        <X size={16} />
                      </IconButton>
                    </Flex>
                  ))}
                </Flex>
              )}
            </Card>
          ))}
        </Flex>

        <Flex gap="3" mt="5" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray" type="button" disabled={loading}>
              Cancelar
            </Button>
          </Dialog.Close>
          <Button onClick={handleSave} disabled={loading}>
            Salvar Alterações
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default WorkflowStagesModal;
