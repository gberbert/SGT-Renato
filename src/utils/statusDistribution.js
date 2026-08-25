const PIE_COLORS = [
  '#22d3ee',
  '#4ade80',
  '#facc15',
  '#fb923c',
  '#f87171',
  '#a78bfa',
  '#38bdf8',
  '#f472b6',
  '#94a3b8',
  '#34d399',
];

/**
 * Consolida a quantidade de tickets por status (campo `status`), ordenado do maior para o menor.
 * Atribui uma cor estável (por ordem) a cada status para uso em gráficos de pizza.
 */
export function buildStatusDistribution(tickets = [], options = {}) {
  const statusField = options.statusField || 'status';
  const maxSlices = options.maxSlices || 8;

  const counts = new Map();
  for (const ticket of tickets) {
    const raw = ticket?.[statusField];
    const status = String(raw || '').trim() || 'Sem status';
    counts.set(status, (counts.get(status) || 0) + 1);
  }

  const sorted = [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  if (sorted.length <= maxSlices) {
    return sorted.map((item, index) => ({ ...item, color: PIE_COLORS[index % PIE_COLORS.length] }));
  }

  const top = sorted.slice(0, maxSlices - 1).map((item, index) => ({
    ...item,
    color: PIE_COLORS[index % PIE_COLORS.length],
  }));
  const restTotal = sorted.slice(maxSlices - 1).reduce((acc, item) => acc + item.value, 0);
  top.push({ name: 'Outros', value: restTotal, color: PIE_COLORS[(maxSlices - 1) % PIE_COLORS.length] });

  return top;
}
