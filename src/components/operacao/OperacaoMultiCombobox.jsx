import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Flex, Text, Checkbox, TextField } from '@radix-ui/themes';
import { ChevronDown, Search } from 'lucide-react';

const OperacaoMultiCombobox = ({
  label,
  placeholder,
  options = [],
  selected,
  onChange,
  formatOption = (item) => item.nome || item.label || item.id,
  formatMeta,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const rootRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const onDocClick = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (open) {
      setSearchQuery('');
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  const selectedCount = selected?.size || 0;
  const displayValue =
    selectedCount === 0
      ? placeholder
      : selectedCount === 1
        ? formatOption(options.find((o) => selected.has(o.id)) || { id: [...selected][0] })
        : `${selectedCount} selecionado(s)`;

  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return options;
    return options.filter((item) => {
      const labelText = formatOption(item).toLowerCase();
      const metaText = formatMeta ? formatMeta(item).toLowerCase() : '';
      return labelText.includes(query) || metaText.includes(query);
    });
  }, [options, searchQuery, formatOption, formatMeta]);

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const allFilteredIds = filteredOptions.map((o) => o.id);
  const allFilteredSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selected.has(id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      // deselect all filtered
      const next = new Set(selected);
      allFilteredIds.forEach((id) => next.delete(id));
      onChange(next);
    } else {
      // select all filtered
      const next = new Set(selected);
      allFilteredIds.forEach((id) => next.add(id));
      onChange(next);
    }
  };

  return (
    <Box ref={rootRef} className="operacao-combobox" style={{ position: 'relative', flex: 1, minWidth: 200 }}>
      <Text size="1" weight="bold" color="gray" mb="1" style={{ letterSpacing: '0.06em' }}>
        {label}
      </Text>
      <button
        type="button"
        className="operacao-combobox-trigger"
        onClick={() => !disabled && setOpen((v) => !v)}
        aria-expanded={open}
        disabled={disabled}
      >
        <span>{displayValue}</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <Box className="operacao-combobox-panel">
          <Box className="operacao-combobox-search">
            <TextField.Root
              ref={searchRef}
              size="2"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <TextField.Slot>
                <Search size={14} />
              </TextField.Slot>
            </TextField.Root>
          </Box>
          {options.length === 0 ? (
            <Text size="2" color="gray" p="2">
              Nenhuma opção disponível.
            </Text>
          ) : filteredOptions.length === 0 ? (
            <Text size="2" color="gray" p="2">
              Nenhum resultado para &quot;{searchQuery.trim()}&quot;.
            </Text>
          ) : (
            <>
              {filteredOptions.length > 1 && (
                <label
                  className="operacao-combobox-item operacao-combobox-item-selectall"
                  style={{ borderBottom: '1px solid var(--glass-border)', marginBottom: 2, paddingBottom: 6 }}
                >
                  <Checkbox
                    checked={allFilteredSelected}
                    onCheckedChange={toggleSelectAll}
                  />
                  <Text size="2" weight="bold" color="gray">
                    {allFilteredSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                    {searchQuery.trim() ? ` (${filteredOptions.length})` : ''}
                  </Text>
                </label>
              )}
            {filteredOptions.map((item) => (
              <label key={item.id} className="operacao-combobox-item">
                <Checkbox
                  checked={selected.has(item.id)}
                  onCheckedChange={() => toggle(item.id)}
                />
                <Flex direction="column" gap="0">
                  <Text size="2">{formatOption(item)}</Text>
                  {formatMeta && (
                    <Text size="1" color="gray">{formatMeta(item)}</Text>
                  )}
                </Flex>
              </label>
            ))}
            </>
          )}
        </Box>
      )}
    </Box>
  );
};

export default OperacaoMultiCombobox;
