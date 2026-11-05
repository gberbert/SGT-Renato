import React, { useState, useEffect } from 'react';
import { Dialog, Button, Flex, Text, TextField, TextArea, Select, Box, Tabs } from '@radix-ui/themes';
import { createProject, updateProject, uploadProjectLogo } from '../services/projectService';
import { subscribeToWorkflows } from '../services/settingsService';
import { auth, db } from '../firebase';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, query, orderBy,
} from 'firebase/firestore';

// ── Contratos subcollection helpers ─────────────────────────────────────────
function useContratos(projectId) {
  const [contratos, setContratos] = useState([]);
  useEffect(() => {
    if (!projectId) return;
    const q = query(collection(db, 'projects', projectId, 'contratos'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, snap => setContratos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [projectId]);
  return contratos;
}

async function saveContrato(projectId, data, editId) {
  if (editId) {
    await updateDoc(doc(db, 'projects', projectId, 'contratos', editId), { ...data, updatedAt: serverTimestamp() });
  } else {
    await addDoc(collection(db, 'projects', projectId, 'contratos'), { ...data, createdAt: serverTimestamp() });
  }
}

async function deleteContrato(projectId, contratoId) {
  await deleteDoc(doc(db, 'projects', projectId, 'contratos', contratoId));
}

// ── Códigos de Projeto subcollection helpers ──────────────────────────────────
function useCodigosProjeto(projectId) {
  const [codigos, setCodigos] = useState([]);
  useEffect(() => {
    if (!projectId) return;
    const q = query(collection(db, 'projects', projectId, 'codigosProjeto'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, snap => setCodigos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [projectId]);
  return codigos;
}

async function saveCodigo(projectId, data, editId) {
  if (editId) {
    await updateDoc(doc(db, 'projects', projectId, 'codigosProjeto', editId), { ...data, updatedAt: serverTimestamp() });
  } else {
    await addDoc(collection(db, 'projects', projectId, 'codigosProjeto'), { ...data, createdAt: serverTimestamp() });
  }
}

async function deleteCodigo(projectId, codigoId) {
  await deleteDoc(doc(db, 'projects', projectId, 'codigosProjeto', codigoId));
}

const SERVICO_OPTIONS = [
  'Corretiva (Application Management)',
  'Evolutiva (Application Develop)',
];

const emptyContrato = () => ({ codigoContrato: '', nome: '', status: 'Aberto', escopoGeral: '', dataInicio: '', dataFim: '' });
const emptyCodigo = () => ({ projeto: '', status: '', tipologia: '', resumo: '', contratoId: '', servico: '' });

// ── ContratoForm ──────────────────────────────────────────────────────────────
function ContratoForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial ? { ...initial } : emptyContrato());
  const [saving, setSaving] = useState(false);
  const h = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.codigoContrato.trim()) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Flex direction="column" gap="3" p="3" style={{ background: 'var(--gray-2)', borderRadius: 8, border: '1px solid var(--gray-5)' }}>
        <Flex gap="3">
          <Box style={{ flex: 1 }}>
            <Text as="div" size="2" mb="1" weight="bold">Código Contrato *</Text>
            <TextField.Root placeholder="Ex: CTR-001" value={form.codigoContrato} onChange={h('codigoContrato')} required />
          </Box>
          <Box style={{ flex: 1 }}>
            <Text as="div" size="2" mb="1" weight="bold">Status</Text>
            <Select.Root value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
              <Select.Trigger style={{ width: '100%' }} />
              <Select.Content>
                <Select.Item value="Aberto">Aberto</Select.Item>
                <Select.Item value="Fechado">Fechado</Select.Item>
              </Select.Content>
            </Select.Root>
          </Box>
        </Flex>
        <Box>
          <Text as="div" size="2" mb="1" weight="bold">Nome</Text>
          <TextField.Root placeholder="Nome do contrato" value={form.nome} onChange={h('nome')} />
        </Box>
        <Box>
          <Text as="div" size="2" mb="1" weight="bold">Escopo Geral</Text>
          <TextArea placeholder="Descrição do escopo..." rows={2} value={form.escopoGeral} onChange={h('escopoGeral')} />
        </Box>
        <Flex gap="3">
          <Box style={{ flex: 1 }}>
            <Text as="div" size="2" mb="1" weight="bold">Data Início</Text>
            <TextField.Root type="date" value={form.dataInicio} onChange={h('dataInicio')} />
          </Box>
          <Box style={{ flex: 1 }}>
            <Text as="div" size="2" mb="1" weight="bold">Data Fim</Text>
            <TextField.Root type="date" value={form.dataFim} onChange={h('dataFim')} />
          </Box>
        </Flex>
        <Flex gap="3" justify="end">
          <Button type="button" variant="soft" color="gray" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 size={14} className="spinner-icon" /> : 'Salvar'}
          </Button>
        </Flex>
      </Flex>
    </form>
  );
}

// ── CodigoForm ────────────────────────────────────────────────────────────────
function CodigoForm({ initial, contratos, onSave, onCancel }) {
  const [form, setForm] = useState(initial ? { ...initial } : emptyCodigo());
  const [saving, setSaving] = useState(false);
  const h = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.projeto.trim()) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Flex direction="column" gap="3" p="3" style={{ background: 'var(--gray-2)', borderRadius: 8, border: '1px solid var(--gray-5)' }}>
        <Flex gap="3">
          <Box style={{ flex: 1 }}>
            <Text as="div" size="2" mb="1" weight="bold">Projeto *</Text>
            <TextField.Root placeholder="Código do projeto" value={form.projeto} onChange={h('projeto')} required />
          </Box>
          <Box style={{ flex: 1 }}>
            <Text as="div" size="2" mb="1" weight="bold">Status</Text>
            <TextField.Root placeholder="Ex: Ativo" value={form.status} onChange={h('status')} />
          </Box>
        </Flex>
        <Box>
          <Text as="div" size="2" mb="1" weight="bold">Tipologia</Text>
          <TextField.Root placeholder="Ex: Fixed Price" value={form.tipologia} onChange={h('tipologia')} />
        </Box>
        <Box>
          <Text as="div" size="2" mb="1" weight="bold">Resumo</Text>
          <TextArea placeholder="Descrição resumida..." rows={2} value={form.resumo} onChange={h('resumo')} />
        </Box>
        <Flex gap="3">
          <Box style={{ flex: 1 }}>
            <Text as="div" size="2" mb="1" weight="bold">Contrato</Text>
            <Select.Root value={form.contratoId || ''} onValueChange={v => setForm(p => ({ ...p, contratoId: v }))}>
              <Select.Trigger placeholder="Selecionar..." style={{ width: '100%' }} />
              <Select.Content>
                <Select.Item value="">— Nenhum —</Select.Item>
                {contratos.map(c => (
                  <Select.Item key={c.id} value={c.id}>{c.codigoContrato}{c.nome ? ` — ${c.nome}` : ''}</Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Box>
          <Box style={{ flex: 1 }}>
            <Text as="div" size="2" mb="1" weight="bold">Serviço</Text>
            <Select.Root value={form.servico || ''} onValueChange={v => setForm(p => ({ ...p, servico: v }))}>
              <Select.Trigger placeholder="Selecionar..." style={{ width: '100%' }} />
              <Select.Content>
                <Select.Item value="">— Nenhum —</Select.Item>
                {SERVICO_OPTIONS.map(o => <Select.Item key={o} value={o}>{o}</Select.Item>)}
              </Select.Content>
            </Select.Root>
          </Box>
        </Flex>
        <Flex gap="3" justify="end">
          <Button type="button" variant="soft" color="gray" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 size={14} className="spinner-icon" /> : 'Salvar'}
          </Button>
        </Flex>
      </Flex>
    </form>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
const NewProjectModal = ({ isOpen, onClose, editingProject }) => {
  const [loading, setLoading] = useState(false);
  const [workflows, setWorkflows] = useState([]);
  const [estados, setEstados] = useState([]);
  const [municipios, setMunicipios] = useState([]);
  const [activeTab, setActiveTab] = useState('geral');
  const [formData, setFormData] = useState({
    name: '', description: '', key: '', workflowId: '', workflowAtividadesId: '',
    estado: '', municipio: '', gerenteGeral: '', clientLogoUrl: '', nttLogoUrl: '', cliente: '',
  });
  const [clientLogoFile, setClientLogoFile] = useState(null);
  const [nttLogoFile, setNttLogoFile] = useState(null);

  const contratos = useContratos(editingProject?.id);
  const codigos = useCodigosProjeto(editingProject?.id);

  const [showContratoForm, setShowContratoForm] = useState(false);
  const [editingContrato, setEditingContrato] = useState(null);
  const [showCodigoForm, setShowCodigoForm] = useState(false);
  const [editingCodigo, setEditingCodigo] = useState(null);

  useEffect(() => {
    setActiveTab('geral');
    setShowContratoForm(false);
    setEditingContrato(null);
    setShowCodigoForm(false);
    setEditingCodigo(null);

    if (editingProject) {
      setFormData({
        name: editingProject.name || '',
        description: editingProject.description || '',
        key: editingProject.key || '',
        workflowId: editingProject.workflowId || '',
        workflowAtividadesId: editingProject.workflowAtividadesId || '',
        estado: editingProject.estado || '',
        municipio: editingProject.municipio || '',
        gerenteGeral: editingProject.gerenteGeral || '',
        clientLogoUrl: editingProject.clientLogoUrl || '',
        nttLogoUrl: editingProject.nttLogoUrl || '',
        cliente: editingProject.cliente || '',
      });
    } else {
      setFormData({ name: '', description: '', key: '', workflowId: '', workflowAtividadesId: '', estado: '', municipio: '', gerenteGeral: '', clientLogoUrl: '', nttLogoUrl: '', cliente: '' });
    }
    setClientLogoFile(null);
    setNttLogoFile(null);

    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
      .then(res => res.json())
      .then(data => setEstados(data))
      .catch(() => {});

    const unsubscribeWorkflows = subscribeToWorkflows(setWorkflows);
    return () => unsubscribeWorkflows();
  }, [editingProject, isOpen]);

  useEffect(() => {
    if (formData.estado) {
      fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${formData.estado}/municipios?orderBy=nome`)
        .then(res => res.json())
        .then(data => setMunicipios(data))
        .catch(() => {});
    } else {
      setMunicipios([]);
    }
  }, [formData.estado]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSave = async () => {
    if (!formData.name || !formData.key) {
      alert('Nome e Chave (Key) são obrigatórios.');
      return;
    }
    setLoading(true);
    try {
      const dataToSave = {
        ...formData,
        key: formData.key.toUpperCase(),
        createdBy: auth.currentUser?.uid || 'unknown',
        leaderName: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin',
      };
      let savedProjectId;
      if (editingProject) {
        await updateProject(editingProject.id, dataToSave);
        savedProjectId = editingProject.id;
      } else {
        savedProjectId = await createProject(dataToSave);
      }
      let updates = {};
      if (clientLogoFile) updates.clientLogoUrl = await uploadProjectLogo(savedProjectId, clientLogoFile, 'client');
      if (nttLogoFile)    updates.nttLogoUrl    = await uploadProjectLogo(savedProjectId, nttLogoFile,    'ntt');
      if (Object.keys(updates).length > 0) await updateProject(savedProjectId, updates);
      onClose();
    } catch (err) { console.error(err); alert('Erro ao salvar projeto.'); }
    finally { setLoading(false); }
  };

  const isEditMode = !!editingProject;

  return (
    <Dialog.Root open={isOpen} onOpenChange={open => !open && onClose()}>
      <Dialog.Content
        maxWidth={isEditMode ? '620px' : '450px'}
        onInteractOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
      >
        <Dialog.Title>{isEditMode ? 'Editar Projeto' : 'Novo Projeto'}</Dialog.Title>
        <Dialog.Description size="2" mb="4" color="gray">
          {isEditMode ? 'Atualize as informações do seu projeto.' : 'Crie um novo espaço de trabalho para isolar suas demandas.'}
        </Dialog.Description>

        {isEditMode ? (
          <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
            <Tabs.List mb="4">
              <Tabs.Trigger value="geral">Geral</Tabs.Trigger>
              <Tabs.Trigger value="contratos">Contratos</Tabs.Trigger>
              <Tabs.Trigger value="codigos">Códigos de Projeto</Tabs.Trigger>
            </Tabs.List>

            {/* TAB GERAL */}
            <Tabs.Content value="geral">
              <Flex direction="column" gap="4">
                <label>
                  <Text as="div" size="2" mb="1" weight="bold">Nome do Projeto</Text>
                  <TextField.Root name="name" value={formData.name} onChange={handleChange} required />
                </label>
                <Box>
                  <Text as="div" size="2" mb="1" weight="bold">Gerente Geral</Text>
                  <TextField.Root placeholder="Nome do Gerente Geral..." name="gerenteGeral" value={formData.gerenteGeral} onChange={handleChange} />
                </Box>
                <label>
                  <Text as="div" size="2" mb="1" weight="bold">Chave do Projeto</Text>
                  <TextField.Root name="key" value={formData.key} onChange={handleChange} maxLength={4} style={{ textTransform: 'uppercase' }} required />
                  <Text as="div" size="1" color="gray" mt="1">Usado para identificar tickets (ex: RM-1, RM-2)</Text>
                </label>
                <label>
                  <Text as="div" size="2" mb="1" weight="bold">Cliente (Nome na Exportação PDF)</Text>
                  <TextField.Root name="cliente" value={formData.cliente} onChange={handleChange} placeholder="Ex: CPFL Energia" />
                </label>
                <Flex gap="4">
                  <label style={{ flex: 1 }}>
                    <Text as="div" size="2" mb="1" weight="bold">Workflow de Demandas</Text>
                    <Select.Root value={formData.workflowId} onValueChange={val => setFormData({ ...formData, workflowId: val })}>
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
                    <Select.Root value={formData.workflowAtividadesId} onValueChange={val => setFormData({ ...formData, workflowAtividadesId: val })}>
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
                    <Select.Root value={formData.estado} onValueChange={val => setFormData({ ...formData, estado: val, municipio: '' })}>
                      <Select.Trigger placeholder="Selecione..." style={{ width: '100%' }} />
                      <Select.Content>
                        {estados.map(est => <Select.Item key={est.id} value={est.sigla}>{est.nome}</Select.Item>)}
                      </Select.Content>
                    </Select.Root>
                  </label>
                  <label style={{ flex: 1 }}>
                    <Text as="div" size="2" mb="1" weight="bold">Município</Text>
                    <Select.Root value={formData.municipio} onValueChange={val => setFormData({ ...formData, municipio: val })} disabled={!formData.estado}>
                      <Select.Trigger placeholder={formData.estado ? 'Selecione...' : 'Selecione um Estado primeiro'} style={{ width: '100%' }} />
                      <Select.Content>
                        {municipios.map(mun => <Select.Item key={mun.id} value={mun.nome}>{mun.nome}</Select.Item>)}
                      </Select.Content>
                    </Select.Root>
                  </label>
                </Flex>
                <label>
                  <Text as="div" size="2" mb="1" weight="bold">Descrição</Text>
                  <TextArea name="description" value={formData.description} onChange={handleChange} placeholder="Objetivo principal deste projeto..." rows={3} />
                </label>
                <Text as="div" size="3" weight="bold" mt="4" mb="2">Imagens para Exportação PDF</Text>
                <Box>
                  <Text as="div" size="2" mb="1" weight="bold">Logo do Cliente</Text>
                  <Text size="1" color="gray" as="div" mb="2">Este logo aparecerá no canto superior esquerdo de todas as páginas do PDF.</Text>
                  <Flex gap="3" align="center">
                    <input type="file" accept="image/*" onChange={e => setClientLogoFile(e.target.files[0])} />
                    {(clientLogoFile || formData.clientLogoUrl) && (
                      <img src={clientLogoFile ? URL.createObjectURL(clientLogoFile) : formData.clientLogoUrl} alt="Client Logo" style={{ height: 40, objectFit: 'contain' }} />
                    )}
                  </Flex>
                </Box>
                <Box>
                  <Text as="div" size="2" mb="1" weight="bold">Logo da Consultoria (NTT DATA)</Text>
                  <Text size="1" color="gray" as="div" mb="2">Este logo aparecerá na capa gigante e no canto superior direito do PDF.</Text>
                  <Flex gap="3" align="center">
                    <input type="file" accept="image/*" onChange={e => setNttLogoFile(e.target.files[0])} />
                    {(nttLogoFile || formData.nttLogoUrl) && (
                      <img src={nttLogoFile ? URL.createObjectURL(nttLogoFile) : formData.nttLogoUrl} alt="NTT Logo" style={{ height: 40, objectFit: 'contain', backgroundColor: 'var(--gray-3)', padding: 4, borderRadius: 4 }} />
                    )}
                  </Flex>
                </Box>
              </Flex>
              <Flex gap="3" mt="4" justify="end">
                <Dialog.Close><Button variant="soft" color="gray" type="button" disabled={loading}>Cancelar</Button></Dialog.Close>
                <Button onClick={handleSave} disabled={loading || !formData.name || !formData.key}>
                  {loading ? <Loader2 size={16} className="spinner-icon" /> : 'Salvar Alterações'}
                </Button>
              </Flex>
            </Tabs.Content>

            {/* TAB CONTRATOS */}
            <Tabs.Content value="contratos">
              <Flex justify="between" align="center" mb="3">
                <Text size="3" weight="bold">Contratos</Text>
                {!showContratoForm && (
                  <Button size="2" onClick={() => { setShowContratoForm(true); setEditingContrato(null); }}>
                    <Plus size={14} /> Novo Contrato
                  </Button>
                )}
              </Flex>
              {showContratoForm && (
                <ContratoForm
                  initial={editingContrato}
                  onSave={async data => {
                    await saveContrato(editingProject.id, data, editingContrato?.id || null);
                    setShowContratoForm(false); setEditingContrato(null);
                  }}
                  onCancel={() => { setShowContratoForm(false); setEditingContrato(null); }}
                />
              )}
              {contratos.length === 0 && !showContratoForm && (
                <Text size="2" color="gray">Nenhum contrato cadastrado. Clique em "Novo Contrato" para adicionar.</Text>
              )}
              <Flex direction="column" gap="2">
                {contratos.map(c => (
                  <Flex key={c.id} align="center" gap="2" p="2"
                    style={{ background: 'var(--gray-2)', border: '1px solid var(--gray-4)', borderRadius: 6 }}>
                    <Box style={{ flex: 1 }}>
                      <Flex align="center" gap="2" wrap="wrap">
                        <Text weight="bold" size="2">{c.codigoContrato}</Text>
                        {c.nome && <Text size="2" color="gray">— {c.nome}</Text>}
                        <Text size="1" style={{ padding: '1px 6px', borderRadius: 8,
                          background: c.status === 'Aberto' ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.12)',
                          color: c.status === 'Aberto' ? '#4ade80' : '#f87171',
                          border: `1px solid ${c.status === 'Aberto' ? 'rgba(74,222,128,0.4)' : 'rgba(239,68,68,0.3)'}`,
                        }}>{c.status}</Text>
                      </Flex>
                      {(c.dataInicio || c.dataFim) && (
                        <Text size="1" color="gray">
                          {c.dataInicio && `Início: ${c.dataInicio}`}{c.dataInicio && c.dataFim ? ' · ' : ''}{c.dataFim && `Fim: ${c.dataFim}`}
                        </Text>
                      )}
                      {c.escopoGeral && <Text size="1" color="gray" style={{ display: 'block', marginTop: 2 }}>{c.escopoGeral}</Text>}
                    </Box>
                    <Button size="1" variant="ghost" onClick={() => { setEditingContrato(c); setShowContratoForm(true); }}><Pencil size={13} /></Button>
                    <Button size="1" variant="ghost" color="red" onClick={() => window.confirm('Excluir este contrato?') && deleteContrato(editingProject.id, c.id)}><Trash2 size={13} /></Button>
                  </Flex>
                ))}
              </Flex>
            </Tabs.Content>

            {/* TAB CODIGOS DE PROJETO */}
            <Tabs.Content value="codigos">
              <Flex justify="between" align="center" mb="3">
                <Text size="3" weight="bold">Códigos de Projeto</Text>
                {!showCodigoForm && (
                  <Button size="2" onClick={() => { setShowCodigoForm(true); setEditingCodigo(null); }}>
                    <Plus size={14} /> Novo Código
                  </Button>
                )}
              </Flex>
              {showCodigoForm && (
                <CodigoForm
                  initial={editingCodigo}
                  contratos={contratos}
                  onSave={async data => {
                    await saveCodigo(editingProject.id, data, editingCodigo?.id || null);
                    setShowCodigoForm(false); setEditingCodigo(null);
                  }}
                  onCancel={() => { setShowCodigoForm(false); setEditingCodigo(null); }}
                />
              )}
              {codigos.length === 0 && !showCodigoForm && (
                <Text size="2" color="gray">Nenhum código cadastrado. Clique em "Novo Código" para adicionar.</Text>
              )}
              <Flex direction="column" gap="2">
                {codigos.map(cd => {
                  const contrato = contratos.find(c => c.id === cd.contratoId);
                  return (
                    <Flex key={cd.id} align="center" gap="2" p="2"
                      style={{ background: 'var(--gray-2)', border: '1px solid var(--gray-4)', borderRadius: 6 }}>
                      <Box style={{ flex: 1 }}>
                        <Flex align="center" gap="2" wrap="wrap">
                          <Text weight="bold" size="2">{cd.projeto}</Text>
                          {cd.status && <Text size="1" color="gray">{cd.status}</Text>}
                          {cd.tipologia && <Text size="1" color="blue">{cd.tipologia}</Text>}
                        </Flex>
                        {cd.resumo && <Text size="1" color="gray" style={{ display: 'block', marginTop: 2 }}>{cd.resumo}</Text>}
                        <Flex gap="2" mt="1" wrap="wrap">
                          {contrato && <Text size="1" color="gray">Contrato: {contrato.codigoContrato}</Text>}
                          {cd.servico && <Text size="1" color="gray">{cd.servico}</Text>}
                        </Flex>
                      </Box>
                      <Button size="1" variant="ghost" onClick={() => { setEditingCodigo(cd); setShowCodigoForm(true); }}><Pencil size={13} /></Button>
                      <Button size="1" variant="ghost" color="red" onClick={() => window.confirm('Excluir este código?') && deleteCodigo(editingProject.id, cd.id)}><Trash2 size={13} /></Button>
                    </Flex>
                  );
                })}
              </Flex>
            </Tabs.Content>

          </Tabs.Root>
        ) : (
          /* ── NOVO PROJETO (sem tabs) ── */
          <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
            <Flex direction="column" gap="4">
              <label>
                <Text as="div" size="2" mb="1" weight="bold">Nome do Projeto</Text>
                <TextField.Root name="name" value={formData.name} onChange={handleChange} placeholder="Ex: Refatoração Mobile" required />
              </label>
              <Box>
                <Text as="div" size="2" mb="1" weight="bold">Gerente Geral</Text>
                <TextField.Root placeholder="Nome do Gerente Geral do projeto..." name="gerenteGeral" value={formData.gerenteGeral} onChange={handleChange} />
              </Box>
              <label>
                <Text as="div" size="2" mb="1" weight="bold">Chave do Projeto</Text>
                <TextField.Root name="key" value={formData.key} onChange={handleChange} placeholder="Ex: RM" maxLength={4} style={{ textTransform: 'uppercase' }} required />
                <Text as="div" size="1" color="gray" mt="1">Usado para identificar tickets (ex: RM-1, RM-2)</Text>
              </label>
              <label>
                <Text as="div" size="2" mb="1" weight="bold">Cliente (Nome na Exportação PDF)</Text>
                <TextField.Root name="cliente" value={formData.cliente} onChange={handleChange} placeholder="Ex: CPFL Energia" />
              </label>
              <label>
                <Text as="div" size="2" mb="1" weight="bold">Descrição</Text>
                <TextArea name="description" value={formData.description} onChange={handleChange} placeholder="Objetivo principal deste projeto..." rows={3} />
              </label>
            </Flex>
            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close><Button variant="soft" color="gray" type="button" disabled={loading}>Cancelar</Button></Dialog.Close>
              <Button type="submit" disabled={loading || !formData.name || !formData.key}>
                {loading ? <Loader2 size={16} className="spinner-icon" /> : 'Criar Projeto'}
              </Button>
            </Flex>
          </form>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default NewProjectModal;
