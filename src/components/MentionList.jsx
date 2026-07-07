import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Box, Text } from '@radix-ui/themes';

export default forwardRef((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = index => {
    const item = props.items[index];

    if (item) {
      props.command({ id: item.id, label: item.shortName || item.displayName || item.email });
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }

      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }

      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  if (!props.items || props.items.length === 0) {
    return (
      <Box style={{
        background: 'var(--color-panel-solid)',
        border: '1px solid var(--gray-6)',
        borderRadius: 'var(--radius-3)',
        boxShadow: 'var(--shadow-4)',
        padding: '8px 12px',
      }}>
        <Text size="2" color="gray">Nenhum usuário encontrado</Text>
      </Box>
    );
  }

  return (
    <Box style={{
      background: 'var(--color-panel-solid)',
      border: '1px solid var(--gray-6)',
      borderRadius: 'var(--radius-3)',
      boxShadow: 'var(--shadow-4)',
      overflow: 'hidden',
      padding: '4px',
      minWidth: '200px'
    }}>
      {props.items.map((item, index) => (
        <Box
          key={item.id}
          onMouseEnter={() => setSelectedIndex(index)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => selectItem(index)}
          style={{
            padding: '8px 12px',
            cursor: 'pointer',
            borderRadius: 'var(--radius-2)',
            backgroundColor: index === selectedIndex ? 'var(--accent-4)' : 'transparent',
            color: index === selectedIndex ? 'var(--accent-11)' : 'var(--gray-12)',
          }}
        >
          <Text size="2" weight={index === selectedIndex ? "bold" : "regular"}>
            {item.shortName || item.displayName || item.email}
          </Text>
        </Box>
      ))}
    </Box>
  );
});
