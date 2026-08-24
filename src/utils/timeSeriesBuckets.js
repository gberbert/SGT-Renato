const PT_MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const GRANULARITY_OPTIONS = [
  { value: 'dia', label: 'Dia' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mês' },
  { value: 'trimestre', label: 'Trimestre (3 meses corridos)' },
  { value: 'quarter', label: 'Quarter (trimestre civil)' },
  { value: 'ano', label: 'Ano' },
];

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfWeek(d) {
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Retorna uma chave de bucket (string, ordenável) e um rótulo legível
 * para a data fornecida, de acordo com a granularidade.
 */
export function bucketKeyForDate(date, granularity) {
  const d = toDate(date);
  if (!d) return null;

  switch (granularity) {
    case 'dia': {
      const key = d.toISOString().slice(0, 10);
      const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      return { key, label, sortKey: key };
    }
    case 'semana': {
      const monday = startOfWeek(d);
      const key = monday.toISOString().slice(0, 10);
      const label = `${String(monday.getDate()).padStart(2, '0')}/${String(monday.getMonth() + 1).padStart(2, '0')}`;
      return { key, label: `Sem ${label}`, sortKey: key };
    }
    case 'mes': {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${PT_MONTHS_SHORT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
      return { key, label, sortKey: key };
    }
    case 'trimestre': {
      // bucket móvel: agrupa por trimestre corrido ancorado no mês (rótulo = mês final do trimestre)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${PT_MONTHS_SHORT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
      return { key, label, sortKey: key };
    }
    case 'quarter': {
      const q = Math.floor(d.getMonth() / 3) + 1;
      const key = `${d.getFullYear()}-Q${q}`;
      const label = `Q${q}/${String(d.getFullYear()).slice(2)}`;
      return { key, label, sortKey: key };
    }
    case 'ano': {
      const key = String(d.getFullYear());
      return { key, label: key, sortKey: key };
    }
    default:
      return null;
  }
}

/**
 * Constrói série temporal comparando createdAt x resolvedAt (ou outro par de campos)
 * agrupados pela granularidade escolhida.
 *
 * @param {Array} tickets
 * @param {string} granularity 'dia'|'semana'|'mes'|'trimestre'|'quarter'|'ano'
 * @param {{createdField?: string, resolvedField?: string, maxBuckets?: number}} options
 */
export function buildCreatedVsResolvedSeries(tickets, granularity, options = {}) {
  const createdField = options.createdField || 'createdAt';
  const resolvedField = options.resolvedField || 'resolvedAt';
  const maxBuckets = options.maxBuckets || 60;

  const bucketsMap = new Map();

  const ensureBucket = (bucketInfo) => {
    if (!bucketInfo) return null;
    if (!bucketsMap.has(bucketInfo.key)) {
      bucketsMap.set(bucketInfo.key, {
        key: bucketInfo.key,
        label: bucketInfo.label,
        sortKey: bucketInfo.sortKey,
        criados: 0,
        resolvidos: 0,
      });
    }
    return bucketsMap.get(bucketInfo.key);
  };

  for (const ticket of tickets) {
    const createdBucket = ensureBucket(bucketKeyForDate(ticket[createdField], granularity));
    if (createdBucket) createdBucket.criados += 1;

    const resolvedValue = ticket[resolvedField];
    if (resolvedValue) {
      const resolvedBucket = ensureBucket(bucketKeyForDate(resolvedValue, granularity));
      if (resolvedBucket) resolvedBucket.resolvidos += 1;
    }
  }

  const sorted = [...bucketsMap.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  // Mantém apenas os últimos N buckets para não poluir o gráfico
  return sorted.length > maxBuckets ? sorted.slice(sorted.length - maxBuckets) : sorted;
}
