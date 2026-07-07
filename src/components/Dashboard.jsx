import React, { useState, useEffect } from 'react';
import { subscribeToTickets } from '../services/ticketService';
import { Loader2, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area, LineChart, Line, Legend } from 'recharts';
import { Box, Flex, Text, Grid, Card } from '@radix-ui/themes';

const Dashboard = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

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

  // Agrupamentos e Métricas
  const inProgressCount = tickets.filter(t => t.columnId === 'col-in-progress').length;
  const doneCount = tickets.filter(t => t.columnId === 'col-done').length;
  
  // Gráfico 1: Status Distribution
  const statusCounts = {
    'Backlog': tickets.filter(t => t.columnId === 'col-backlog').length,
    'A Fazer': tickets.filter(t => t.columnId === 'col-todo').length,
    'Em Andamento': inProgressCount,
    'Em Validação': tickets.filter(t => t.columnId === 'col-validation').length,
    'Concluído': doneCount,
  };

  const pieData = Object.keys(statusCounts)
    .filter(key => statusCounts[key] > 0)
    .map(key => ({
      name: key,
      value: statusCounts[key]
    }));

  const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#10b981'];

  // Gráfico 2: Prioridades
  const priorityCounts = {
    'Baixa': tickets.filter(t => t.priority === 'low').length,
    'Média': tickets.filter(t => t.priority === 'medium').length,
    'Alta': tickets.filter(t => t.priority === 'high').length,
    'Crítica': tickets.filter(t => t.priority === 'critical').length,
  };

  const barData = Object.keys(priorityCounts).map(key => ({
    name: key,
    Quantidade: priorityCounts[key]
  }));

  // MOCK DATA: Cumulative Flow Diagram (CFD)
  const cfdData = [
    { name: 'Seg', Backlog: 20, Andamento: 5, Concluido: 10 },
    { name: 'Ter', Backlog: 18, Andamento: 7, Concluido: 12 },
    { name: 'Qua', Backlog: 15, Andamento: 8, Concluido: 15 },
    { name: 'Qui', Backlog: 10, Andamento: 10, Concluido: 20 },
    { name: 'Sex', Backlog: 5, Andamento: 6, Concluido: 28 },
    { name: 'Sab', Backlog: 5, Andamento: 4, Concluido: 30 },
    { name: 'Dom', Backlog: 5, Andamento: 2, Concluido: 32 },
  ];

  // MOCK DATA: Burndown Chart (Sprint Atual)
  const burndownData = [
    { day: 'Dia 1', Ideal: 50, Real: 50 },
    { day: 'Dia 2', Ideal: 45, Real: 48 },
    { day: 'Dia 3', Ideal: 40, Real: 42 },
    { day: 'Dia 4', Ideal: 35, Real: 38 },
    { day: 'Dia 5', Ideal: 30, Real: 30 },
    { day: 'Dia 6', Ideal: 25, Real: 28 },
    { day: 'Dia 7', Ideal: 20, Real: 22 },
    { day: 'Dia 8', Ideal: 15, Real: null },
    { day: 'Dia 9', Ideal: 10, Real: null },
    { day: 'Dia 10', Ideal: 0, Real: null },
  ];

  return (
    <Box p="6" style={{ height: '100%', overflowY: 'auto' }}>
      
      <Box mb="6">
        <Text as="h1" size="6" weight="bold">Visão Geral do Projeto</Text>
        <Text as="p" size="3" color="gray">Métricas em tempo real alimentadas pelo Firestore.</Text>
      </Box>

      <Grid columns={{ initial: '1', sm: '3' }} gap="4" mb="6">
        <Card size="2">
          <Flex direction="column" gap="2">
            <Flex align="center" gap="2" style={{ color: 'var(--primary)' }}>
              <TrendingUp size={20} />
              <Text weight="medium" color="gray">Em Andamento</Text>
            </Flex>
            <Text size="8" weight="bold">{inProgressCount}</Text>
          </Flex>
        </Card>
        
        <Card size="2">
          <Flex direction="column" gap="2">
            <Flex align="center" gap="2" style={{ color: 'var(--danger)' }}>
              <AlertCircle size={20} />
              <Text weight="medium" color="gray">Críticos Pendentes</Text>
            </Flex>
            <Text size="8" weight="bold" style={{ color: 'var(--danger)' }}>{priorityCounts['Crítica'] || 0}</Text>
          </Flex>
        </Card>
        
        <Card size="2">
          <Flex direction="column" gap="2">
            <Flex align="center" gap="2" style={{ color: 'var(--success)' }}>
              <CheckCircle size={20} />
              <Text weight="medium" color="gray">Concluídos (Total)</Text>
            </Flex>
            <Text size="8" weight="bold" style={{ color: 'var(--success)' }}>{doneCount}</Text>
          </Flex>
        </Card>
      </Grid>

      <Grid columns={{ initial: '1', md: '2' }} gap="4">
        
        {/* Gráfico de Distribuição por Status */}
        <Card size="3">
          <Text as="div" size="4" weight="bold" mb="4">Distribuição de Status</Text>
          {tickets.length === 0 ? (
            <Text color="gray" align="center" as="div">Nenhum ticket encontrado.</Text>
          ) : (
            <Box style={{ height: '300px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--glass-border)', borderRadius: '8px' }}
                    itemStyle={{ color: 'var(--text-main)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <Flex justify="center" gap="4" wrap="wrap" mt="4">
                {pieData.map((entry, index) => (
                  <Flex key={entry.name} align="center" gap="2">
                    <Box style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: COLORS[index % COLORS.length] }} />
                    <Text size="2" color="gray">{entry.name} ({entry.value})</Text>
                  </Flex>
                ))}
              </Flex>
            </Box>
          )}
        </Card>

        {/* Gráfico de Prioridades */}
        <Card size="3">
          <Text as="div" size="4" weight="bold" mb="4">Tickets por Prioridade</Text>
          {tickets.length === 0 ? (
            <Text color="gray" align="center" as="div">Nenhum ticket encontrado.</Text>
          ) : (
            <Box style={{ height: '300px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <RechartsTooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                    contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-main)' }}
                  />
                  <Bar dataKey="Quantidade" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          )}
        </Card>

        {/* Cumulative Flow Diagram */}
        <Card size="3" style={{ gridColumn: '1 / -1' }}>
          <Text as="div" size="4" weight="bold" mb="4">Cumulative Flow Diagram (CFD)</Text>
          <Box style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cfdData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-main)' }} />
                <Legend />
                <Area type="monotone" dataKey="Concluido" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                <Area type="monotone" dataKey="Andamento" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                <Area type="monotone" dataKey="Backlog" stackId="1" stroke="#6366f1" fill="#6366f1" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </Card>

        {/* Burndown Chart */}
        <Card size="3" style={{ gridColumn: '1 / -1' }}>
          <Text as="div" size="4" weight="bold" mb="4">Burndown da Sprint (Story Points)</Text>
          <Box style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={burndownData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-main)' }} />
                <Legend />
                <Line type="monotone" dataKey="Ideal" stroke="var(--gray-8)" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Real" stroke="var(--danger)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Card>

      </Grid>
    </Box>
  );
};

export default Dashboard;
