import React, { lazy, Suspense, useMemo } from 'react';
import { Box, Flex, Text } from '@radix-ui/themes';
import { buildStatusDistribution } from '../../utils/statusDistribution';

const RechartsPieChart = lazy(async () => {
  const { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } = await import('recharts');

  return {
    default: ({ data }) => (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={2}
            label={({ percent }) => `${Math.round(percent * 100)}%`}
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'var(--color-panel-solid, #1a1a1a)',
              border: '1px solid var(--glass-border)',
              borderRadius: 8,
            }}
          />
          <Legend
            layout="vertical"
            verticalAlign="middle"
            align="right"
            wrapperStyle={{ fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
    ),
  };
});

/**
 * Gráfico de pizza consolidando o total de tickets por status.
 */
const OperacaoStatusPieChart = ({ tickets = [] }) => {
  const data = useMemo(() => buildStatusDistribution(tickets), [tickets]);
  const hasData = data.length > 0;
  const total = useMemo(() => data.reduce((acc, item) => acc + item.value, 0), [data]);

  return (
    <Box className="operacao-radar-status-pie">
      <Flex align="center" justify="between" wrap="wrap" gap="3" mb="3">
        <Text size="3" weight="bold">
          Tickets por Status
        </Text>
        {hasData && (
          <Text size="1" color="gray">
            {total.toLocaleString('pt-BR')} ticket(s)
          </Text>
        )}
      </Flex>

      {!hasData ? (
        <Text size="2" color="gray">
          Sem tickets para consolidar por status neste escopo.
        </Text>
      ) : (
        <Box style={{ width: '100%', height: 320 }}>
          <Suspense fallback={<Text size="2" color="gray">Carregando gráfico…</Text>}>
            <RechartsPieChart data={data} />
          </Suspense>
        </Box>
      )}
    </Box>
  );
};

export default OperacaoStatusPieChart;
