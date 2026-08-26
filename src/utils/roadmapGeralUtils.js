const PT_MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const ROADMAP_GRANULARITY_OPTIONS = [
  { value: 'dia', label: 'Dia', colWidth: 42 },
  { value: 'semana', label: 'Semana', colWidth: 64 },
  { value: 'mes', label: 'Mês', colWidth: 96 },
  { value: 'trimestre', label: 'Trimestre', colWidth: 120 },
  { value: 'quarter', label: 'Quarter', colWidth: 120 },
  { value: 'ano', label: 'Ano', colWidth: 150 },
];

export function getColWidth(granularity) {
  return (ROADMAP_GRANULARITY_OPTIONS.find((g) => g.value === granularity) || ROADMAP_GRANULARITY_OPTIONS[2]).colWidth;
}

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeek(d) {
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return startOfDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday));
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfQuarter(d) {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}

function startOfYear(d) {
  return new Date(d.getFullYear(), 0, 1);
}

function addStep(d, granularity, steps = 1) {
  const next = new Date(d.getTime());
  switch (granularity) {
    case 'dia':
      next.setDate(next.getDate() + steps);
      return next;
    case 'semana':
      next.setDate(next.getDate() + 7 * steps);
      return next;
    case 'mes':
    case 'trimestre':
      next.setMonth(next.getMonth() + steps);
      return next;
    case 'quarter':
      next.setMonth(next.getMonth() + 3 * steps);
      return next;
    case 'ano':
      next.setFullYear(next.getFullYear() + steps);
      return next;
    default:
      return next;
  }
}

function bucketStart(d, granularity) {
  switch (granularity) {
    case 'dia':
      return startOfDay(d);
    case 'semana':
      return startOfWeek(d);
    case 'mes':
    case 'trimestre':
      return startOfMonth(d);
    case 'quarter':
      return startOfQuarter(d);
    case 'ano':
      return startOfYear(d);
    default:
      return startOfDay(d);
  }
}

function labelForBucket(d, granularity) {
  switch (granularity) {
    case 'dia':
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    case 'semana':
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    case 'mes':
    case 'trimestre':
      return `${PT_MONTHS_SHORT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
    case 'quarter': {
      const q = Math.floor(d.getMonth() / 3) + 1;
      return `Q${q}/${String(d.getFullYear()).slice(2)}`;
    }
    case 'ano':
      return String(d.getFullYear());
    default:
      return '';
  }
}

function groupLabelForBucket(d, granularity) {
  // Rótulo do "supercabeçalho" (ex: nome do mês para a granularidade dia/semana; ano para mês/trimestre/quarter)
  switch (granularity) {
    case 'dia':
    case 'semana':
      return `${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][d.getMonth()]} ${d.getFullYear()}`;
    case 'mes':
    case 'trimestre':
    case 'quarter':
      return String(d.getFullYear());
    case 'ano':
      return '';
    default:
      return '';
  }
}

/**
 * Gera colunas contínuas cobrindo [minDate, maxDate] (inclusive), de acordo com a granularidade.
 * Cada coluna tem { key, label, start, end, groupLabel }.
 */
export function generateTimelineColumns(minDate, maxDate, granularity) {
  if (!minDate || !maxDate) return [];

  let cursor = bucketStart(minDate, granularity);
  const end = bucketStart(maxDate, granularity);
  const columns = [];
  let guard = 0;

  while (cursor.getTime() <= end.getTime() && guard < 2000) {
    const next = addStep(cursor, granularity, 1);
    columns.push({
      key: cursor.toISOString(),
      label: labelForBucket(cursor, granularity),
      groupLabel: groupLabelForBucket(cursor, granularity),
      start: cursor,
      end: next,
    });
    cursor = next;
    guard += 1;
  }

  return columns;
}

/**
 * Colapsa os rótulos de "supercabeçalho" consecutivos iguais em blocos { label, span }.
 */
export function collapseGroupLabels(columns) {
  const groups = [];
  for (const col of columns) {
    const last = groups[groups.length - 1];
    if (last && last.label === col.groupLabel) {
      last.span += 1;
    } else {
      groups.push({ label: col.groupLabel, span: 1 });
    }
  }
  return groups;
}

/**
 * Calcula a posição (offset em número de colunas) e a largura (em número de colunas)
 * de uma barra que vai de startDate a endDate, dado o array de colunas da timeline.
 */
export function computeBarPosition(columns, startDate, endDate) {
  const s = toDate(startDate);
  const e = toDate(endDate) || s;
  if (!s || columns.length === 0) return null;

  const effectiveEnd = e && e.getTime() >= s.getTime() ? e : s;

  let startIndex = columns.findIndex((c) => effectiveStart(s) < c.end.getTime());
  if (startIndex === -1) startIndex = s.getTime() < columns[0].start.getTime() ? 0 : columns.length - 1;

  let endIndex = -1;
  for (let i = columns.length - 1; i >= 0; i -= 1) {
    if (columns[i].start.getTime() <= effectiveEnd.getTime()) {
      endIndex = i;
      break;
    }
  }
  if (endIndex === -1) endIndex = startIndex;
  if (endIndex < startIndex) endIndex = startIndex;

  return {
    offset: startIndex,
    span: endIndex - startIndex + 1,
  };
}

function effectiveStart(d) {
  return d.getTime();
}

export function safeDate(value) {
  return toDate(value);
}

export function findMinMaxDates(items, startField, endField) {
  let min = null;
  let max = null;
  for (const item of items) {
    const s = toDate(item[startField]);
    const e = toDate(item[endField]) || s;
    if (s && (!min || s.getTime() < min.getTime())) min = s;
    if (e && (!max || e.getTime() > max.getTime())) max = e;
  }
  return { min, max };
}

export function todayColumnIndex(columns) {
  const now = new Date();
  return columns.findIndex((c) => now.getTime() >= c.start.getTime() && now.getTime() < c.end.getTime());
}

/**
 * Calcula o offset em pixels da linha "hoje" dentro da track da timeline.
 * Retorna null se "hoje" estiver fora do range das colunas.
 */
export function todayPixelOffset(columns, colWidth) {
  if (!columns.length) return null;
  const now = new Date();
  const firstStart = columns[0].start.getTime();
  const lastEnd = columns[columns.length - 1].end.getTime();
  if (now.getTime() < firstStart || now.getTime() > lastEnd) return null;

  const todayIdx = columns.findIndex(
    (c) => now.getTime() >= c.start.getTime() && now.getTime() < c.end.getTime()
  );
  if (todayIdx === -1) return null;

  const col = columns[todayIdx];
  const colDuration = col.end.getTime() - col.start.getTime();
  const elapsed = now.getTime() - col.start.getTime();
  const frac = colDuration > 0 ? elapsed / colDuration : 0;

  return todayIdx * colWidth + frac * colWidth;
}
