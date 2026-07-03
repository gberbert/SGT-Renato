import React, { useState, useEffect } from 'react';
import { subscribeToTickets } from '../services/ticketService';
import { subscribeToProjects } from '../services/projectService';
import { Loader2, Printer } from 'lucide-react';
import { Text, Box, Flex, Button, Select } from '@radix-ui/themes';
import { Gantt, ViewMode } from 'gantt-task-react';
import "gantt-task-react/dist/index.css";

const Roadmap = () => {
  const [tickets, setTickets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(ViewMode.Day);

  useEffect(() => {
    let ticketsLoaded = false;
    let projLoaded = false;
    
    const unsubscribeTickets = subscribeToTickets((data) => {
      setTickets(data);
      ticketsLoaded = true;
      if (projLoaded) setLoading(false);
    }, (err) => {
      console.error(err);
      ticketsLoaded = true;
      if (projLoaded) setLoading(false);
    });

    const unsubscribeProjects = subscribeToProjects((data) => {
      setProjects(data);
      if (data.length > 0) {
        setSelectedProjectId(data[0].id);
      }
      projLoaded = true;
      if (ticketsLoaded) setLoading(false);
    });

    return () => {
      unsubscribeTickets();
      unsubscribeProjects();
    };
  }, []);

  if (loading) {
    return (
      <Flex align="center" justify="center" style={{ height: '100%' }}>
        <Loader2 className="spinner-icon" size={40} color="var(--primary)" />
      </Flex>
    );
  }

  // Transform tickets into Gantt Task format
  const filteredTickets = selectedProjectId === 'all' 
    ? tickets 
    : tickets.filter(t => t.projectId === selectedProjectId);

  // Filter tickets that actually have dates defined
  const ticketsWithDates = filteredTickets.filter(t => t.startDate && t.deadline);

  const tasks = ticketsWithDates.map(t => {
    const start = new Date(t.startDate);
    const end = new Date(t.deadline); 
    
    // Ensure end date is at least the same as start date for the chart
    if (end < start) {
      end.setTime(start.getTime() + 24 * 60 * 60 * 1000);
    }
    
    // Determine progress based on column
    let progress = 0;
    if (t.columnId === 'col-todo') progress = 10;
    if (t.columnId === 'col-in-progress') progress = 50;
    if (t.columnId === 'col-review') progress = 90;
    if (t.columnId === 'col-done') progress = 100;

    const dependencies = [];
    if (t.dependsOn) {
      // Find the ticket ID that matches the dependsOn code (e.g. SGT-5)
      const depTicket = tickets.find(ticket => ticket.code === t.dependsOn.trim());
      if (depTicket) {
        dependencies.push(depTicket.id);
      }
    }

    return {
      start,
      end,
      name: t.title,
      id: t.id,
      type: 'task',
      progress,
      dependencies,
      isDisabled: true, // For now, read-only Gantt
      styles: { progressColor: 'var(--primary)', progressSelectedColor: 'var(--primary-hover)' }
    };
  });

  return (
    <Box p="6" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Flex justify="between" align="center" mb="5" wrap="wrap" gap="4">
        <Flex align="center" gap="4">
          <Box>
            <Text as="h1" size="6" weight="bold">Roadmap (Gantt)</Text>
            <Text as="p" size="3" color="gray">Visão temporal e planejamento de entregas do projeto.</Text>
          </Box>
          <Select.Root value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <Select.Trigger style={{ width: '250px' }} />
            <Select.Content>
              <Select.Item value="all">Ver Todos os Projetos</Select.Item>
              {projects.map(p => (
                <Select.Item key={p.id} value={p.id}>{p.name}</Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Flex>
        
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
          <Button variant="soft" onClick={() => window.print()}>
            <Printer size={16} /> Exportar
          </Button>
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
