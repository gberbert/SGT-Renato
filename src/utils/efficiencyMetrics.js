import { bucketKeyForDate } from './timeSeriesBuckets';

/**
 * Constrói série de eficiência por período: para cada bucket (baseado em resolvedAt),
 * calcula quantos tickets foram resolvidos SEM reabertura (reopenCount === 0 ou ausente)
 * e quantos foram resolvidos COM reabertura (reopenCount > 0), além do percentual de
 * resolução "limpa" (sem reabertura) sobre o total resolvido no período.
 *
 * @param {Array} tickets - tickets já filtrados (ex.: por escopo/filtros ativos)
 * @param {string} granularity 'dia'|'semana'|'mes'|'trimestre'|'quarter'|'ano'
 * @param {{resolvedField?: string, reopenField?: string, maxBuckets?: number}} options
 */
export function buildEfficiencySeries(tickets, granularity, options = {}) {
  const resolvedField = options.resolvedField || 'resolvedAt';
  const reopenField = options.reopenField || 'reopenCount';
  const maxBuckets = options.maxBuckets || 60;

  const bucketsMap = new Map();

  for (const ticket of tickets) {
    const resolvedValue = ticket[resolvedField];
    if (!resolvedValue) continue;

    const bucketInfo = bucketKeyForDate(resolvedValue, granularity);
    if (!bucketInfo) continue;

    if (!bucketsMap.has(bucketInfo.key)) {
      bucketsMap.set(bucketInfo.key, {
        key: bucketInfo.key,
        label: bucketInfo.label,
        sortKey: bucketInfo.sortKey,
        semReabertura: 0,
        comReabertura: 0,
      });
    }

    const bucket = bucketsMap.get(bucketInfo.key);
    const reopenCount = Number(ticket[reopenField]) || 0;
    if (reopenCount > 0) {
      bucket.comReabertura += 1;
    } else {
      bucket.semReabertura += 1;
    }
  }

  const sorted = [...bucketsMap.values()]
    .map((bucket) => {
      const totalResolvidos = bucket.semReabertura + bucket.comReabertura;
      const percentSemReabertura = totalResolvidos > 0
        ? Math.round((bucket.semReabertura / totalResolvidos) * 1000) / 10
        : 0;
      return { ...bucket, totalResolvidos, percentSemReabertura };
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  return sorted.length > maxBuckets ? sorted.slice(sorted.length - maxBuckets) : sorted;
}

/**
 * Resumo agregado (todo o período filtrado) de eficiência de resolução.
 */
export function computeEfficiencySummary(tickets, options = {}) {
  const resolvedField = options.resolvedField || 'resolvedAt';
  const reopenField = options.reopenField || 'reopenCount';

  let semReabertura = 0;
  let comReabertura = 0;

  for (const ticket of tickets) {
    if (!ticket[resolvedField]) continue;
    const reopenCount = Number(ticket[reopenField]) || 0;
    if (reopenCount > 0) comReabertura += 1;
    else semReabertura += 1;
  }

  const totalResolvidos = semReabertura + comReabertura;
  const percentSemReabertura = totalResolvidos > 0
    ? Math.round((semReabertura / totalResolvidos) * 1000) / 10
    : 0;

  return {
    totalResolvidos,
    semReabertura,
    comReabertura,
    percentSemReabertura,
  };
}
