import React, { useEffect, useMemo, useState } from 'react';
import { Box, Flex, Text, Table, Badge, Button, Card, Tabs, Select, TextField } from '@radix-ui/themes';
import { ShieldCheck, Activity, RefreshCw, Loader2, Clock, User, Database, CheckCircle2, XCircle, Search, X } from 'lucide-react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const ACCESS_LOGS = 'system_access_logs';
const SYNC_AUDIT = 'jira_sync_audit';

const PAGE_LIMIT_OPTIONS = [25, 50, 100, 200];

function formatTs(ts) {
  if (!ts) return '—';
  const d = ts?.toDate?.() ?? new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatNumber(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('pt-BR');
}

const AuditDashboard = ({ userRole }) => {
  const isAdmin = userRole === 'admin';
  const [activeTab, setActiveTab] = useState('acessos');
  const [pageLimit, setPageLimit] = useState(50);

  // Access logs
  const [accessLogs, setAccessLogs] = useState([]);
  const [accessLoading, setAccessLoading] = useState(false);

  // Sync audit
  const [syncLogs, setSyncLogs] = useState([]);
  const [syncLoading, setSyncLoading] = useState(false);

  // Filtros de acesso
  const [filterUser, setFilterUser] = useState('');
  const [filterPage, setFilterPage] = useState('');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');

  const loadAccessLogs = async () => {
    setAccessLoading(true);
    try {
      const q = query(collection(db, ACCESS_LOGS), orderBy('timestamp', 'desc'), limit(pageLimit));
      const snap = await getDocs(q);
      setAccessLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setAccessLoading(false);
    }
  };

  const loadSyncLogs = async () => {
    setSyncLoading(true);
    try {
      const q = query(collection(db, SYNC_AUDIT), orderBy('finishedAt', 'desc'), limit(pageLimit));
      const snap = await getDocs(q);
      setSyncLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setSyncLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    if (activeTab === 'acessos') loadAccessLogs();
    else loadSyncLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, pageLimit, isAdmin]);

  if (!isAdmin) {
    return (
      <Box p="4">
        <Text color="amber">Apenas administradores podem visualizar os logs de auditoria.</Text>
      </Box>
    );
  }

  // Opções de filtro derivadas dos dados
  const userOptions = useMemo(() => {
    const map = new Map();
    accessLogs.forEach(l => { if (l.userId && l.userName) map.set(l.userId, l.userName); });
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [accessLogs]);

  const pageOptions = useMemo(() => {
    const s = new Set(accessLogs.map(l => l.page).filter(Boolean));
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [accessLogs]);

  // Aplica filtros client-side
  const filteredAccessLogs = useMemo(() => {
    return accessLogs.filter(l => {
      if (filterUser && l.userId !== filterUser) return false;
      if (filterPage && l.page !== filterPage) return false;
      if (filterDateStart || filterDateEnd) {
        const ts = l.timestamp?.toDate?.() ?? (l.timestamp ? new Date(l.timestamp) : null);
        if (!ts) return false;
        const dateStr = ts.toISOString().slice(0, 10);
        if (filterDateStart && dateStr < filterDateStart) return false;
        if (filterDateEnd && dateStr > filterDateEnd) return false;
      }
      return true;
    });
  }, [accessLogs, filterUser, filterPage, filterDateStart, filterDateEnd]);

  const hasActiveFilters = filterUser || filterPage || filterDateStart || filterDateEnd;

  // Métricas rápidas de acessos (baseadas nos logs filtrados)
  const uniqueUsers = new Set(filteredAccessLogs.map(l => l.userId)).size;
  const uniquePages = new Set(filteredAccessLogs.map(l => l.page)).size;
  const lastAccess = filteredAccessLogs[0] ? formatTs(filteredAccessLogs[0].timestamp) : '—';

  const syncSuccess = syncLogs.filter(l => l.status === 'success').length;
  const lastSync = syncLogs[0] ? formatTs(syncLogs[0].finishedAt) : '—';
  const totalTicketsSynced = syncLogs.filter(l => l.status === 'success').reduce((acc, l) => acc + (l.ticketsTotal || 0), 0);

  return (
    <Box>
      <Flex align="center" gap="3" mb="4">
        <ShieldCheck size={22} color="var(--indigo-9)" />
        <Box>
          <Text as="h2" size="4" weight="bold">Auditoria e Monitoramento</Text>
          <Text size="2" color="gray">Registros de acessos e execuções de carga Jira.</Text>
        </Box>
      </Flex>

      {/* Cards de métricas */}
      <Flex gap="3" mb="4" wrap="wrap">
        <Card style={{ flex: 1, minWidth: 140, border: '1px solid var(--glass-border)' }}>
          <Flex direction="column" gap="1" p="3">
            <Flex align="center" gap="2"><User size={14} color="var(--indigo-9)" /><Text size="1" color="gray">Usuários únicos</Text></Flex>
            <Text size="6" weight="bold">{uniqueUsers}</Text>
            <Text size="1" color="gray">últimos {pageLimit} registros</Text>
          </Flex>
        </Card>
        <Card style={{ flex: 1, minWidth: 140, border: '1px solid var(--glass-border)' }}>
          <Flex direction="column" gap="1" p="3">
            <Flex align="center" gap="2"><Activity size={14} color="var(--green-9)" /><Text size="1" color="gray">Páginas acessadas</Text></Flex>
            <Text size="6" weight="bold">{uniquePages}</Text>
            <Text size="1" color="gray">distintas</Text>
          </Flex>
        </Card>
        <Card style={{ flex: 1, minWidth: 140, border: '1px solid var(--glass-border)' }}>
          <Flex direction="column" gap="1" p="3">
            <Flex align="center" gap="2"><Clock size={14} color="var(--amber-9)" /><Text size="1" color="gray">Último acesso</Text></Flex>
            <Text size="3" weight="bold">{lastAccess}</Text>
          </Flex>
        </Card>
        <Card style={{ flex: 1, minWidth: 140, border: '1px solid var(--glass-border)' }}>
          <Flex direction="column" gap="1" p="3">
            <Flex align="center" gap="2"><Database size={14} color="var(--cyan-9)" /><Text size="1" color="gray">Cargas executadas</Text></Flex>
            <Text size="6" weight="bold">{syncLogs.length}</Text>
            <Text size="1" color="gray">{syncSuccess} sucesso · {formatNumber(totalTicketsSynced)} tickets</Text>
          </Flex>
        </Card>
      </Flex>

      <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
        <Flex align="center" justify="between" wrap="wrap" gap="3" mb="3">
          <Tabs.List>
            <Tabs.Trigger value="acessos">
              <Activity size={14} style={{ marginRight: 6 }} /> Acessos ({accessLogs.length})
            </Tabs.Trigger>
            <Tabs.Trigger value="cargas">
              <Database size={14} style={{ marginRight: 6 }} /> Cargas Jira ({syncLogs.length})
            </Tabs.Trigger>
          </Tabs.List>
          <Flex align="center" gap="2">
            <Text size="1" color="gray">Exibir:</Text>
            <Select.Root value={String(pageLimit)} onValueChange={v => setPageLimit(Number(v))}>
              <Select.Trigger style={{ minWidth: 80 }} />
              <Select.Content>
                {PAGE_LIMIT_OPTIONS.map(n => <Select.Item key={n} value={String(n)}>{n}</Select.Item>)}
              </Select.Content>
            </Select.Root>
            <Button
              size="1" variant="soft" color="gray"
              onClick={() => activeTab === 'acessos' ? loadAccessLogs() : loadSyncLogs()}
              disabled={accessLoading || syncLoading}
            >
              <RefreshCw size={13} /> Atualizar
            </Button>
          </Flex>
        </Flex>

        {/* ABA: ACESSOS */}
        <Tabs.Content value="acessos">
          {/* Barra de Filtros */}
          <Box mb="3" p="3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: 10 }}>
            <Flex align="center" gap="2" wrap="wrap">
              <Text size="1" weight="bold" color="gray" style={{ letterSpacing: '0.05em' }}>FILTRAR:</Text>
              {/* Filtro Usuário */}
              <Select.Root value={filterUser} onValueChange={setFilterUser}>
                <Select.Trigger placeholder="Todos os usuários" style={{ minWidth: 160 }} />
                <Select.Content>
                  <Select.Item value="">Todos os usuários</Select.Item>
                  {userOptions.map(u => <Select.Item key={u.id} value={u.id}>{u.name}</Select.Item>)}
                </Select.Content>
              </Select.Root>
              {/* Filtro Página */}
              <Select.Root value={filterPage} onValueChange={setFilterPage}>
                <Select.Trigger placeholder="Todas as páginas" style={{ minWidth: 160 }} />
                <Select.Content>
                  <Select.Item value="">Todas as páginas</Select.Item>
                  {pageOptions.map(p => <Select.Item key={p} value={p}>{p}</Select.Item>)}
                </Select.Content>
              </Select.Root>
              {/* Filtro Data Início */}
              <Flex align="center" gap="1">
                <Text size="1" color="gray">De:</Text>
                <input type="date" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--gray-6)', background: 'var(--gray-2)', color: 'var(--gray-12)', fontSize: 12 }} />
              </Flex>
              {/* Filtro Data Fim */}
              <Flex align="center" gap="1">
                <Text size="1" color="gray">Até:</Text>
                <input type="date" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--gray-6)', background: 'var(--gray-2)', color: 'var(--gray-12)', fontSize: 12 }} />
              </Flex>
              {hasActiveFilters && (
                <Button size="1" variant="ghost" color="red" onClick={() => { setFilterUser(''); setFilterPage(''); setFilterDateStart(''); setFilterDateEnd(''); }}>
                  <X size={12} /> Limpar
                </Button>
              )}
              {hasActiveFilters && (
                <Text size="1" color="gray">{filteredAccessLogs.length} de {accessLogs.length} registros</Text>
              )}
            </Flex>
          </Box>

          {accessLoading ? (
            <Flex align="center" justify="center" p="6" gap="2">
              <Loader2 size={20} style={{ animation: 'operacao-spin 1s linear infinite' }} />
              <Text color="gray">Carregando logs de acesso...</Text>
            </Flex>
          ) : accessLogs.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: 40 }}>
              <Activity size={32} color="var(--gray-8)" style={{ margin: '0 auto 12px' }} />
              <Text color="gray">Nenhum registro de acesso encontrado.</Text>
              <Text size="1" color="gray" as="p" mt="1">Os logs serão gerados automaticamente conforme os usuários navegarem no sistema.</Text>
            </Card>
          ) : (
            <Box style={{ overflowX: 'auto' }}>
              <Table.Root variant="surface">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>Data / Hora</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Usuário</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>E-mail</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Perfil</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Página</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Caminho</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Sessão</Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {filteredAccessLogs.map(log => (
                    <Table.Row key={log.id}>
                      <Table.Cell>
                        <Text size="1" style={{ whiteSpace: 'nowrap' }}>{formatTs(log.timestamp)}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2" weight="bold">{log.userName || '—'}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="1" color="gray">{log.userEmail || '—'}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color="indigo" variant="soft" size="1">{log.userRole || '—'}</Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2">{log.page || '—'}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="1" color="gray" style={{ fontFamily: 'monospace' }}>{log.pagePath || '—'}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="1" color="gray" style={{ fontFamily: 'monospace', fontSize: 10 }}>
                          {log.sessionId ? log.sessionId.slice(0, 16) + '…' : '—'}
                        </Text>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>
          )}
        </Tabs.Content>

        {/* ABA: CARGAS JIRA */}
        <Tabs.Content value="cargas">
          {syncLoading ? (
            <Flex align="center" justify="center" p="6" gap="2">
              <Loader2 size={20} style={{ animation: 'operacao-spin 1s linear infinite' }} />
              <Text color="gray">Carregando logs de carga...</Text>
            </Flex>
          ) : syncLogs.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: 40 }}>
              <Database size={32} color="var(--gray-8)" style={{ margin: '0 auto 12px' }} />
              <Text color="gray">Nenhuma carga registrada ainda.</Text>
              <Text size="1" color="gray" as="p" mt="1">Os logs serão gerados ao executar cargas Jira em Configurações → Jira Operação.</Text>
            </Card>
          ) : (
            <Box style={{ overflowX: 'auto' }}>
              <Table.Root variant="surface">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>Data / Hora</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Usuário</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Total Tickets</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Por Escopo</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Duração</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Run ID</Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {syncLogs.map(log => {
                    const byEscopo = log.ticketsByEscopo || {};
                    const escopoEntries = Object.entries(byEscopo).filter(([, v]) => v > 0);
                    return (
                      <Table.Row key={log.id}>
                        <Table.Cell>
                          <Text size="1" style={{ whiteSpace: 'nowrap' }}>{formatTs(log.finishedAt)}</Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Flex direction="column" gap="0">
                            <Text size="2" weight="bold">{log.userName || '—'}</Text>
                            <Text size="1" color="gray">{log.userEmail || '—'}</Text>
                          </Flex>
                        </Table.Cell>
                        <Table.Cell>
                          {log.status === 'success' ? (
                            <Flex align="center" gap="1">
                              <CheckCircle2 size={14} color="var(--green-9)" />
                              <Badge color="green" size="1">Sucesso</Badge>
                            </Flex>
                          ) : log.status === 'error' ? (
                            <Flex align="center" gap="1">
                              <XCircle size={14} color="var(--red-9)" />
                              <Badge color="red" size="1">Erro</Badge>
                            </Flex>
                          ) : (
                            <Badge color="gray" size="1">{log.status}</Badge>
                          )}
                          {log.errorMessage && (
                            <Text size="1" color="red" style={{ display: 'block', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.errorMessage}>
                              {log.errorMessage}
                            </Text>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="3" weight="bold">{formatNumber(log.ticketsTotal)}</Text>
                          {log.ticketsFetched !== log.ticketsTotal && (
                            <Text size="1" color="gray" style={{ display: 'block' }}>fetched: {formatNumber(log.ticketsFetched)}</Text>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          {escopoEntries.length === 0 ? (
                            <Text size="1" color="gray">—</Text>
                          ) : (
                            <Flex direction="column" gap="1">
                              {escopoEntries.map(([escopo, count]) => (
                                <Flex key={escopo} align="center" gap="1">
                                  <Badge color="blue" variant="soft" size="1">{escopo}</Badge>
                                  <Text size="1" color="gray">{formatNumber(count)}</Text>
                                </Flex>
                              ))}
                            </Flex>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="2" weight="medium" style={{ whiteSpace: 'nowrap' }}>
                            {log.durationFormatted || '—'}
                          </Text>
                          {log.durationMs != null && (
                            <Text size="1" color="gray" style={{ display: 'block' }}>({formatNumber(log.durationMs)} ms)</Text>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="1" color="gray" style={{ fontFamily: 'monospace', fontSize: 10 }}>
                            {log.runId ? log.runId.slice(0, 12) + '…' : '—'}
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Root>
            </Box>
          )}
        </Tabs.Content>
      </Tabs.Root>

      <style>{`@keyframes operacao-spin { to { transform: rotate(360deg); } }`}</style>
    </Box>
  );
};

export default AuditDashboard;
