import React, { useEffect, useMemo, useState } from 'react';
import { Box, Flex, Text, Card, Badge, Callout, Table, Grid, Button, Dialog, TextArea } from '@radix-ui/themes';
import { Settings, FileText, Info, Link2, Database, Copy, Pencil, Check, Loader2, RotateCcw, Lock } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getOperacaoJqlConfig } from '../../utils/jqlCargaClient';
import { getPermissionProfile } from '../../services/permissionService';

/** Chave de permissão por escopo — permite conceder edição JQL a roles não-admin */
const JQL_EDIT_PERMISSION_MAP = {
  problemas: 'JQL_EDIT_PROBLEMAS',
  'demanda-fast': 'JQL_EDIT_DEMANDA_FAST',
  demanda: 'JQL_EDIT_DEMANDA',
  incidente: 'JQL_EDIT_INCIDENTE',
  solicitacao: 'JQL_EDIT_SOLICITACAO',
  catalogo: 'JQL_EDIT_CATALOGO',
};

const OVERRIDES_DOC = 'operacao_config/jql_overrides';

async function loadJqlOverrides() {
  try {
    const snap = await getDoc(doc(db, 'operacao_config', 'jql_overrides'));
    return snap.exists() ? (snap.data() || {}) : {};
  } catch {
    return {};
  }
}

async function saveJqlOverride(escopoId, jql) {
  const ref = doc(db, 'operacao_config', 'jql_overrides');
  await setDoc(ref, { [escopoId]: jql }, { merge: true });
}

async function clearJqlOverride(escopoId) {
  const ref = doc(db, 'operacao_config', 'jql_overrides');
  await setDoc(ref, { [escopoId]: null }, { merge: true });
}

