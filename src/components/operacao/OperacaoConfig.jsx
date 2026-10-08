import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Flex, Text, Card, Badge, Callout, Table, Grid, Button, Dialog, TextArea, Progress } from '@radix-ui/themes';
import { Settings, FileText, Info, Database, Copy, Pencil, Check, Loader2, RotateCcw, Lock, Play, Search, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { getOperacaoJqlConfig } from '../../utils/jqlCargaClient';
import { getPermissionProfile } from '../../services/permissionService';
import { previewJiraGlobalCarga, runJiraGlobalCarga } from '../../services/operacaoSyncService';
import { logSyncAction } from '../../services/auditService';
import { formatCallableError } from '../../utils/callableError';
import { useOperacaoRadar } from '../../contexts/OperacaoRadarContext';
import { getSyncState, subscribeSyncState, startSyncLoading, setSyncRun, finishSyncLoading } from '../../services/operacaoSyncStore';
import CargaFieldCatalogPanel from './CargaFieldCatalog';

const JQL_EDIT_PERMISSION_MAP = {
  problemas: 'JQL_EDIT_PROBLEMAS',
  'demanda-fast': 'JQL_EDIT_DEMANDA_FAST',
  demanda: 'JQL_EDIT_DEMANDA',
  incidente: 'JQL_EDIT_INCIDENTE',
  solicitacao: 'JQL_EDIT_SOLICITACAO',
  catalogo: 'JQL_EDIT_CATALOGO',
};

async function loadJqlOverrides() {
  try {
    const snap = await getDoc(doc(db, 'operacao_config', 'jql_overrides'));
    return snap.exists() ? (snap.data() || {}) : {};
  } catch { return {}; }
}
async function saveJqlOverride(id, jql) { await setDoc(doc(db, 'operacao_config', 'jql_overrides'), { [id]: jql }, { merge: true }); }
async function clearJqlOverride(id) { await setDoc(doc(db, 'operacao_config', 'jql_overrides'), { [id]: null }, { merge: true }); }

const fmt = (v) => v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString('pt-BR');
let _ctrl = null;

function useSyncStoreState() {
  const [s, set] = useState(getSyncState);
  useEffect(() => subscribeSyncState(set), []);
  return s;
}

function ProgressPanel({ syncRun, syncLoading }) {
  if (!syncRun && !syncLoading) return null;
  const pct = Math.max(0, Math.min(100, syncRun?.percent ?? 0));
  const ok = syncRun?.status === 'success';
  const running = syncLoading || syncRun?.status === 'running';
  const batches = syncRun?.batchProgress || [];
  return (
    <Box style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 10, padding: 16, border: `1px solid ${ok ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.1)'}`, marginTop: 12 }}>
      <Flex direction="column" gap="3">
        <Flex align="center" justify="between" gap="2">
          <Flex align="center" gap="2">
            {ok ? <CheckCircle2 size={18} color="#22c55e" /> : running ? <Loader2 size={18} color="var(--blue-9)" style={{ animation: 'cfg-spin 1s linear infinite' }} /> : null}
            <Text size="3" weight="bold">Progresso da carga</Text>
          </Flex>
          <Badge color={ok ? 'green' : running ? 'amber' : 'red'} size="1">{ok ? 'Concluída' : running ? 'Em andamento' : 'Erro'}</Badge>
        </Flex>
        <Flex align="center" gap="3">
          <Text size="6" weight="bold" style={{ color: ok ? '#22c55e' : 'var(--blue-9)', minWidth: '3.5rem', fontVariantNumeric: 'tabular-nums' }}>{pct}%</Text>
          <Box style={{ flex: 1 }}><Progress value={pct} size="2" color={ok ? 'green' : 'blue'} /></Box>
        </Flex>
        <Text size="1" color="gray">{syncRun?.message || 'Iniciando…'}</Text>
        <Grid columns="2" gap="2">
          <Box><Text size="1" color="gray">Escopo atual</Text><Text size="2" weight="medium">{syncRun?.currentBatch || '—'}</Text></Box>
          <Box><Text size="1" color="gray">Gravados</Text><Text size="2" weight="medium">{fmt(syncRun?.ticketsUpserted)}</Text></Box>
        </Grid>
        {batches.length > 0 && (
          <Flex direction="column" gap="1">
            {batches.map((b) => {
              const bp = b.total > 0 ? Math.min(100, Math.round((b.upserted / b.total) * 100)) : b.status === 'done' ? 100 : b.status === 'running' ? 50 : 0;
              return (
                <Box key={b.escopo || b.label}>
                  <Flex justify="between" align="center" mb="1" gap="1">
                    <Badge size="1" color={b.status === 'done' ? 'green' : b.status === 'running' ? 'amber' : 'gray'}>{b.label}</Badge>
                    <Text size="1" color="gray">{bp}%</Text>
                  </Flex>
                  <Progress value={bp} size="1" color={b.status === 'done' ? 'green' : 'blue'} />
                </Box>
              );
            })}
          </Flex>
        )}
      </Flex>
    </Box>
  );
}

