import React, { useState, useEffect } from 'react';
import { subscribeToTickets } from '../services/ticketService';
import { Loader2 } from 'lucide-react';
import { Text, Box, Flex } from '@radix-ui/themes';
import { Gantt, ViewMode } from 'gantt-task-react';
import "gantt-task-react/dist/index.css";

const Roadmap = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(ViewMode.Day);

  useEffect(() => {
    const unsubscribe = subscribeToTickets((data) => {
      setTickets(data);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <Flex align="center" justify="center" style={{ height: '100%' }}>
        <Loader2 className="spinner-icon" size={40} color="var(--primary)" />
      </Flex>
    );
  }

  // Transform tickets into Gantt Task format
  const tasks = tickets.map(t => {
    const start = t.startDate ? new Date(t.startDate) : new Date();
    const end = t.deadline ? new Date(t.deadline) : new Date(start.getTime() + 24 * 60 * 60 * 1000); // Defaults to 1 day duration
    
    // Determine progress based on column
    let progress = 0;
    if (t.columnId === 'col-todo') progress = 10;
    if (t.columnId === 'col-in-progress') progress = 50;
    if (t.columnId === 'col-review') progress = 90;
    if (t.columnId === 'col-done') progress = 100;

    return {
      start,
      end,
      name: t.title,
      id: t.id,
      type: 'task',
      progress,
      isDisabled: true, // For now, read-only Gantt
      styles: { progressColor: 'var(--primary)', progressSelectedColor: 'var(--primary-hover)' }
    };
  });

  return (
    <Box p="6" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Flex justify="between" align="center" mb="5">
        <Box>
          <Text as="h1" size="6" weight="bold">Roadmap (Gantt)</Text>
          <Text as="p" size="3" color="gray">Visão temporal e planejamento de entregas do projeto.</Text>
        </Box>
        <Flex gap="2">
          <select 
            value={viewMode} 
            onChange={(e) => setViewMode(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--glass-border)' }}
          >
            <option value={ViewMode.Day}>Diário</option>
            <option value={ViewMode.Week}>Semanal</option>
            <option value={ViewMode.Month}>Mensal</option>
          </select>
        </Flex>
      </Flex>

      <Box style={{ flexGrow: 1, background: 'var(--bg-surface)', borderRadius: '12px', padding: '16px', overflowX: 'auto', border: '1px solid var(--glass-border)' }}>
        {tasks.length > 0 ? (
          <Gantt
            tasks={tasks}
            viewMode={viewMode}
            listCellWidth={155}
            columnWidth={60}
            rowHeight={50}
            barCornerRadius={6}
            barFill={60}
          />
        ) : (
          <Flex justify="center" align="center" style={{ height: '100%' }}>
            <Text color="gray">Nenhum ticket com data definida para exibir no Roadmap.</Text>
          </Flex>
        )}
      </Box>
    </Box>
  );
};

export default Roadmap;
