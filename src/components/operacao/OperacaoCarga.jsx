import React, { useCallback, useEffect, useState } from 'react';
import { Box, Flex, Text, Card, Button, Progress, Callout, Badge, Table, Grid } from '@radix-ui/themes';
import { Database, Play, Search, Square, AlertTriangle, CheckCircle2, Loader2, Clock } from 'lucide-react';
import { previewJiraGlobalCarga, runJiraGlobalCarga } from '../../services/operacaoSyncService';
import { formatCallableError } from '../../utils/callableError';
import { useOperacaoRadar } from '../../contexts/OperacaoRadarContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  getSyncState,
  subscribeSyncState,
  startSyncLoading,
  setSyncRun,
  finishSyncLoading,
} from '../../services/operacaoSyncStore';

// AbortController persistido fora do componente para sobreviver a navegações
let _activeAbortController = null;

const formatNumber = (value) => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('pt-BR');
};

const statusLabel = {
  running: 'Em andamento',
  success: 'Concluída',
  error: 'Erro',
  pending: 'Aguardando',
};

const CargaProgressPanel = ({ syncRun, syncLoading }) => {
  if (!syncRun && !syncLoading) return null;

  const percent = Math.max(0, Math.min(100, syncRun?.percent ?? 0));
  const isSuccess = syncRun?.status === 'success';
  const isRunning = syncLoading || syncRun?.status === 'running';
  const batchProgress = syncRun?.batchProgress || [];

  return (
    <Card
      className="glass-panel"
      style={{
        border: `1px solid ${isSuccess ? 'rgba(34, 197, 94, 0.35)' : 'var(--glass-border)'}`,
        marginBottom: '1rem',
      }}
    >
      <Flex direction="column" gap="4" p="4">
        <Flex align="center" justify="between" wrap="wrap" gap="3">
          <Flex align="center" gap="2">
            {isSuccess ? (
              <CheckCircle2 size={22} color="var(--success, #22c55e)" />
            ) : isRunning ? (
              <Loader2 size={22} color="var(--info)" className="spin-icon" />
            ) : null}
            <Text size="5" weight="bold">Progresso da carga</Text>
          </Flex>
          <Badge color={isSuccess ? 'green' : isRunning ? 'amber' : 'red'}>
            {statusLabel[syncRun?.status] || 'Preparando'}
          </Badge>
        </Flex>

        <Flex align="center" gap="4" wrap="wrap">
          <Text
            size="8"
            weight="bold"
            style={{
              color: isSuccess ? 'var(--success, #22c55e)' : 'var(--info)',
              minWidth: '4.5rem',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {percent}%
          </Text>
          <Box style={{ flex: 1, minWidth: '220px' }}>
            <Progress
              value={percent}
              size="3"
              color={isSuccess ? 'green' : 'blue'}
              style={{ height: '14px' }}
            />
            <Flex justify="between" mt="2">
              <Text size="1" color="gray">0%</Text>
              <Text size="1" color="gray">100%</Text>
            </Flex>
          </Box>
        </Flex>

        <Text size="2" color="gray">{syncRun?.message || 'Iniciando sincronização…'}</Text>

        <Grid columns={{ initial: '2', md: '4' }} gap="3">
          <Box>
            <Text size="1" color="gray">Escopo atual</Text>
            <Text size="3" weight="medium">{syncRun?.currentBatch || '—'}</Text>
          </Box>
          <Box>
            <Text size="1" color="gray">Lotes</Text>
            <Text size="3" weight="medium">
              {syncRun?.batchIndex != null && syncRun?.totalBatches
                ? `${Math.min(syncRun.batchIndex + 1, syncRun.totalBatches)} / ${syncRun.totalBatches}`
                : '—'}
            </Text>
          </Box>
          <Box>
            <Text size="1" color="gray">Gravados</Text>
            <Text size="3" weight="medium">{formatNumber(syncRun?.ticketsUpserted)}</Text>
          </Box>
          <Box>
            <Text size="1" color="gray">Estimado (prévia)</Text>
            <Text size="3" weight="medium">{formatNumber(syncRun?.totalEstimated)}</Text>
          </Box>
        </Grid>

        {batchProgress.length > 0 && (
          <Box>
            <Text size="2" weight="bold" mb="2">Escopos</Text>
            <Flex direction="column" gap="2">
              {batchProgress.map((batch) => {
                const batchPct =
                  batch.total > 0
                    ? Math.min(100, Math.round((batch.upserted / batch.total) * 100))
                    : batch.status === 'done'
                      ? 100
                      : batch.status === 'running'
                        ? 50
                        : 0;

                return (
                  <Box key={batch.escopo || batch.label}>
                    <Flex justify="between" align="center" mb="1" gap="2">
                      <Flex align="center" gap="2">
                        <Badge
                          size="1"
                          color={
                            batch.status === 'done'
                              ? 'green'
                              : batch.status === 'running'
                                ? 'amber'
                                : 'gray'
                          }
                        >
                          {batch.label}
                        </Badge>
                        {batch.total > 0 && (
                          <Text size="1" color="gray">
                            {formatNumber(batch.upserted)} / {formatNumber(batch.total)}
                          </Text>
                        )}
                      </Flex>
                      <Text size="1" color="gray">{batchPct}%</Text>
                    </Flex>
                    <Progress
                      value={batchPct}
                      size="1"
                      color={batch.status === 'done' ? 'green' : 'blue'}
                    />
                  </Box>
                );
              })}
            </Flex>
          </Box>
        )}
      </Flex>
    </Card>
  );
};

// Hook para se inscrever no store global de sync
function useSyncStoreState() {
  const [state, setLocalState] = useState(getSyncState);
  useEffect(() => subscribeSyncState(setLocalState), []);
  return state;
}

const OperacaoCarga = ({ userRole, embedded = false }) => {
  const { refreshRadar } = useOperacaoRadar();
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [lastSyncTickets, setLastSyncTickets] = useState(null);
  const isAdmin = userRole === 'admin';

  // Estado da carga vem do store global (persiste entre navegações)
  const { syncRun, syncLoading, syncError } = useSyncStoreState();

  // Busca a data/hora e totais da última carga a partir do operacao_stats/summary
  const fetchLastSyncInfo = useCallback(async () => {
    try {
      const snap = await getDoc(doc(db, 'operacao_stats', 'summary'));
      if (snap.exists()) {
        const data = snap.data();
        const ts = data.lastSyncAt?.toDate?.() || (data.lastSyncAt ? new Date(data.lastSyncAt) : null);
        setLastSyncAt(ts);
        setLastSyncTickets(data.totalTicketsExact ?? data.lastSyncTicketsUpserted ?? null);
      }
    } catch { /* ignora erros silenciosamente */ }
  }, []);

  const handlePreview = useCallback(async () => {
    setPreviewLoading(true);
    setPreviewError('');
    try {
      const data = await previewJiraGlobalCarga();
      setPreview(data);
    } catch (err) {
      setPreviewError(formatCallableError(err));
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      handlePreview();
      fetchLastSyncInfo();
    }
  }, [isAdmin, handlePreview, fetchLastSyncInfo]);

  const handleStartSync = async () => {
    if (!preview) {
      finishSyncLoading(null, 'Execute a prévia antes de iniciar a carga.');
      return;
    }

    const initialRun = {
      status: 'running',
      percent: 0,
      message: 'Iniciando carga…',
      ticketsFetched: 0,
      ticketsUpserted: 0,
      totalEstimated: preview.total || 0,
      batchIndex: 0,
      totalBatches: preview.batches?.length || 6,
    };
    startSyncLoading(initialRun);

    const controller = new AbortController();
    _activeAbortController = controller;

    try {
      const finalRun = await runJiraGlobalCarga({
        totalEstimated: preview.total || 0,
        batchEstimates: (preview.batches || []).map((b) => ({
          escopo: b.escopo,
          label: b.label,
          total: b.total || 0,
        })),
        signal: controller.signal,
        onProgress: (run) => setSyncRun(run),
      });
      finishSyncLoading(finalRun, '');
      await refreshRadar();
    } catch (err) {
      const errMsg = formatCallableError(err);
      finishSyncLoading(
        syncRun ? { ...syncRun, status: 'error', message: errMsg } : null,
        errMsg
      );
    } finally {
      _activeAbortController = null;
      fetchLastSyncInfo();
    }
  };

  const handleCancel = () => {
    _activeAbortController?.abort();
    finishSyncLoading(
      syncRun ? { ...syncRun, status: 'error', message: 'Carga cancelada pelo usuário.' } : null,
      ''
    );
    _activeAbortController = null;
  };

  const boxPadding = embedded ? '0' : '5';

  if (!isAdmin) {
    return (
      <Box p={boxPadding}>
        <Callout.Root color="amber">
          <Callout.Text>
            Apenas administradores podem executar a carga Jira global.
          </Callout.Text>
        </Callout.Root>
      </Box>
    );
  }

  return (
    <Box p={boxPadding}>
      <style>{`
        @keyframes operacao-spin { to { transform: rotate(360deg); } }
        .spin-icon { animation: operacao-spin 1s linear infinite; }
      `}</style>

      {!embedded && (
        <Flex direction="column" gap="2" mb="5">
          <Flex align="center" gap="3">
            <Database size={26} color="var(--info)" />
            <Text size="7" weight="bold">Carga Jira Global</Text>
          </Flex>
          <Text size="3" color="gray">
            Prévia via Jira e gravação direta no Firestore (<code>tickets_global</code>).
          </Text>
        </Flex>
      )}
      {embedded && (
        <Text size="2" color="gray" mb="4" as="p">
          Prévia via Jira e gravação direta no Firestore (<code>tickets_global</code>).
        </Text>
      )}

      {/* Data/hora da última carga */}
      {lastSyncAt && (
        <Flex align="center" gap="2" mb="4" style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.2)', width: 'fit-content' }}>
          <Clock size={15} color="var(--rg-accent, #38bdf8)" />
          <Text size="2" color="gray">
            Última carga:{' '}
            <Text as="span" size="2" weight="bold" style={{ color: 'var(--gray-12)' }}>
              {lastSyncAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
            </Text>
            {lastSyncTickets != null && (
              <Text as="span" size="2" color="gray">
                {' '}· {Number(lastSyncTickets).toLocaleString('pt-BR')} tickets
              </Text>
            )}
          </Text>
        </Flex>
      )}

      <Flex gap="3" mb="4" wrap="wrap">
        <Button onClick={handlePreview} disabled={previewLoading || syncLoading}>
          <Search size={16} />
          {previewLoading ? 'Consultando Jira...' : 'Atualizar prévia'}
        </Button>
        <Button
          color="green"
          onClick={handleStartSync}
          disabled={syncLoading || previewLoading || !preview}
        >
          <Play size={16} />
          {syncLoading ? 'Carga em andamento...' : 'Iniciar carga'}
        </Button>
        {syncLoading && (
          <Button variant="soft" color="red" onClick={handleCancel}>
            <Square size={16} /> Parar
          </Button>
        )}
      </Flex>

      <CargaProgressPanel syncRun={syncRun} syncLoading={syncLoading} />

      {previewError && (
        <Callout.Root color="red" mb="4">
          <Callout.Text>{previewError}</Callout.Text>
        </Callout.Root>
      )}
      {syncError && (
        <Callout.Root color="red" mb="4">
          <Callout.Text>{syncError}</Callout.Text>
        </Callout.Root>
      )}

      {preview && (
        <Card className="glass-panel" style={{ border: '1px solid var(--glass-border)' }}>
          <Flex direction="column" gap="3" p="4">
            <Text size="5" weight="bold">Prévia de tickets</Text>
            <Flex gap="6" wrap="wrap">
              <Flex direction="column" gap="1">
                <Text size="6" weight="bold" style={{ color: 'var(--info)' }}>
                  {formatNumber(preview.total)}
                </Text>
                <Text size="2" color="gray">Total único estimado (sem duplicatas)</Text>
              </Flex>
              <Flex direction="column" gap="1">
                <Text size="4" weight="bold">{formatNumber(preview.totalRaw)}</Text>
                <Text size="2" color="gray">Soma bruta das 6 cargas</Text>
              </Flex>
            </Flex>

            {preview.mitigation && (
              <Callout.Root color="blue">
                <Callout.Icon><AlertTriangle size={16} /></Callout.Icon>
                <Callout.Text>
                  Estimativa ~{formatNumber(preview.mitigation.estimatedDocs)} tickets. A barra de progresso
                  usa a contagem da prévia como referência de 100%.
                </Callout.Text>
              </Callout.Root>
            )}

            <Table.Root variant="surface">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Escopo</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Tickets (aprox.)</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {(preview.batches || []).map((batch) => (
                  <Table.Row key={batch.escopoId || batch.label}>
                    <Table.Cell>
                      <Badge color="blue">{batch.label}</Badge>
                    </Table.Cell>
                    <Table.Cell>{formatNumber(batch.total)}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Flex>
        </Card>
      )}
    </Box>
  );
};

export default OperacaoCarga;
