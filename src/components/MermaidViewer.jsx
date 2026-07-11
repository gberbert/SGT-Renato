import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { Box } from '@radix-ui/themes';

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    fontFamily: 'Inter, sans-serif',
    primaryColor: '#e0e7ff',
    primaryTextColor: '#3730a3',
    primaryBorderColor: '#6366f1',
    lineColor: '#6366f1',
    secondaryColor: '#f3e8ff',
    tertiaryColor: '#fff',
    noteBkgColor: '#fef3c7',
    noteTextColor: '#92400e',
    noteBorderColor: '#f59e0b',
  },
  securityLevel: 'loose',
});

export default function MermaidViewer({ chart }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current && chart) {
      mermaid.render(`mermaid-${Math.random().toString(36).substring(2)}`, chart)
        .then((result) => {
          containerRef.current.innerHTML = result.svg;
        })
        .catch(err => {
          console.error('Mermaid render error:', err);
          containerRef.current.innerHTML = `<p style="color: red;">Erro ao renderizar diagrama.</p>`;
        });
    }
  }, [chart]);

  return (
    <Box 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        overflowX: 'auto',
        display: 'flex',
        justifyContent: 'center',
        padding: '24px 0',
        backgroundColor: 'var(--gray-2)',
        borderRadius: '8px'
      }} 
    />
  );
}
