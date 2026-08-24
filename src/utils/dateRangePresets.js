export const PERIOD_OPTIONS = [
  { value: 'dia', label: 'Dia' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mês' },
  { value: 'trimestre', label: 'Trimestre (3 meses corridos)' },
  { value: 'quarter', label: 'Quarter (trimestre civil)' },
  { value: 'semestre', label: 'Semestre' },
  { value: 'ano', label: 'Ano' },
  { value: 'personalizado', label: 'Personalizado' },
];

function toStartOfDay(d) {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
}

function toEndOfDay(d) {
  const next = new Date(d);
  next.setHours(23, 59, 59, 999);
  return next;
}

function parseRefDate(refDateStr) {
  if (!refDateStr) return new Date();
  const parsed = new Date(`${refDateStr}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function toIsoDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Calcula { start, end } (objetos Date) a partir de um tipo de período fixo
 * e uma data de referência (string YYYY-MM-DD). Retorna null para 'personalizado'
 * — nesse caso o start/end devem ser fornecidos manualmente pelo usuário.
 */
export function computePeriodRange(periodType, refDateStr) {
  if (!periodType || periodType === 'personalizado') return null;

  const ref = parseRefDate(refDateStr);
  let start;
  let end;

  switch (periodType) {
    case 'dia': {
      start = toStartOfDay(ref);
      end = toEndOfDay(ref);
      break;
    }
    case 'semana': {
      const day = ref.getDay(); // 0 = domingo
      const diffToMonday = day === 0 ? -6 : 1 - day;
      start = toStartOfDay(new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + diffToMonday));
      end = toEndOfDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6));
      break;
    }
    case 'mes': {
      start = toStartOfDay(new Date(ref.getFullYear(), ref.getMonth(), 1));
      end = toEndOfDay(new Date(ref.getFullYear(), ref.getMonth() + 1, 0));
      break;
    }
    case 'trimestre': {
      // 3 meses corridos terminando no mês de referência
      start = toStartOfDay(new Date(ref.getFullYear(), ref.getMonth() - 2, 1));
      end = toEndOfDay(new Date(ref.getFullYear(), ref.getMonth() + 1, 0));
      break;
    }
    case 'quarter': {
      // trimestre civil alinhado (Jan-Mar, Abr-Jun, Jul-Set, Out-Dez)
      const q = Math.floor(ref.getMonth() / 3);
      start = toStartOfDay(new Date(ref.getFullYear(), q * 3, 1));
      end = toEndOfDay(new Date(ref.getFullYear(), q * 3 + 3, 0));
      break;
    }
    case 'semestre': {
      const half = ref.getMonth() < 6 ? 0 : 6;
      start = toStartOfDay(new Date(ref.getFullYear(), half, 1));
      end = toEndOfDay(new Date(ref.getFullYear(), half + 6, 0));
      break;
    }
    case 'ano': {
      start = toStartOfDay(new Date(ref.getFullYear(), 0, 1));
      end = toEndOfDay(new Date(ref.getFullYear(), 11, 31));
      break;
    }
    default:
      return null;
  }

  return {
    start,
    end,
    startIso: toIsoDate(start),
    endIso: toIsoDate(end),
  };
}

export function formatRangeLabel(range) {
  if (!range?.start || !range?.end) return '';
  const fmt = (d) => d.toLocaleDateString('pt-BR');
  return `${fmt(range.start)} — ${fmt(range.end)}`;
}