export default function OperacaoConfig({ userRole, embedded = false }) {
  const isAdmin = userRole === 'admin';
  const staticConfig = useMemo(() => getOperacaoJqlConfig(), []);
  const pad = embedded ? '0' : '5';
  const { refreshRadar } = useOperacaoRadar();

  const [overrides, setOverrides] = useState({});
  const [overridesLoading, setOverridesLoading] = useState(false);
  const [allowedFunctions, setAllowedFunctions] = useState([]);
  const [editingBatch, setEditingBatch] = useState(null);
  const [editingJql, setEditingJql] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [syncError, setSyncError] = useState('');

  const { syncRun, syncLoading } = useSyncStoreState();

  useEffect(() => {
    setOverridesLoading(true);
    loadJqlOverrides().then((d) => setOverrides(d || {})).finally(() => setOverridesLoading(false));
  }, []);

  useEffect(() => {
    if (!userRole) return;
    getPermissionProfile(userRole).then((p) => setAllowedFunctions(Array.isArray(p?.allowedFunctions) ? p.allowedFunctions : [])).catch(() => setAllowedFunctions([]));
  }, [userRole]);

  const config = useMemo(() => {
    const mergedBatches = staticConfig.batches.map((b) => {
      const ov = overrides[b.escopoId];
      return ov != null && ov !== '' ? { ...b, jql: ov, isOverridden: true } : b;
    });
    const existingIds = new Set(staticConfig.batches.map((b) => b.escopoId.toLowerCase()));
    const extraBatches = Object.entries(overrides)
      .filter(([id, jql]) => !existingIds.has(id.toLowerCase()) && jql != null && jql !== '')
      .map(([id, jql]) => ({
        label: id.toUpperCase().replace(/-/g, ' '),
        escopo: id.toUpperCase().replace(/-/g, ' '),
        escopoId: id,
        jql,
        isOverridden: true,
        isExtraOnly: true,
      }));
    return { ...staticConfig, batches: [...mergedBatches, ...extraBatches] };
  }, [staticConfig, overrides]);

  const canEdit = (b) => { if (isAdmin) return true; const pk = JQL_EDIT_PERMISSION_MAP[b.escopoId]; return pk ? allowedFunctions.includes(pk) : false; };
  const hasAny = isAdmin || Object.values(JQL_EDIT_PERMISSION_MAP).some((k) => allowedFunctions.includes(k));

  const handleCopy = async (b) => { try { await navigator.clipboard.writeText(b.jql); setCopied(b.escopoId); setTimeout(() => setCopied(null), 1500); } catch { } };
  const handleOpenEdit = (b) => { setEditingBatch(b); setEditingJql(b.jql); };
  const handleSaveEdit = async () => {
    if (!editingBatch) return; setSaving(true);
    try { await saveJqlOverride(editingBatch.escopoId, editingJql.trim()); setOverrides((p) => ({ ...p, [editingBatch.escopoId]: editingJql.trim() })); setEditingBatch(null); }
    catch (e) { console.error(e); } finally { setSaving(false); }
  };
  const handleResetOverride = async (b) => {
    if (!window.confirm(`Remover customização do JQL de "${b.label}"?`)) return;
    try { await clearJqlOverride(b.escopoId); setOverrides((p) => { const n = { ...p }; delete n[b.escopoId]; return n; }); } catch (e) { console.error(e); }
  };

  const doPreview = useCallback(async () => {
    setPreview(null); setPreviewError(''); setPreviewLoading(true);
    try { setPreview(await previewJiraGlobalCarga()); } catch (err) { setPreviewError(formatCallableError(err)); } finally { setPreviewLoading(false); }
  }, []);

  const handleOpenModal = useCallback(() => { setModalOpen(true); setSyncError(''); doPreview(); }, [doPreview]);

  const handleStartCarga = async () => {
    if (!preview) return; setSyncError(''); const t0 = Date.now();
    startSyncLoading({ status: 'running', percent: 0, message: 'Iniciando carga…', ticketsFetched: 0, ticketsUpserted: 0, totalEstimated: preview.total || 0, batchIndex: 0, totalBatches: preview.batches?.length || 6 });
    const ctrl = new AbortController(); _ctrl = ctrl;
    try {
      const finalRun = await runJiraGlobalCarga({ totalEstimated: preview.total || 0, batchEstimates: (preview.batches || []).map((b) => ({ escopo: b.escopo, label: b.label, total: b.total || 0 })), signal: ctrl.signal, onProgress: (r) => setSyncRun(r) });
      finishSyncLoading(finalRun, ''); await refreshRadar(); logSyncAction(auth.currentUser, finalRun, t0);
    } catch (err) {
      const msg = formatCallableError(err); const errRun = syncRun ? { ...syncRun, status: 'error', message: msg } : null;
      finishSyncLoading(errRun, msg); setSyncError(msg); if (errRun) logSyncAction(auth.currentUser, errRun, t0);
    } finally { _ctrl = null; }
  };

  const handleCancel = () => {
    _ctrl?.abort();
    finishSyncLoading(syncRun ? { ...syncRun, status: 'error', message: 'Carga cancelada pelo usuário.' } : null, '');
    _ctrl = null;
  };

  const isRunning = syncLoading || syncRun?.status === 'running';
  const isSuccess = syncRun?.status === 'success';
  const fieldRows = Object.entries(config.fieldDefinitions || {});

  if (!isAdmin && !hasAny) {
    return (
      <Box p={pad}>
        <Callout.Root color="amber"><Callout.Icon><Lock size={16} /></Callout.Icon><Callout.Text>Você não tem permissão para visualizar as configurações de JQL.</Callout.Text></Callout.Root>
      </Box>
    );
  }

  return (
    <Box p={pad}>
      <style>{`@keyframes cfg-spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Header ── */}
      <Flex align="center" justify="between" mb="5" wrap="wrap" gap="3">
        <Flex direction="column" gap="1">
          <Flex align="center" gap="3">
            <Settings size={24} color="var(--blue-9)" />
            <Text size="6" weight="bold">Configuração JQL</Text>
          </Flex>
          <Text size="2" color="gray">JQLs usados na carga global de tickets da operação.</Text>
        </Flex>
        {isAdmin && (
          <Button color="blue" variant="solid" onClick={handleOpenModal} disabled={isRunning}>
            {isRunning ? <Loader2 size={15} style={{ animation: 'cfg-spin 1s linear infinite' }} /> : <Database size={15} />}
            {isRunning ? 'Carga em andamento…' : 'Carga Jira Nova'}
          </Button>
        )}
      </Flex>

      {/* ── Carga Jira Nova Modal ── */}
      <Dialog.Root open={modalOpen} onOpenChange={setModalOpen}>
        <Dialog.Content style={{ maxWidth: 580 }}>
          <Dialog.Title>
            <Flex align="center" gap="2"><Database size={18} color="var(--blue-9)" /><Text>Carga Jira Nova</Text></Flex>
          </Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="4">
            Prévia dos tickets identificados por escopo via JQLs do Firestore. Os campos existentes em <code>tickets_global</code> serão preservados (merge).
          </Dialog.Description>
          {previewLoading && (
            <Flex align="center" gap="3" p="4" style={{ background: 'rgba(0,0,0,0.1)', borderRadius: 8 }}>
              <Loader2 size={20} color="var(--blue-9)" style={{ animation: 'cfg-spin 1s linear infinite' }} />
              <Flex direction="column" gap="1">
                <Text size="2" weight="bold">Consultando Jira…</Text>
                <Text size="2" color="gray">Buscando contagens por escopo, aguarde…</Text>
              </Flex>
            </Flex>
          )}
          {previewError && !previewLoading && (
            <Callout.Root color="red" mb="3">
              <Callout.Icon><AlertTriangle size={16} /></Callout.Icon>
              <Callout.Text>{previewError}</Callout.Text>
            </Callout.Root>
          )}
          {preview && !previewLoading && !isRunning && !isSuccess && (
            <Box mb="3">
              <Flex align="center" justify="between" mb="2">
                <Text size="2" weight="bold">Prévia por escopo</Text>
                <Badge size="1" color="blue">Total: {fmt(preview.total)}</Badge>
              </Flex>
              <Table.Root variant="surface" size="1">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>Escopo</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell align="right">Tickets</Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {(preview.batches || []).map((b) => (
                    <Table.Row key={b.escopo}>
                      <Table.Cell><Text size="2">{b.label}</Text></Table.Cell>
                      <Table.Cell align="right"><Badge size="1" color="blue">{fmt(b.total)}</Badge></Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>
          )}
          {(isRunning || isSuccess || syncRun?.status === 'error') && (
            <ProgressPanel syncRun={syncRun} syncLoading={syncLoading} />
          )}
          {syncError && (
            <Callout.Root color="red" mt="3">
              <Callout.Icon><AlertTriangle size={16} /></Callout.Icon>
              <Callout.Text>{syncError}</Callout.Text>
            </Callout.Root>
          )}
          <Flex justify="end" gap="2" mt="4">
            {isRunning ? (
              <Button color="red" variant="soft" onClick={handleCancel}>Cancelar carga</Button>
            ) : isSuccess ? (
              <Button variant="soft" onClick={() => setModalOpen(false)}>Fechar</Button>
            ) : (
              <>
                <Button variant="soft" onClick={() => setModalOpen(false)}>Fechar</Button>
                {preview && !previewError && (
                  <Button color="blue" variant="solid" onClick={handleStartCarga}>
                    <Play size={14} />Iniciar Carga
                  </Button>
                )}
                {!previewLoading && (
                  <Button color="gray" variant="soft" onClick={doPreview}>
                    <Search size={14} />Atualizar prévia
                  </Button>
                )}
              </>
            )}
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* ── Loading overrides ── */}
      {overridesLoading && (
        <Flex align="center" gap="2" mb="3">
          <Loader2 size={16} style={{ animation: 'cfg-spin 1s linear infinite' }} />
          <Text size="2" color="gray">Carregando configurações…</Text>
        </Flex>
      )}

      {/* ── JQL Batches ── */}
      <Flex direction="column" gap="4" mb="5">
        {config.batches.map((b) => (
          <Card key={b.escopoId} style={{ border: b.isOverridden ? '1px solid var(--amber-6)' : undefined }}>
            <Flex direction="column" gap="2">
              <Flex align="center" justify="between" wrap="wrap" gap="2">
                <Flex align="center" gap="2">
                  <FileText size={16} color="var(--blue-9)" />
                  <Text size="3" weight="bold">{b.label}</Text>
                  {b.isOverridden && <Badge size="1" color="amber">Customizado</Badge>}
                </Flex>
                <Flex gap="2">
                  <Button size="1" variant="ghost" color="gray" onClick={() => handleCopy(b)} title="Copiar JQL">
                    {copied === b.escopoId ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                  </Button>
                  {canEdit(b) && (
                    <>
                      <Button size="1" variant="ghost" color="blue" onClick={() => handleOpenEdit(b)} title="Editar JQL"><Pencil size={14} /></Button>
                      {b.isOverridden && <Button size="1" variant="ghost" color="amber" onClick={() => handleResetOverride(b)} title="Restaurar padrão"><RotateCcw size={14} /></Button>}
                    </>
                  )}
                  {!canEdit(b) && <Lock size={14} color="var(--gray-8)" />}
                </Flex>
              </Flex>
              <Box style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 6, padding: '8px 12px' }}>
                <Text size="1" style={{ fontFamily: 'monospace', wordBreak: 'break-all', color: 'var(--gray-12)' }}>{b.jql}</Text>
              </Box>
            </Flex>
          </Card>
        ))}
      </Flex>

      {/* ── Field Definitions (mapeamento customfield) ── */}
      {fieldRows.length > 0 && (
        <Card mb="4">
          <Flex align="center" gap="2" mb="3">
            <Info size={16} color="var(--blue-9)" />
            <Text size="3" weight="bold">Mapeamento de campos Jira</Text>
          </Flex>
          <Table.Root variant="surface" size="1">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Campo interno</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Campo Jira</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {fieldRows.map(([key, val]) => (
                <Table.Row key={key}>
                  <Table.Cell><Text size="1" style={{ fontFamily: 'monospace' }}>{key}</Text></Table.Cell>
                  <Table.Cell><Text size="1" style={{ fontFamily: 'monospace', color: 'var(--blue-11)' }}>{val}</Text></Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Card>
      )}

      {/* ── Campos da Carga ── */}
      <CargaFieldCatalogPanel />

      {/* ── Edit JQL Dialog ── */}
      <Dialog.Root open={!!editingBatch} onOpenChange={(o) => { if (!o) setEditingBatch(null); }}>
        <Dialog.Content style={{ maxWidth: 560 }}>
          <Dialog.Title>Editar JQL — {editingBatch?.label}</Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="3">
            Esta customização sobrescreve o JQL padrão apenas para esta instância. Outros ambientes não são afetados.
          </Dialog.Description>
          <TextArea
            value={editingJql}
            onChange={(e) => setEditingJql(e.target.value)}
            rows={6}
            style={{ fontFamily: 'monospace', fontSize: 13 }}
            placeholder="Cole o JQL aqui…"
          />
          <Flex justify="end" gap="2" mt="4">
            <Dialog.Close><Button variant="soft" color="gray" disabled={saving}>Cancelar</Button></Dialog.Close>
            <Button color="blue" variant="solid" onClick={handleSaveEdit} disabled={saving || !editingJql.trim()}>
              {saving ? <Loader2 size={14} style={{ animation: 'cfg-spin 1s linear infinite' }} /> : <Check size={14} />}
              Salvar
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
}
