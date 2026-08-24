import React, { lazy, Suspense, useMemo, useState } from 'react';
import { Box, Flex, Text, Select } from '@radix-ui/themes';
import { GRANULARITY_OPTIONS, buildCreatedVsResolvedSeries } from '../../utils/timeSeriesBuckets';

// Lazy-load do recharts: usado apenas nas abas de escopo do Radar, evita inflar o bundle principal.
const RechartsBarChart = lazy(async () => {
  const {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LabelList,
  } = await import('recharts');

  const AXIS_TICK_COLOR = '#9ca3af';

  return {
    default: ({ data }) => (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: AXIS_TICK_COLOR }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 12, fill: AXIS_TICK_COLOR }} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: 'var(--color-panel-solid, #1a1a1a)',
              border: '1px solid var(--glass-border)',
              borderRadius: 8,
            }}
          />
          <Legend />
          <Bar dataKey="criados" name="Criados" fill="#22d3ee" radius={[4, 4, 0, 0]}>
            <LabelList dataKey="criados" position="top" fontSize={10} fill={AXIS_TICK_COLOR} />
          </Bar>
          <Bar dataKey="resolvidos" name="Resolvidos" fill="#4ade80" radius={[4, 4, 0, 0]}>
            <LabelList dataKey="resolvidos" position="top" fontSize={10} fill={AXIS_TICK_COLOR} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    ),
  };
});

/**
 * Gráfico de barras verticais comparando tickets criados vs resolvidos,
 * agrupados pela granularidade escolhida (dia/semana/mês/trimestre/quarter/ano).
 */
const OperacaoEscopoTimelineChart = ({ tickets = [] }) => {
  const [granularity, setGranularity] = useState('mes');

  const data = useMemo(
    () => buildCreatedVsResolvedSeries(tickets, granularity),
    [tickets, granularity]
  );

  const hasData = data.length > 0;

  return (
    <Box className="operacao-radar-timeline-chart" mt="4" mb="4">
      <Flex align="center" justify="between" wrap="wrap" gap="3" mb="3">
        <Text size="3" weight="bold">
          Criados x Resolvidos
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

      {!hasData ? (
        <Text size="2" color="gray">
          Sem dados suficientes de data de criação/resolução para este escopo.
        </Text>
      ) : (
        <Box style={{ width: '100%', height: 320 }}>
          <Suspense fallback={<Text size="2" color="gray">Carregando gráfico…</Text>}>
            <RechartsBarChart data={data} />
          </Suspense>
        </Box>
      )}
    </Box>
  );
};

export default OperacaoEscopoTimelineChart;
