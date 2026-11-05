import pathlib

dest = pathlib.Path('/Users/rhonorin/Documents/SGT-Renato/src/components/NewProjectModal.jsx')

code = """\
import React, { useState, useEffect } from 'react';
import { Dialog, Button, Flex, Text, TextField, TextArea, Select, Box, Tabs } from '@radix-ui/themes';
import { createProject, updateProject, uploadProjectLogo } from '../services/projectService';
import { subscribeToWorkflows } from '../services/settingsService';
import { auth, db } from '../firebase';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, query, orderBy,
} from 'firebase/firestore';

// ── Contratos ────────────────────────────────────────────────────────────────
function useContratos(projectId) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!projectId) return;
    const q = query(collection(db, 'projects', projectId, 'contratos'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, snap => setList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [projectId]);
  return list;
}

async function saveContrato(projectId, data, editId) {
  const payload = { ...data };
  if (editId) {
    payload.updatedAt = serverTimestamp();
    await updateDoc(doc(db, 'projects', projectId, 'contratos', editId), payload);
  } else {
    payload.createdAt = serverTimestamp();
    await addDoc(collection(db, 'projects', projectId, 'contratos'), payload);
  }
}

async function removeContrato(projectId, id) {
  await deleteDoc(doc(db, 'projects', projectId, 'contratos', id));
}

// ── Codigos de Projeto ───────────────────────────────────────────────────────
function useCodigosProjeto(projectId) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!projectId) return;
    const q = query(collection(db, 'projects', projectId, 'codigosProjeto'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, snap => setList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [projectId]);
  return list;
}

async function saveCodigo(projectId, data, editId) {
  const payload = { ...data };
  if (editId) {
    payload.updatedAt = serverTimestamp();
    await updateDoc(doc(db, 'projects', projectId, 'codigosProjeto', editId), payload);
  } else {
    payload.createdAt = serverTimestamp();
    await addDoc(collection(db, 'projects', projectId, 'codigosProjeto'), payload);
  }
}

async function removeCodigo(projectId, id) {
  await deleteDoc(doc(db, 'projects', projectId, 'codigosProjeto', id));
}

const SERVICO_OPTIONS = [
  'Corretiva (Application Management)',
  'Evolutiva (Application Develop)',
];

const mkContrato = () => ({ codigoContrato: '', nome: '', status: 'Aberto', escopoGeral: '', dataInicio: '', dataFim: '' });
const mkCodigo   = () => ({ projeto: '', status: '', tipologia: '', resumo: '', contratoId: '', servico: '' });

function fmtDate(v) {
  if (!v) return '\u2014';
  const m = String(v).match(/^(\\d{4})-(\\d{2})-(\\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

// ── ContratoForm ─────────────────────────────────────────────────────────────
function ContratoForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial ? { ...initial } : mkContrato());
  const [saving, setSaving] = useState(false);
  const hc = f => e => setForm(p => ({ ...p, [f]: e.target.value }));
  const onSubmit = async e => {
    e.preventDefault();
    if (!form.codigoContrato.trim()) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };
  return (
    <form onSubmit={onSubmit}>
      <Flex direction="column" gap="3" mb="3" p="3"
        style={{ background: 'var(--gray-2)', border: '1px solid var(--gray-5)', borderRadius: 8 }}>
        <Flex gap="3">
          <Box style={{ flex: 1 }}>
            <Text as="div" size="2" mb="1" weight="bold">Codigo Contrato *</Text>
            <TextField.Root placeholder="Ex: CTR-001" value={form.codigoContrato}
              onChange={hc('codigoContrato')} required />
          </Box>
          <Box style={{ flex: '0 0 130px' }}>
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
          <TextField.Root placeholder="Nome do contrato" value={form.nome} onChange={hc('nome')} />
        </Box>
        <Box>
          <Text as="div" size="2" mb="1" weight="bold">Escopo Geral</Text>
          <TextArea placeholder="Descricao do escopo..." rows={2} value={form.escopoGeral}
            onChange={hc('escopoGeral')} />
        </Box>
        <Flex gap="3">
          <Box style={{ flex: 1 }}>
            <Text as="div" size="2" mb="1" weight="bold">Data Inicio</Text>
            <TextField.Root type="date" value={form.dataInicio} onChange={hc('dataInicio')} />
          </Box>
          <Box style={{ flex: 1 }}>
            <Text as="div" size="2" mb="1" weight="bold">Data Fim</Text>
            <TextField.Root type="date" value={form.dataFim} onChange={hc('dataFim')} />
          </Box>
        </Flex>
        <Flex gap="2" justify="end">
          <Button type="button" variant="soft" color="gray" size="2" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" size="2" disabled={saving}>
            {saving ? <Loader2 size={13} className="spinner-icon" /> : 'Salvar'}
          </Button>
        </Flex>
      </Flex>
    </form>
  );
}

// ── CodigoForm ────────────────────────────────────────────────────────────────
function CodigoForm({ initial, contratos, onSave, onCancel }) {
  const [form, setForm] = useState(initial ? { ...initial } : mkCodigo());
  const [saving, setSaving] = useState(false);
  const hc = f => e => setForm(p => ({ ...p, [f]: e.target.value }));
  const onSubmit = async e => {
    e.preventDefault();
    if (!form.projeto.trim()) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };
  return (
    <form onSubmit={onSubmit}>
      <Flex direction="column" gap="3" mb="3" p="3"
        style={{ background: 'var(--gray-2)', border: '1px solid var(--gray-5)', borderRadius: 8 }}>
        <Flex gap="3">
          <Box style={{ flex: 1 }}>
            <Text as="div" size="2" mb="1" weight="bold">Projeto *</Text>
            <TextField.Root placeholder="Codigo do projeto" value={form.projeto}
              onChange={hc('projeto')} required />
          </Box>
          <Box style={{ flex: 1 }}>
            <Text as="div" size="2" mb="1" weight="bold">Status</Text>
            <TextField.Root placeholder="Ex: Ativo" value={form.status} onChange={hc('status')} />
          </Box>
        </Flex>
        <Box>
          <Text as="div" size="2" mb="1" weight="bold">Tipologia</Text>
          <TextField.Root placeholder="Ex: Fixed Price" value={form.tipologia}
            onChange={hc('tipologia')} />
        </Box>
        <Box>
          <Text as="div" size="2" mb="1" weight="bold">Resumo</Text>
          <TextArea placeholder="Descricao resumida..." rows={2} value={form.resumo}
            onChange={hc('resumo')} />
        </Box>
        <Flex gap="3">
          <Box style={{ flex: 1 }}>
            <Text as="div" size="2" mb="1" weight="bold">Contrato</Text>
            <Select.Root value={form.contratoId || ''}
              onValueChange={v => setForm(p => ({ ...p, contratoId: v }))}>
              <Select.Trigger placeholder="Selecionar..." style={{ width: '100%' }} />
              <Select.Content>
                <Select.Item value="">— Nenhum —</Select.Item>
                {contratos.map(c => (
                  <Select.Item key={c.id} value={c.id}>
                    {c.codigoContrato}{c.nome ? ` — ${c.nome}` : ''}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Box>
          <Box style={{ flex: 1 }}>
            <Text as="div" size="2" mb="1" weight="bold">Servico</Text>
            <Select.Root value={form.servico || ''}
              onValueChange={v => setForm(p => ({ ...p, servico: v }))}>
              <Select.Trigger placeholder="Selecionar..." style={{ width: '100%' }} />
              <Select.Content>
                <Select.Item value="">— Nenhum —</Select.Item>
                {SERVICO_OPTIONS.map(o => <Select.Item key={o} value={o}>{o}</Select.Item>)}
              </Select.Content>
            </Select.Root>
          </Box>
        </Flex>
        <Flex gap="2" justify="end">
          <Button type="button" variant="soft" color="gray" size="2" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" size="2" disabled={saving}>
            {saving ? <Loader2 size={13} className="spinner-icon" /> : 'Salvar'}
          </Button>
        </Flex>
      </Flex>
    </form>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
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
  const codigos   = useCodigosProjeto(editingProject?.id);

  const [showContratoForm, setShowContratoForm] = useState(false);
  const [editingContrato,  setEditingContrato]  = useState(null);
  const [showCodigoForm,   setShowCodigoForm]   = useState(false);
  const [editingCodigo,    setEditingCodigo]    = useState(null);

  useEffect(() => {
    setActiveTab('geral');
    setShowContratoForm(false); setEditingContrato(null);
    setShowCodigoForm(false);   setEditingCodigo(null);
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
      setFormData({ name: '', description: '', key: '', workflowId: '',
        workflowAtividadesId: '', estado: '', municipio: '', gerenteGeral: '',
        clientLogoUrl: '', nttLogoUrl: '', cliente: '' });
    }
    setClientLogoFile(null); setNttLogoFile(null);
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
      .then(r => r.json()).then(setEstados).catch(() => {});
    const unsub = subscribeToWorkflows(setWorkflows);
    return () => unsub();
  }, [editingProject, isOpen]);

  useEffect(() => {
    if (formData.estado) {
      fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${formData.estado}/municipios?orderBy=nome`)
        .then(r => r.json()).then(setMunicipios).catch(() => {});
    } else { setMunicipios([]); }
  }, [formData.estado]);

  const handleChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSave = async () => {
    if (!formData.name || !formData.key) { alert('Nome e Chave sao obrigatorios.'); return; }
    setLoading(true);
    try {
      const dataToSave = {
        ...formData,
        key: formData.key.toUpperCase(),
        created
