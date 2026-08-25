import React, { lazy, Suspense, useMemo, useState } from 'react';
import { Box, Flex, Text, Select, Card, Grid } from '@radix-ui/themes';
import { GRANULARITY_OPTIONS } from '../../utils/timeSeriesBuckets';
import { buildEfficiencySeries, computeEfficiencySummary } from '../../utils/efficiencyMetrics';
import OperacaoStatusPieChart from './OperacaoStatusPieChart';

const AXIS_TICK_COLOR = '#9ca3af';

// Lazy-load do recharts: evita inflar o bundle principal.
const RechartsEfficiencyChart = lazy(async () => {
  const {
    BarChart,
    Bar,
    Line,
    ComposedChart,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LabelList,
  } = await import('recharts');

  return {
    default: ({ data }) => (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 20, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: AXIS_TICK_COLOR }} interval="preserveStartEnd" />
          <YAxis yAxisId="left" tick={{ fontSize: 12, fill: AXIS_TICK_COLOR }} allowDecimals={false} />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12, fill: AXIS_TICK_COLOR }}
            domain={[0, 100]}
            unit="%"
          />
          <Tooltip
            contentStyle={{
              background: 'var(--color-panel-solid, #1a1a1a)',
              border: '1px solid var(--glass-border)',
              borderRadius: 8,
            }}
          />
          <Legend />
          <Bar
            yAxisId="left"
            dataKey="semReabertura"
            name="Resolvidos sem reabertura"
            stackId="resolvidos"
            fill="#4ade80"
          >
            <LabelList dataKey="semReabertura" position="inside" fontSize={10} fill="#0f172a" />
          </Bar>
          <Bar
            yAxisId="left"
            dataKey="comReabertura"
            name="Resolvidos com reabertura"
            stackId="resolvidos"
            fill="#f87171"
            radius={[4, 4, 0, 0]}
          >
            <LabelList dataKey="comReabertura" position="top" fontSize={10} fill={AXIS_TICK_COLOR} />
          </Bar>
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="percentSemReabertura"
            name="% Eficiência (sem reabertura)"
            stroke="#22d3ee"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    ),
  };
});

/**
 * Gráfico de eficiência de resolução por período: compara tickets resolvidos com e sem
 * reabertura (campo reopenCount > 0), agrupados pela granularidade escolhida, e sobrepõe
 * uma linha com o percentual de resolução "limpa" (sem reabertura).
 */
const OperacaoEfficiencyChart = ({ tickets = [] }) => {
  const [granularity, setGranularity] = useState('mes');

  const data = useMemo(
    () => buildEfficiencySeries(tickets, granularity),
    [tickets, granularity]
  );

  const summary = useMemo(() => computeEfficiencySummary(tickets), [tickets]);

  const hasData = data.length > 0;

  return (
    <Box className="operacao-radar-efficiency-chart">
      <Grid columns={{ initial: '2', sm: '4' }} gap="3" mb="4">
        <Card size="1" variant="surface">
          <Text size="1" color="gray" style={{ textTransform: 'uppercase' }}>
            Resolvidos
          </Text>
          <Text as="div" size="6" weight="bold">
            {summary.totalResolvidos.toLocaleString('pt-BR')}
          </Text>
        </Card>
        <Card size="1" variant="surface">
          <Text size="1" color="gray" style={{ textTransform: 'uppercase' }}>
            Sem reabertura
          </Text>
          <Text as="div" size="6" weight="bold" style={{ color: '#4ade80' }}>
            {summary.semReabertura.toLocaleString('pt-BR')}
          </Text>
        </Card>
        <Card size="1" variant="surface">
          <Text size="1" color="gray" style={{ textTransform: 'uppercase' }}>
            Com reabertura
          </Text>
          <Text as="div" size="6" weight="bold" style={{ color: '#f87171' }}>
            {summary.comReabertura.toLocaleString('pt-BR')}
          </Text>
        </Card>
        <Card size="1" variant="surface">
          <Text size="1" color="gray" style={{ textTransform: 'uppercase' }}>
            % Eficiência
          </Text>
          <Text as="div" size="6" weight="bold" style={{ color: '#22d3ee' }}>
            {summary.percentSemReabertura.toLocaleString('pt-BR')}%
          </Text>
        </Card>
      </Grid>

      <Flex align="center" justify="between" wrap="wrap" gap="3" mb="3">
        <Text size="3" weight="bold">
          Resolução com x sem reabertura
        </Text>
        <Flex align="center" gap="2">
          <Text size="1" color="gray" style={{ letterSpacing: '0.06em' }}>
            AGRUPAR POR
          </Text>
          <Select.Root value={granularity} onValueChange={setGranularity}>
            <Select.Trigger style={{ minWidth: 160 }} />
            <Select.Content>
              {GRANULARITY_OPTIONS.map((opt) => (
                <Select.Item key={opt.value} value={opt.value}>
                  {opt.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Flex>
      </Flex>

      <Flex gap="4" wrap="wrap" align="start">
        <Box style={{ flex: 2, minWidth: 320 }}>
          {!hasData ? (
            <Text size="2" color="gray">
              Sem tickets resolvidos (com data de resolução) para calcular eficiência neste escopo.
            </Text>
          ) : (
            <Box style={{ width: '100%', height: 340 }}>
              <Suspense fallback={<Text size="2" color="gray">Carregando gráfico…</Text>}>
                <RechartsEfficiencyChart data={data} />
              </Suspense>
            </Box>
          )}
        </Box>

        <Box style={{ flex: 1, minWidth: 280 }}>
          <OperacaoStatusPieChart tickets={tickets} />
        </Box>
      </Flex>
    </Box>
  );
};

export default OperacaoEfficiencyChart;