const OperacaoConfig = ({ userRole, embedded = false }) => {
  const isAdmin = userRole === 'admin';
  const staticConfig = useMemo(() => getOperacaoJqlConfig(), []);
  const boxPadding = embedded ? '0' : '5';

  const [overrides, setOverrides] = useState({});
  const [overridesLoading, setOverridesLoading] = useState(false);
  const [allowedFunctions, setAllowedFunctions] = useState([]);

  const [editingBatch, setEditingBatch] = useState(null);
  const [editingJql, setEditingJql] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    setOverridesLoading(true);
    loadJqlOverrides().then((data) => {
      setOverrides(data || {});
    }).finally(() => setOverridesLoading(false));
  }, []);

  useEffect(() => {
    if (!userRole) return;
    getPermissionProfile(userRole).then((profile) => {
      setAllowedFunctions(Array.isArray(profile?.allowedFunctions) ? profile.allowedFunctions : []);
    }).catch(() => setAllowedFunctions([]));
  }, [userRole]);

  const config = useMemo(() => ({
    ...staticConfig,
    batches: staticConfig.batches.map((b) => {
      const override = overrides[b.escopoId];
      return (override != null && override !== '') ? { ...b, jql: override, isOverridden: true } : b;
    }),
  }), [staticConfig, overrides]);

  const canEditBatch = (batch) => {
    if (isAdmin) return true;
    const permKey = JQL_EDIT_PERMISSION_MAP[batch.escopoId];
    return permKey ? allowedFunctions.includes(permKey) : false;
  };

  const hasAnyEditPermission = isAdmin || Object.values(JQL_EDIT_PERMISSION_MAP).some((k) => allowedFunctions.includes(k));

  if (!isAdmin && !hasAnyEditPermission) {
    return (
      <Box p={boxPadding}>
        <Callout.Root color="amber">
          <Callout.Text>
            Apenas administradores podem visualizar a configuração de carga Jira.
          </Callout.Text>
        </Callout.Root>
      </Box>
    );
  }

  const handleCopy = async (batch) => {
    try {
      await navigator.clipboard.writeText(batch.jql);
      setCopied(batch.escopoId);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* ignore */ }
  };

  const handleOpenEdit = (batch) => {
    setEditingBatch(batch);
    setEditingJql(batch.jql);
  };

  const handleSaveEdit = async () => {
    if (!editingBatch) return;
    setSaving(true);
    try {
      await saveJqlOverride(editingBatch.escopoId, editingJql.trim());
      setOverrides((prev) => ({ ...prev, [editingBatch.escopoId]: editingJql.trim() }));
      setEditingBatch(null);
    } catch (e) {
      console.error('Erro ao salvar JQL override:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleResetOverride = async (batch) => {
    if (!window.confirm(`Remover customização do JQL de "${batch.label}" e restaurar o padrão?`)) return;
    try {
      await clearJqlOverride(batch.escopoId);
      setOverrides((prev) => { const next = { ...prev }; delete next[batch.escopoId]; return next; });
    } catch (e) {
      console.error('Erro ao resetar override:', e);
    }
  };

  const fieldRows = Object.entries(config.fieldDefinitions || {});

  return (
    <Box p={boxPadding}>
      {!embedded && (
        <Flex direction="column" gap="2" mb="5">
          <Flex align="center" gap="3">
            <Settings size={26} color="var(--info)" />
            <Text size="7" weight="bold">Configuração Jira CPFL</Text>
          </Flex>
          <Text size="3" color="gray">
            Espelha o projeto jira-cpfl-sync: consultas em{' '}
            <code>{config.jqlFile}</code>, campos customizados e destino no Firestore.
          </Text>
        </Flex>
      )}
      {embedded && (
        <Text size="2" color="gray" mb="4" as="p">
          Consultas em <code>{config.jqlFile}</code>, campos customizados e destino no Firestore.
        </Text>
      )}

      <Callout.Root color="blue" mb="4">
        <Callout.Icon><Info size={16} /></Callout.Icon>
        <Callout.Text>
          JQLs customizados são salvos em <code>{OVERRIDES_DOC}</code> e têm precedência sobre o arquivo estático.
          Edições só estão disponíveis para administradores ou usuários com permissão específica por escopo.
        </Callout.Text>
      </Callout.Root>

      {isAdmin && (
        <Grid columns={{ initial: '1', md: '2' }} gap="4" mb="5">
          <Card className="glass-panel" style={{ border: '1px solid var(--glass-border)' }}>
            <Flex direction="column" gap="3" p="4">
              <Flex align="center" gap="2">
                <Link2 size={18} color="var(--info)" />
                <Text size="4" weight="bold">Conexão Jira</Text>
              </Flex>
              <Table.Root variant="surface" size="1">
                <Table.Body>
                  <Table.Row>
                    <Table.RowHeaderCell>Domínio</Table.RowHeaderCell>
                    <Table.Cell><code>{config.jiraDomain}</code></Table.Cell>
                  </Table.Row>
                  <Table.Row>
                    <Table.RowHeaderCell>API</Table.RowHeaderCell>
                    <Table.Cell><code>/rest/api/3/</code> (somente leitura)</Table.Cell>
                  </Table.Row>
                  <Table.Row>
                    <Table.RowHeaderCell>Credenciais</Table.RowHeaderCell>
                    <Table.Cell>
                      <Text size="2" color="gray">
                        JIRA_API_TOKEN, JIRA_USER_EMAIL, JIRA_DOMAIN — apenas nas Cloud Functions
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                </Table.Body>
              </Table.Root>
            </Flex>
          </Card>

          <Card className="glass-panel" style={{ border: '1px solid var(--glass-border)' }}>
            <Flex direction="column" gap="3" p="4">
              <Flex align="center" gap="2">
                <Database size={18} color="var(--info)" />
                <Text size="4" weight="bold">Destino Firestore</Text>
              </Flex>
              <Table.Root variant="surface" size="1">
                <Table.Body>
                  {Object.entries(config.collections).map(([key, value]) => (
                    <Table.Row key={key}>
                      <Table.RowHeaderCell>{key}</Table.RowHeaderCell>
                      <Table.Cell><code>{value}</code></Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Flex>
          </Card>
        </Grid>
      )}

      {isAdmin && (
        <Card className="glass-panel" mb="5" style={{ border: '1px solid var(--glass-border)' }}>
          <Flex direction="column" gap="3" p="4">
            <Text size="4" weight="bold">Escopos de carga ({config.escopos.length})</Text>
            <Flex gap="2" wrap="wrap">
              {config.escopos.map((item) => (
                <Badge key={item.id} color="blue" size="2">
                  {item.ordem}. {item.nome}
                </Badge>
              ))}
            </Flex>
          </Flex>
        </Card>
      )}

      {isAdmin && (
        <Card className="glass-panel" mb="5" style={{ border: '1px solid var(--glass-border)' }}>
          <Flex direction="column" gap="3" p="4">
            <Text size="4" weight="bold">Campos Jira mapeados</Text>
            <Table.Root variant="surface">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Coluna Firestore</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Nomes no Jira (fallback)</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {fieldRows.map(([col, names]) => (
                  <Table.Row key={col}>
                    <Table.Cell><code>{col}</code></Table.Cell>
                    <Table.Cell>{names.join(' · ')}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Flex>
        </Card>
      )}

      <Flex align="center" justify="between" mb="3" wrap="wrap" gap="2">
        <Text size="5" weight="bold">
          Consultas JQL ({config.batches.length})
        </Text>
        {overridesLoading && (
          <Flex align="center" gap="2">
            <Loader2 size={14} style={{ animation: 'operacao-spin 1s linear infinite' }} />
            <Text size="1" color="gray">Carregando customizações...</Text>
          </Flex>
        )}
      </Flex>

      <Flex direction="column" gap="4">
        {config.batches.map((batch, index) => {
          const canEdit = canEditBatch(batch);
          const isCopied = copied === batch.escopoId;

          return (
            <Card key={batch.escopoId || index} className="glass-panel" style={{ border: `1px solid ${batch.isOverridden ? 'rgba(250,204,21,0.35)' : 'var(--glass-border)'}` }}>
              <Flex direction="column" gap="3" p="4">
                {/* Header do bloco */}
                <Flex align="center" justify="between" gap="3" wrap="wrap">
                  <Flex align="center" gap="2">
                    <FileText size={18} color="var(--info)" />
                    <Text size="4" weight="bold">{batch.label}</Text>
                    {batch.isOverridden && (
                      <Badge color="amber" variant="soft" size="1">customizado</Badge>
                    )}
                  </Flex>
                  <Flex align="center" gap="2">
                    <Badge color="blue">{batch.escopo}</Badge>
                    {/* Botão Copiar */}
                    <Button
                      size="1"
                      variant="soft"
                      color={isCopied ? 'green' : 'gray'}
                      onClick={() => handleCopy(batch)}
                      title="Copiar JQL para área de transferência"
                    >
                      {isCopied ? <Check size={12} /> : <Copy size={12} />}
                      {isCopied ? 'Copiado!' : 'Copiar'}
                    </Button>
                    {/* Botão Editar — só se tiver permissão */}
                    {canEdit ? (
                      <Button
                        size="1"
                        variant="soft"
                        color="indigo"
                        onClick={() => handleOpenEdit(batch)}
                        title="Editar JQL"
                      >
                        <Pencil size={12} /> Editar
                      </Button>
                    ) : (
                      <Button size="1" variant="soft" color="gray" disabled title="Sem permissão para editar este JQL">
                        <Lock size={12} /> Editar
                      </Button>
                    )}
                    {/* Restaurar padrão — só admin e se tiver override */}
                    {isAdmin && batch.isOverridden && (
                      <Button
                        size="1"
                        variant="soft"
                        color="amber"
                        onClick={() => handleResetOverride(batch)}
                        title="Restaurar JQL padrão"
                      >
                        <RotateCcw size={12} /> Restaurar
                      </Button>
                    )}
                  </Flex>
                </Flex>

                <Text size="1" color="gray">ID escopo: {batch.escopoId}</Text>

                {/* Bloco JQL */}
                <Box
                  style={{
                    background: 'rgba(0,0,0,0.25)',
                    borderRadius: '8px',
                    padding: '12px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    border: '1px solid var(--glass-border)',
                  }}
                >
                  {batch.jql}
                </Box>
              </Flex>
            </Card>
          );
        })}
      </Flex>

      {/* Modal de edição JQL */}
      <Dialog.Root open={!!editingBatch} onOpenChange={(open) => { if (!open) setEditingBatch(null); }}>
        <Dialog.Content style={{ maxWidth: 700 }}>
          {editingBatch && (
            <>
              <Dialog.Title>
                <Flex align="center" gap="2">
                  <Pencil size={18} color="var(--info)" />
                  Editar JQL — {editingBatch.label}
                  {editingBatch.isOverridden && <Badge color="amber" variant="soft" size="1">customizado</Badge>}
                </Flex>
              </Dialog.Title>
              <Dialog.Description size="2" mb="4" color="gray">
                Editando: <code>{editingBatch.escopoId}</code> · Permissão: <code>{JQL_EDIT_PERMISSION_MAP[editingBatch.escopoId] || 'admin'}</code>.
                A alteração substitui o JQL estático e é salva em <code>{OVERRIDES_DOC}</code>.
              </Dialog.Description>

              <TextArea
                value={editingJql}
                onChange={(e) => setEditingJql(e.target.value)}
                rows={12}
                style={{
                  fontFamily: 'monospace',
                  fontSize: 12,
                  lineHeight: 1.5,
                  resize: 'vertical',
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 8,
                  padding: 12,
                  color: 'var(--gray-12)',
                }}
              />

              <Flex justify="end" gap="3" mt="4">
                <Dialog.Close>
                  <Button variant="soft" color="gray">Cancelar</Button>
                </Dialog.Close>
                <Button onClick={handleSaveEdit} disabled={saving || !editingJql.trim()} color="indigo">
                  {saving ? <><Loader2 size={14} style={{ animation: 'operacao-spin 1s linear infinite', marginRight: 6 }} />Salvando...</> : <><Check size={14} /> Salvar</>}
                </Button>
              </Flex>
            </>
          )}
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
};

export default OperacaoConfig;
