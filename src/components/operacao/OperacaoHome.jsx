import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Flex, Text, Callout, Progress, TextField } from '@radix-ui/themes';
import { Radar, RefreshCw, XCircle, Search, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import OperacaoMultiCombobox from './OperacaoMultiCombobox';
import { useOperacaoRadar } from '../../contexts/OperacaoRadarContext';
import { formatCallableError } from '../../utils/callableError';
import {
  createRadarFilterState,
  fetchTicketsForDrill,
  flattenDrillHierarchy,
  getEscopoRadarMeta,
  getFilterSummary,
  prepareDrillHierarchy,
} from '../../services/operacaoRadarService';
import './operacao-radar.css';

const formatNumber = (value) => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('pt-BR');
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('pt-BR');
};

const OperacaoHome = () => {
  const {
    bootLoading,
    error,
    statsRadar,
    filterOptions,
    ensureRadarBootstrap,
    refreshRadar,
  } = useOperacaoRadar();

  useEffect(() => {
    ensureRadarBootstrap();
  }, [ensureRadarBootstrap]);

  const [filters, setFilters] = useState(createRadarFilterState);
  const [drillEscopo, setDrillEscopo] = useState(null);
  const [drillLabel, setDrillLabel] = useState('');
  const [drillIssueKeyQuery, setDrillIssueKeyQuery] = useState('');
  const [expandedParents, setExpandedParents] = useState(() => new Set());
  const [drillTickets, setDrillTickets] = useState([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState('');

  const radar = useMemo(
    () => statsRadar || { total: 0, escopos: [] },
    [statsRadar]
  );

  const drillHierarchy = useMemo(() => {
    if (drillEscopo === null) {
      return { roots: [], childrenByParent: new Map(), totalTickets: 0 };
    }
    return prepareDrillHierarchy(drillTickets, drillEscopo || undefined, drillIssueKeyQuery);
  }, [drillTickets, drillEscopo, drillIssueKeyQuery]);

  const drillRows = useMemo(
    () => flattenDrillHierarchy(drillHierarchy, expandedParents),
    [drillHierarchy, expandedParents]
  );

  const hasData = Boolean(statsRadar?.total);
  const filterActive =
    filters.grupos.size > 0 || filters.squads.size > 0 || filters.statuses.size > 0;

  const openDrill = useCallback(async (escopoKey, label) => {
    setDrillIssueKeyQuery('');
    setExpandedParents(new Set());
    setDrillEscopo(escopoKey);
    setDrillLabel(label);
    setDrillTickets([]);
    setDrillError('');
    setDrillLoading(true);

    try {
      const tickets = await fetchTicketsForDrill({ escopoKey: escopoKey || null });
      setDrillTickets(tickets);
    } catch (err) {
      setDrillError(formatCallableError(err));
    } finally {
      setDrillLoading(false);
    }
  }, []);

  const toggleParentExpand = (issueKey) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(issueKey)) next.delete(issueKey);
      else next.add(issueKey);
      return next;
    });
  };

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters(createRadarFilterState());
    setDrillEscopo(null);
    setDrillLabel('');
    setDrillIssueKeyQuery('');
    setExpandedParents(new Set());
    setDrillTickets([]);
    setDrillError('');
  };

  return (
    <Box p="5" className="operacao-radar-panel">
      <Flex align="center" justify="between" wrap="wrap" gap="3" mb="2">
        <Flex align="center" gap="3">
          <Radar size={28} color="#22d3ee" />
          <Box className="operacao-radar-header">
            <Text as="h2" size="7" weight="bold" style={{ margin: 0 }}>
              Radar Operação AMS
            </Text>
            <Text as="p" size="3" color="gray">
              Totais consolidados em <code>operacao_stats/summary</code>. Detalhes por escopo são
              lidos do Firestore sob demanda.
            </Text>
          </Box>
        </Flex>
        <button
          className="btn btn-ghost"
          onClick={refreshRadar}
          disabled={bootLoading}
          type="button"
        >
          <RefreshCw size={16} /> Atualizar
        </button>
      </Flex>

      {error && (
        <Callout.Root color="red" mb="4">
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      )}

      {bootLoading && (
        <Box mb="4">
          <Text size="2" color="gray" mb="2">
            Carregando totais do radar…
          </Text>
          <Progress />
        </Box>
      )}

      {!bootLoading && !hasData && (
        <Callout.Root color="amber" mb="4">
          <Callout.Text>
            Nenhum ticket em <code>tickets_global</code>. Execute a carga Jira em Configurações →
            Jira Operação (botão <strong>Iniciar Carga</strong>).
          </Callout.Text>
        </Callout.Root>
      )}

      {!bootLoading && hasData && (
        <>
          <Box className="operacao-radar-filters is-disabled">
            <OperacaoMultiCombobox
              label="GRUPO DE ATENDIMENTO"
              placeholder="Todos os grupos"
              options={filterOptions.grupos}
              selected={filters.grupos}
              onChange={(value) => updateFilter('grupos', value)}
              formatMeta={(item) => `${formatNumber(item.total)} tickets`}
              disabled
            />
            <OperacaoMultiCombobox
              label="SQUAD"
              placeholder="Todas as squads"
              options={filterOptions.squads}
              selected={filters.squads}
              onChange={(value) => updateFilter('squads', value)}
              formatOption={(item) =>
                item.sigla ? `${item.sigla} — ${item.nome}` : item.nome
              }
              formatMeta={(item) => `${formatNumber(item.total)} tickets`}
              disabled
            />
            <OperacaoMultiCombobox
              label="STATUS DO TICKET"
              placeholder="Todos os status"
              options={filterOptions.statuses}
              selected={filters.statuses}
              onChange={(value) => updateFilter('statuses', value)}
              formatMeta={(item) => `${formatNumber(item.total)} tickets`}
              disabled
            />
            <Flex
              className="operacao-radar-filter-actions"
              align="center"
              justify="between"
              wrap="wrap"
              gap="2"
            >
              <Text className="operacao-radar-filter-summary">
                Filtros globais desativados para reduzir leituras do Firestore. Clique em um escopo
                para carregar a tabela de tickets daquele grupo.
              </Text>
              {filterActive && (
                <button
                  type="button"
                  className="operacao-radar-clear-filters btn btn-ghost"
                  onClick={clearFilters}
                >
                  <XCircle size={16} /> Limpar filtros
                </button>
              )}
            </Flex>
          </Box>

          <Box className="operacao-radar-summary">
            <Flex className="operacao-radar-summary-row" align="center" gap="3" wrap="wrap">
              <button
                type="button"
                className="operacao-radar-summary-value"
                title="Ver tickets de todos os escopos"
                onClick={() => openDrill('', 'Todos os escopos')}
                disabled={drillLoading}
              >
                {formatNumber(radar.total)}
              </button>
            </Flex>
            <Text className="operacao-radar-summary-label">Tickets em todos os escopos</Text>
          </Box>

          <Box className="operacao-radar-lanes">
            {radar.escopos.length === 0 ? (
              <Text className="operacao-radar-loading">Nenhum ticket registrado nos escopos.</Text>
            ) : (
              radar.escopos.map((item) => (
                <article
                  key={item.key}
                  className={`operacao-radar-lane${drillEscopo === item.key ? ' selected' : ''}`}
                  style={{ '--lane-color': item.color }}
                >
                  <Flex align="baseline" gap="2" wrap="wrap">
                    <button
                      type="button"
                      className="operacao-radar-lane-value"
                      title={`Ver tickets de ${item.label}`}
                      onClick={() => openDrill(item.key, item.label)}
                      disabled={drillLoading && drillEscopo === item.key}
                    >
                      {formatNumber(item.total)}
                    </button>
                    {drillLoading && drillEscopo === item.key && (
                      <Text className="operacao-radar-loading-badge" size="1">
                        <Loader2 size={12} className="operacao-radar-loading-icon" aria-hidden="true" />
                        Carregando…
                      </Text>
                    )}
                  </Flex>
                  <Text className="operacao-radar-lane-label">{item.label}</Text>
                  {item.issueTypes?.length > 0 ? (
                    <ul className="operacao-radar-lane-issue-types">
                      {item.issueTypes.map((issueType) => (
                        <li key={`${item.key}-${issueType.name}`}>
                          <span className="operacao-radar-lane-issue-type-name">{issueType.name}</span>
                          <span className="operacao-radar-lane-issue-type-total">
                            {formatNumber(issueType.total)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              ))
            )}
          </Box>

          {drillEscopo !== null && (
            <Box className="operacao-radar-tickets-panel">
              <Flex className="operacao-radar-tickets-header" align="center" justify="between" wrap="wrap" gap="3">
                <Box>
                  <Text size="4" weight="bold">
                    Tickets · {drillLabel || getEscopoRadarMeta(drillEscopo).label}
                  </Text>
                  <Text size="2" color="gray">
                    {drillLoading
                      ? 'Consultando tickets no Firestore…'
                      : `${formatNumber(drillHierarchy.totalTickets)} ticket(s)${drillRows.length < drillHierarchy.totalTickets ? ` · ${formatNumber(drillRows.length)} exibido(s)` : ''}`}
                  </Text>
                </Box>
                <Box className="operacao-radar-drill-filter">
                  <Text size="1" weight="bold" color="gray" mb="1" style={{ letterSpacing: '0.06em' }}>
                    ISSUE_KEY
                  </Text>
                  <TextField.Root
                    size="2"
                    placeholder="Filtrar por chave (ex: PROB-483)"
                    value={drillIssueKeyQuery}
                    onChange={(event) => setDrillIssueKeyQuery(event.target.value)}
                    style={{ minWidth: 240 }}
                    disabled={drillLoading}
                  >
                    <TextField.Slot>
                      <Search size={14} />
                    </TextField.Slot>
                  </TextField.Root>
                </Box>
              </Flex>

              {drillError && (
                <Callout.Root color="red" mb="3">
                  <Callout.Text>{drillError}</Callout.Text>
                </Callout.Root>
              )}

              {drillLoading ? (
                <Box mt="3">
                  <Progress />
                </Box>
              ) : drillHierarchy.totalTickets === 0 ? (
                <Text size="2" color="gray">
                  {drillIssueKeyQuery.trim()
                    ? `Nenhum ticket com issue_key contendo "${drillIssueKeyQuery.trim()}".`
                    : 'Nenhum ticket encontrado para esta seleção.'}
                </Text>
              ) : (
                <Box className="operacao-radar-tickets-table-wrap">
                  <table className="operacao-radar-tickets-table">
                    <thead>
                      <tr>
                        <th>ISSUE_KEY</th>
                        <th>ISSUETYPE</th>
                        <th>SUMMARY</th>
                        <th>STATUS</th>
                        <th>PRIORITY</th>
                        <th>CREATED_AT</th>
                        <th>AGING</th>
                        <th>UPDATE_AT</th>
                        <th>TICKETS_VINCULADOS</th>
                        <th>GRUPO_SUPORTE</th>
                        <th>ESCOPO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drillRows.map((ticket) => (
                        <tr
                          key={ticket.issueKey}
                          className={ticket.depth > 0 ? 'operacao-radar-tickets-row-child' : undefined}
                        >
                          <td
                            className="operacao-radar-tickets-key-cell"
                            style={{ paddingLeft: `${0.75 + ticket.depth * 1.35}rem` }}
                          >
                            {ticket.hasChildren ? (
                              <button
                                type="button"
                                className="operacao-radar-tickets-expand"
                                title={
                                  ticket.isExpanded
                                    ? 'Recolher tickets filhos'
                                    : `Expandir ${formatNumber(ticket.childCount)} ticket(s) filho(s)`
                                }
                                aria-expanded={ticket.isExpanded}
                                onClick={() => toggleParentExpand(ticket.issueKey)}
                              >
                                {ticket.isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </button>
                            ) : (
                              <span className="operacao-radar-tickets-expand placeholder" aria-hidden="true" />
                            )}
                            {ticket.issueUrl ? (
                              <a
                                className="operacao-radar-tickets-key"
                                href={ticket.issueUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {ticket.issueKey}
                              </a>
                            ) : (
                              ticket.issueKey
                            )}
                            {ticket.hasChildren && !ticket.isExpanded && (
                              <span className="operacao-radar-tickets-child-count">
                                {formatNumber(ticket.childCount)} filho(s)
                              </span>
                            )}
                          </td>
                          <td>{ticket.issueType || '—'}</td>
                          <td className="operacao-radar-tickets-summary">{ticket.summary || '—'}</td>
                          <td>{ticket.status || '—'}</td>
                          <td>{ticket.priority || '—'}</td>
                          <td>{formatDateTime(ticket.createdAt)}</td>
                          <td>{ticket.agingDays != null ? `${formatNumber(ticket.agingDays)} d` : '—'}</td>
                          <td>{formatDateTime(ticket.updatedAt)}</td>
                          <td className="operacao-radar-tickets-linked">
                            {ticket.linkedTicketsLabel || '—'}
                          </td>
                          <td>{ticket.grupoSuporte || '—'}</td>
                          <td>{ticket.escopo || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
              )}
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default OperacaoHome;
