import React, { useState } from 'react';
import CapacityPlanning from './CapacityPlanning';
import PlanejamentoCiclo from './PlanejamentoCiclo';

const TABS = [
  { id: 'capacidade', label: 'Capacidade' },
  { id: 'ciclos', label: 'Ciclos' },
];

export default function PlanejamentoLayout({ userRole }) {
  const [activeTab, setActiveTab] = useState('capacidade');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '12px 24px 0',
        borderBottom: '1px solid var(--gray-4)',
        background: 'var(--color-background)',
        flexShrink: 0,
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 20px',
              fontSize: 14,
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? 'var(--accent-9)' : 'var(--gray-10)',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-9)' : '2px solid transparent',
              borderRadius: 0,
              cursor: 'pointer',
              marginBottom: -1,
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'capacidade' && <CapacityPlanning userRole={userRole} />}
        {activeTab === 'ciclos' && <PlanejamentoCiclo />}
      </div>
    </div>
  );
}
