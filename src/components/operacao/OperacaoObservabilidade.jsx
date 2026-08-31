import React, { useMemo, useState } from 'react';
import { Box, Flex, Text, Select, Tooltip } from '@radix-ui/themes';
import { Info, ShieldCheck } from 'lucide-react';
import { computeObservabilidadeIndicators } from '../../utils/observabilidadeRules';
import { normalizeEscopoKey, ESCOPO_RADAR_ORDER } from '../../services/operacaoRadarService';

const ESCOPO_FILTER_OPTIONS = [
  { value: 'ALL', label: 'Todos os escopos' },
  ...ESCOPO_RADAR_ORDER.map((e) => ({ value: e.key, label: e.label })),
];

const formatNumber = (value) => Number(value || 0).toLocaleString('pt-BR');

/**
 * Aba "Observabilidade" do Radar Operação: indicadores primários de saúde operacional
 * e compliance da equipe com o processo de atendimento (hoje focados em PROBLEMAS,
 * conforme regras definidas pelo time).
 */
const OperacaoObservabilidade = ({ tickets = [], onDrillTickets }) => {
  const [escopoFilter, setEscopoFilter] = useState('ALL');

  const filteredTickets = useMemo(() => {
    if (escopoFilter === 'ALL') return tickets;
    return tickets.filter((t) => normalizeEscopoKey(t.escopo) === escopoFilter);
  }, [tickets, escopoFilter]);

  const indicators = useMemo(
    () => computeObservabilidadeIndicators(filteredTickets),
    [filteredTickets]
  );

  return (
    <Box>
      <Flex align="center" justify="between" wrap="wrap" gap="3" mb="4">
        <Flex align="center" gap="2">
          <ShieldCheck size={20} color="#22d3ee" />
          <Box>
            <Text size="4" weight="bold">
              Observabilidade
            </Text>
            <Text as="p" size="2" color="gray" style={{ margin: 0 }}>
              Indicadores de saúde da operação e compliance com o processo de atendimento.
            </Text>
          </Box>
        </Flex>

        <Flex align="center" gap="2">
          <Text size="1" color="gray" style={{ letterSpacing: '0.05em' }}>
            ESCOPO
          </Text>
          <Select.Root value={escopoFilter} onValueChange={setEscopoFilter}>
            <Select.Trigger style={{ minWidth: 180 }} />
            <Select.Content>
              {ESCOPO_FILTER_OPTIONS.map((opt) => (
                <Select.Item key={opt.value} value={opt.value}>
                  {opt.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Flex>
      </Flex>

      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
        }}
      >
        {indicators.map((indicator) => (
          <Box
            key={indicator.key}
            style={{
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              background: 'rgba(255,255,255,0.02)',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <Flex align="center" justify="between">
              <Text size="2" color="gray" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {indicator.label}
              </Text>
              <Tooltip content={indicator.rule}>
                <Info size={16} color="var(--text-muted)" style={{ cursor: 'help' }} />
              </Tooltip>
            </Flex>
            {onDrillTickets && indicator.total > 0 ? (
              <button
                type="button"
                onClick={() => onDrillTickets(indicator.tickets, `Observabilidade · ${indicator.label}`)}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                title={`Ver ${indicator.total} ticket(s) — ${indicator.label}`}
              >
                <Text size="8" weight="bold" style={{ color: '#f87171', textDecoration: 'underline dotted' }}>
                  {formatNumber(indicator.total)}
                </Text>
              </button>
            ) : (
              <Text size="8" weight="bold" style={{ color: indicator.total > 0 ? '#f87171' : '#4ade80' }}>
                {formatNumber(indicator.total)}
              </Text>
            )}
          </Box>
        ))}
      </Box>

      {indicators.every((i) => i.total === 0) && (
        <Text size="2" color="gray" mt="4">
          Nenhum indicador acusou pendências para o escopo selecionado. Operação saudável.
        </Text>
      )}
    </Box>
  );
};

export default OperacaoObservabilidade;
