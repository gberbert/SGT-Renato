import React, { useState, useEffect } from 'react';
import { subscribeToTickets } from '../services/ticketService';
import { Loader2, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
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

      </Grid>
    </Box>
  );
};

export default Dashboard;
