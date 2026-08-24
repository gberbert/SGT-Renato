import React, { useEffect, useMemo, useState } from 'react';
import { Box, Flex, Text, Select, TextField } from '@radix-ui/themes';
import { Calendar, XCircle } from 'lucide-react';
import { PERIOD_OPTIONS, computePeriodRange, formatRangeLabel } from '../../utils/dateRangePresets';

/**
 * Filtro de intervalo de datas reutilizável.
 * value: { periodType, refDate, start, end } (start/end são strings ISO 'YYYY-MM-DD')
 * onChange(value)
 */
const OperacaoDateRangeFilter = ({ label, value, onChange, disabled }) => {
  const periodType = value?.periodType || '';
  const refDate = value?.refDate || '';
  const [customStart, setCustomStart] = useState(value?.start || '');
  const [customEnd, setCustomEnd] = useState(value?.end || '');

  useEffect(() => {
    setCustomStart(value?.start || '');
    setCustomEnd(value?.end || '');
  }, [value?.start, value?.end]);

  const computedRange = useMemo(() => {
    if (!periodType || periodType === 'personalizado') return null;
    return computePeriodRange(periodType, refDate || undefined);
  }, [periodType, refDate]);

  const isCustom = periodType === 'personalizado';
  const activeRangeLabel = isCustom
    ? customStart && customEnd
      ? `${new Date(`${customStart}T00:00:00`).toLocaleDateString('pt-BR')} — ${new Date(`${customEnd}T00:00:00`).toLocaleDateString('pt-BR')}`
      : ''
    : computedRange
      ? formatRangeLabel(computedRange)
      : '';

  const emitChange = (nextPartial) => {
    const next = { periodType, refDate, start: customStart, end: customEnd, ...nextPartial };

    if (next.periodType && next.periodType !== 'personalizado') {
      const range = computePeriodRange(next.periodType, next.refDate || undefined);
      onChange({
        periodType: next.periodType,
        refDate: next.refDate,
        start: range?.startIso || '',
        end: range?.endIso || '',
      });
      return;
    }

    onChange(next);
  };

  const handlePeriodChange = (nextType) => {
    if (!nextType) {
      onChange({ periodType: '', refDate: '', start: '', end: '' });
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const nextRefDate = refDate || today;
    emitChange({ periodType: nextType, refDate: nextRefDate });
  };

  const handleRefDateChange = (nextRefDate) => {
    emitChange({ refDate: nextRefDate });
  };

  const handleClear = () => {
    setCustomStart('');
    setCustomEnd('');
    onChange({ periodType: '', refDate: '', start: '', end: '' });
  };

  return (
    <Box className="operacao-date-range-filter" style={{ flex: 1, minWidth: 260 }}>
      <Flex align="center" justify="between" mb="1">
        <Text size="1" weight="bold" color="gray" style={{ letterSpacing: '0.06em' }}>
          {label}
        </Text>
        {periodType && (
          <button
            type="button"
            className="operacao-date-range-clear"
            onClick={handleClear}
            title="Limpar filtro de data"
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--gray-9)' }}
          >
            <XCircle size={14} />
          </button>
        )}
      </Flex>

      <Flex direction="column" gap="2">
        <Select.Root
          value={periodType || 'none'}
          onValueChange={(v) => handlePeriodChange(v === 'none' ? '' : v)}
          disabled={disabled}
        >
          <Select.Trigger placeholder="Sem filtro" style={{ width: '100%' }} />
          <Select.Content>
            <Select.Item value="none">Sem filtro</Select.Item>
            {PERIOD_OPTIONS.map((opt) => (
              <Select.Item key={opt.value} value={opt.value}>
                {opt.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>

        {periodType && !isCustom && (
          <Flex align="center" gap="2">
            <Calendar size={14} style={{ opacity: 0.6 }} />
            <input
              type="date"
              value={refDate}
              disabled={disabled}
              onChange={(e) => handleRefDateChange(e.target.value)}
              style={{
                flex: 1,
                height: 32,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text)',
                padding: '0 8px',
              }}
            />
          </Flex>
        )}

        {isCustom && (
          <Flex align="center" gap="2">
            <input
              type="date"
              value={customStart}
              disabled={disabled}
              onChange={(e) => {
                setCustomStart(e.target.value);
                emitChange({ start: e.target.value, end: customEnd });
              }}
              style={{
                flex: 1,
                height: 32,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text)',
                padding: '0 8px',
              }}
            />
            <Text size="1" color="gray">até</Text>
            <input
              type="date"
              value={customEnd}
              disabled={disabled}
              onChange={(e) => {
                setCustomEnd(e.target.value);
                emitChange({ start: customStart, end: e.target.value });
              }}
              style={{
                flex: 1,
                height: 32,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text)',
                padding: '0 8px',
              }}
            />
          </Flex>
        )}

        {activeRangeLabel && (
          <Text size="1" color="indigo">
            {activeRangeLabel}
          </Text>
        )}
      </Flex>
    </Box>
  );
};

export default OperacaoDateRangeFilter;
