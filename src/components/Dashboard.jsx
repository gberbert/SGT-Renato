import React, { useState, useEffect } from 'react';
import { subscribeToTickets } from '../services/ticketService';
import { Loader2, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

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
      <div className="view-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Loader2 className="spinner-icon" size={40} color="var(--primary)" />
      </div>
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
    <div className="view-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div className="welcome-banner" style={{ marginBottom: 0 }}>
        <h1>Visão Geral do Projeto</h1>
        <p>Métricas em tempo real alimentadas pelo Firestore.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
            <TrendingUp size={20} />
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-muted)' }}>Em Andamento</h3>
          </div>
          <div className="value">{inProgressCount}</div>
        </div>
        
        <div className="stat-card glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
            <AlertCircle size={20} />
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-muted)' }}>Críticos Pendentes</h3>
          </div>
          <div className="value danger">{priorityCounts['Crítica']}</div>
        </div>
        
        <div className="stat-card glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)' }}>
            <CheckCircle size={20} />
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-muted)' }}>Concluídos (Total)</h3>
          </div>
          <div className="value success">{doneCount}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        
        {/* Gráfico de Distribuição por Status */}
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
          <h3 style={{ marginBottom: '24px', color: 'var(--text-main)', fontSize: '1.1rem' }}>Distribuição de Status</h3>
          {tickets.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Nenhum ticket encontrado.</p>
          ) : (
            <div style={{ height: '300px', width: '100%' }}>
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
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap', marginTop: '16px' }}>
                {pieData.map((entry, index) => (
                  <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: COLORS[index % COLORS.length] }}></div>
                    {entry.name} ({entry.value})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Gráfico de Prioridades */}
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
          <h3 style={{ marginBottom: '24px', color: 'var(--text-main)', fontSize: '1.1rem' }}>Tickets por Prioridade</h3>
          {tickets.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Nenhum ticket encontrado.</p>
          ) : (
            <div style={{ height: '300px', width: '100%' }}>
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
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
