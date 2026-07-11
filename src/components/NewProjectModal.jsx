import React, { useState, useEffect } from 'react';
import { Dialog, Button, Flex, Text, TextField, TextArea, Select, Box } from '@radix-ui/themes';
import { createProject, updateProject, uploadProjectLogo } from '../services/projectService';
import { subscribeToWorkflows } from '../services/settingsService';
import { auth } from '../firebase';
import { Loader2 } from 'lucide-react';

const NewProjectModal = ({ isOpen, onClose, editingProject }) => {
  const [loading, setLoading] = useState(false);
  const [workflows, setWorkflows] = useState([]);
  const [estados, setEstados] = useState([]);
  const [municipios, setMunicipios] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    key: '',
    workflowId: '',
    workflowAtividadesId: '',
    estado: '',
    municipio: '',
    gerenteGeral: '',
    clientLogoUrl: '',
    nttLogoUrl: ''
  });
  const [clientLogoFile, setClientLogoFile] = useState(null);
  const [nttLogoFile, setNttLogoFile] = useState(null);

  useEffect(() => {
    if (editingProject) {
      setFormData({
        name: editingProject.name,
        description: editingProject.description,
        key: editingProject.key,
        workflowId: editingProject.workflowId || '',
        workflowAtividadesId: editingProject.workflowAtividadesId || '',
        estado: editingProject.estado || '',
        municipio: editingProject.municipio || '',
        gerenteGeral: editingProject.gerenteGeral || '',
        clientLogoUrl: editingProject.clientLogoUrl || '',
        nttLogoUrl: editingProject.nttLogoUrl || ''
      });
    } else {
      setFormData({ name: '', description: '', key: '', workflowId: '', workflowAtividadesId: '', estado: '', municipio: '', gerenteGeral: '', clientLogoUrl: '', nttLogoUrl: '' });
    }
    setClientLogoFile(null);
    setNttLogoFile(null);

    // Load Estados
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
      .then(res => res.json())
      .then(data => setEstados(data))
      .catch(err => console.error(err));

    const unsubscribeWorkflows = subscribeToWorkflows((data) => {
      setWorkflows(data);
    });

    return () => unsubscribeWorkflows();
  }, [editingProject, isOpen]);

  // Load Municipios when Estado changes
  useEffect(() => {
    if (formData.estado) {
      fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${formData.estado}/municipios?orderBy=nome`)
        .then(res => res.json())
        .then(data => setMunicipios(data))
        .catch(err => console.error(err));
    } else {
      setMunicipios([]);
    }
  }, [formData.estado]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.key) {
      alert("Nome e Chave (Key) são obrigatórios.");
      return;
    }
    setLoading(true);
    try {
      let savedProjectId;
      const dataToSave = {
        ...formData,
        key: formData.key.toUpperCase(),
        createdBy: auth.currentUser?.uid || 'unknown',
        leaderName: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin',
      };

      if (editingProject) {
        await updateProject(editingProject.id, dataToSave);
        savedProjectId = editingProject.id;
      } else {
        savedProjectId = await createProject(dataToSave);
      }

      // Upload logos se houver
      let updates = {};
      if (clientLogoFile) {
        const clientLogoUrl = await uploadProjectLogo(savedProjectId, clientLogoFile, 'client');
        updates.clientLogoUrl = clientLogoUrl;
      }
      if (nttLogoFile) {
        const nttLogoUrl = await uploadProjectLogo(savedProjectId, nttLogoFile, 'ntt');
        updates.nttLogoUrl = nttLogoUrl;
      }

      if (Object.keys(updates).length > 0) {
        await updateProject(savedProjectId, updates);
      }

      onClose();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar projeto.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content maxWidth="450px">
        <Dialog.Title>{editingProject ? 'Editar Projeto' : 'Novo Projeto'}</Dialog.Title>
        <Dialog.Description size="2" mb="4" color="gray">
          {editingProject ? 'Atualize as informações do seu projeto.' : 'Crie um novo espaço de trabalho para isolar suas demandas.'}
        </Dialog.Description>

        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <Flex direction="column" gap="4">
            <label>
              <Text as="div" size="2" mb="1" weight="bold">Nome do Projeto</Text>
              <TextField.Root
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Ex: Refatoração Mobile"
                required
              />
            </label>
            
            <Box>
              <Text as="div" size="2" mb="1" weight="bold">Gerente Geral</Text>
              <TextField.Root 
                placeholder="Nome do Gerente Geral do projeto..."
                name="gerenteGeral"
                value={formData.gerenteGeral}
                onChange={handleChange}
              />
            </Box>

            <label>
              <Text as="div" size="2" mb="1" weight="bold">Chave do Projeto</Text>
              <TextField.Root
                name="key"
                value={formData.key}
                onChange={handleChange}
                placeholder="Ex: RM"
                maxLength={4}
                style={{ textTransform: 'uppercase' }}
                required
              />
              <Text as="div" size="1" color="gray" mt="1">
                Usado para identificar tickets (ex: RM-1, RM-2)
              </Text>
            </label>

            <Flex gap="4">
              <label style={{ flex: 1 }}>
                <Text as="div" size="2" mb="1" weight="bold">Workflow de Demandas</Text>
                <Select.Root 
                  value={formData.workflowId} 
                  onValueChange={(val) => setFormData({...formData, workflowId: val})}
                >
                  <Select.Trigger placeholder="Selecione..." style={{ width: '100%' }} />
                  <Select.Content>
                    {workflows.filter(w => (w.board || 'demandas') === 'demandas').map(wf => (
                      <Select.Item key={wf.id} value={wf.id}>{wf.name}</Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </label>

              <label style={{ flex: 1 }}>
                <Text as="div" size="2" mb="1" weight="bold">Workflow de Atividades</Text>
                <Select.Root 
                  value={formData.workflowAtividadesId} 
                  onValueChange={(val) => setFormData({...formData, workflowAtividadesId: val})}
                >
                  <Select.Trigger placeholder="Selecione..." style={{ width: '100%' }} />
                  <Select.Content>
                    {workflows.filter(w => (w.board || 'demandas') === 'atividades').map(wf => (
                      <Select.Item key={wf.id} value={wf.id}>{wf.name}</Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </label>
            </Flex>

            <Flex gap="4">
              <label style={{ flex: 1 }}>
                <Text as="div" size="2" mb="1" weight="bold">Estado (UF)</Text>
                <Select.Root 
                  value={formData.estado} 
                  onValueChange={(val) => setFormData({...formData, estado: val, municipio: ''})}
                >
                  <Select.Trigger placeholder="Selecione..." style={{ width: '100%' }} />
                  <Select.Content>
                    {estados.map(est => (
                      <Select.Item key={est.id} value={est.sigla}>{est.nome}</Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </label>

              <label style={{ flex: 1 }}>
                <Text as="div" size="2" mb="1" weight="bold">Município</Text>
                <Select.Root 
                  value={formData.municipio} 
                  onValueChange={(val) => setFormData({...formData, municipio: val})}
                  disabled={!formData.estado}
                >
                  <Select.Trigger placeholder={formData.estado ? "Selecione..." : "Selecione um Estado primeiro"} style={{ width: '100%' }} />
                  <Select.Content>
                    {municipios.map(mun => (
                      <Select.Item key={mun.id} value={mun.nome}>{mun.nome}</Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </label>
            </Flex>

            <label>
              <Text as="div" size="2" mb="1" weight="bold">Descrição</Text>
              <TextArea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Objetivo principal deste projeto..."
                rows={3}
              />
            </label>

          <Text as="div" size="3" weight="bold" mt="4" mb="2">Imagens para Exportação PDF</Text>
          <Flex gap="4" direction="column">
            <Box>
              <Text as="div" size="2" mb="1" weight="bold">Logo do Cliente</Text>
              <Text size="1" color="gray" as="div" mb="2">Este logo aparecerá no canto superior esquerdo de todas as páginas do PDF.</Text>
              <Flex gap="3" align="center">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => setClientLogoFile(e.target.files[0])} 
                />
                {(clientLogoFile || formData.clientLogoUrl) && (
                  <img 
                    src={clientLogoFile ? URL.createObjectURL(clientLogoFile) : formData.clientLogoUrl} 
                    alt="Client Logo" 
                    style={{ height: '40px', objectFit: 'contain' }} 
                  />
                )}
              </Flex>
            </Box>

            <Box>
              <Text as="div" size="2" mb="1" weight="bold">Logo da Consultoria (NTT DATA)</Text>
              <Text size="1" color="gray" as="div" mb="2">Este logo aparecerá na capa gigante e no canto superior direito do PDF.</Text>
              <Flex gap="3" align="center">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => setNttLogoFile(e.target.files[0])} 
                />
                {(nttLogoFile || formData.nttLogoUrl) && (
                  <img 
                    src={nttLogoFile ? URL.createObjectURL(nttLogoFile) : formData.nttLogoUrl} 
                    alt="NTT Logo" 
                    style={{ height: '40px', objectFit: 'contain', backgroundColor: 'var(--gray-3)', padding: '4px', borderRadius: '4px' }} 
                  />
                )}
              </Flex>
            </Box>
          </Flex>

        </Flex>

        <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray" type="button" disabled={loading}>
                Cancelar
              </Button>
            </Dialog.Close>
            <Button type="submit" disabled={loading || !formData.name || !formData.key}>
              {loading ? <Loader2 size={16} className="spinner-icon" /> : (editingProject ? 'Salvar Alterações' : 'Criar Projeto')}
            </Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default NewProjectModal;
