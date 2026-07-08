import React, { useState, useEffect } from 'react';
import { subscribeToTickets } from '../services/ticketService';
import { subscribeToProjects } from '../services/projectService';
import { Loader2, Printer, Save, Filter, LayoutList } from 'lucide-react';
import { Text, Box, Flex, Button, Select, TextField, IconButton, Badge, Card, Popover } from '@radix-ui/themes';
import Gantt from 'frappe-gantt';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import "./Roadmap.css";

const Roadmap = () => {
  const [tickets, setTickets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('Day');
  
  // Filters & Grouping State
  const [filters, setFilters] = useState({
    project: 'all',
    system: 'all',
    assignee: 'all',
    status: 'all'
  });
  const [groupBy, setGroupBy] = useState('none'); // none, system, status, assignee

  // Saved Views
  const [savedViews, setSavedViews] = useState([]);
  const [newViewName, setNewViewName] = useState('');

  // Holidays
  const [holidays, setHolidays] = useState([]);
  const [localHolidays, setLocalHolidays] = useState({ estaduais: [], municipais: [] });

  // Load Saved Views from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('sgt_roadmap_views');
    if (saved) {
      try {
        setSavedViews(JSON.parse(saved));
      } catch (e) {
        console.error("Erro ao carregar views do localstorage", e);
      }
    }
  }, []);

  // Fetch National Holidays
  useEffect(() => {
    const year = new Date().getFullYear();
    fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`)
      .then(res => res.json())
      .then(data => setHolidays(data || []))
      .catch(err => console.error("Erro ao buscar feriados nacionais:", err));
  }, []);

  // Fetch Local Holidays based on selected project filter
  useEffect(() => {
    const fetchLocal = async () => {
      try {
        const snap = await getDocs(collection(db, 'holidays'));
        const allHolidays = snap.docs.map(d => d.data());
        
        let targetMunicipios = [];
        if (filters.project && filters.project !== 'all') {
          const proj = projects.find(p => p.id === filters.project);
          if (proj && proj.municipio) targetMunicipios.push(proj.municipio);
        } else {
          targetMunicipios = [...new Set(projects.map(p => p.municipio).filter(Boolean))];
        }

        let estaduais = [];
        let municipais = [];

        allHolidays.forEach(h => {
          if (targetMunicipios.includes(h.nome)) {
            estaduais = [...estaduais, ...(h.feriados_estaduais || [])];
            municipais = [...municipais, ...(h.feriados_municipais || [])];
          }
        });

        setLocalHolidays({
          estaduais: [...new Set(estaduais)],
          municipais: [...new Set(municipais)]
        });
      } catch (e) {
        console.error("Erro ao buscar feriados locais:", e);
        setLocalHolidays({ estaduais: [], municipais: [] });
      }
    };
    fetchLocal();
  }, [filters.project, projects]);

  // Fetch data
  useEffect(() => {
    let ticketsLoaded = false;
    let projLoaded = false;
    
    const unsubscribeTickets = subscribeToTickets((data) => {
      setTickets(data);
      ticketsLoaded = true;
      if (projLoaded) setLoading(false);
    }, (err) => {
      ticketsLoaded = true;
      if (projLoaded) setLoading(false);
    });

    const unsubscribeProjects = subscribeToProjects((data) => {
      setProjects(data);
      projLoaded = true;
      if (ticketsLoaded) setLoading(false);
    });

    return () => {
      unsubscribeTickets();
      unsubscribeProjects();
    };
  }, []);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const saveCurrentView = () => {
    if (!newViewName.trim()) return;
    if (savedViews.length >= 5) {
      alert("Limite máximo de 5 visões alcançado. Remova uma para salvar outra.");
      return;
    }
    const newView = {
      id: Date.now().toString(),
      name: newViewName,
      filters: { ...filters },
      groupBy
    };
    const updatedViews = [...savedViews, newView];
    setSavedViews(updatedViews);
    localStorage.setItem('sgt_roadmap_views', JSON.stringify(updatedViews));
    setNewViewName('');
  };

  const loadView = (view) => {
    setFilters(view.filters);
    setGroupBy(view.groupBy);
  };

  const removeView = (id) => {
    const updatedViews = savedViews.filter(v => v.id !== id);
    setSavedViews(updatedViews);
    localStorage.setItem('sgt_roadmap_views', JSON.stringify(updatedViews));
  };

  // Apply filters
  let processedTickets = tickets.filter(t => t.startDate && t.deadline);
  
  if (filters.project !== 'all') processedTickets = processedTickets.filter(t => t.projectId === filters.project);
  if (filters.system !== 'all') processedTickets = processedTickets.filter(t => t.system === filters.system);
  if (filters.assignee !== 'all') processedTickets = processedTickets.filter(t => (t.assignee || 'Sem responsável') === filters.assignee);
  if (filters.status !== 'all') processedTickets = processedTickets.filter(t => t.columnId === filters.status);

  // Grouping logic (generating Gantt tasks)
  let tasks = [];
  
  if (groupBy !== 'none' && processedTickets.length > 0) {
    const groups = {};
    processedTickets.forEach(t => {
      let groupKey = 'Outros';
      if (groupBy === 'system') groupKey = t.system || 'Sem Sistema';
      if (groupBy === 'status') groupKey = t.columnId || 'Sem Status';
      if (groupBy === 'assignee') groupKey = t.assignee || 'Sem responsável';
      
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(t);
    });

    Object.keys(groups).forEach(key => {
      const groupTickets = groups[key];
      const minDate = new Date(Math.min(...groupTickets.map(t => new Date(t.startDate).getTime())));
      const maxDate = new Date(Math.max(...groupTickets.map(t => new Date(t.deadline).getTime())));
      
      const groupId = `group-${key}`;
      // Add a group wrapper "task" (Frappe doesn't natively do groups, but we style it as one)
      tasks.push({
        start: minDate.toISOString().split('T')[0],
        end: maxDate.toISOString().split('T')[0],
        name: key.replace('col-', '').toUpperCase(),
        id: groupId,
        progress: 0,
        custom_class: 'gantt-group-task'
      });

      // Add children
      groupTickets.forEach(t => {
        let endDate = new Date(t.deadline);
        if (endDate < new Date(t.startDate)) endDate = new Date(new Date(t.startDate).getTime() + 86400000);
        
        let customClass = 'gantt-ticket-task';
        if (t.columnId === 'col-done') customClass += ' status-done';
        if (t.columnId === 'col-in-progress') customClass += ' status-in-progress';

        tasks.push({
          start: new Date(t.startDate).toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
          name: t.title,
          id: t.id,
          progress: t.columnId === 'col-done' ? 100 : (t.columnId === 'col-in-progress' ? 50 : 10),
          custom_class: customClass
        });
      });
    });
  } else {
    // No grouping
    tasks = processedTickets.map(t => {
      let start = new Date(t.startDate);
      let end = new Date(t.deadline); 
      if (end < start) end.setTime(start.getTime() + 86400000);
      
      let customClass = 'gantt-ticket-task';
      if (t.columnId === 'col-done') customClass += ' status-done';
      if (t.columnId === 'col-in-progress') customClass += ' status-in-progress';

      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
        name: t.title,
        id: t.id,
        progress: t.columnId === 'col-done' ? 100 : (t.columnId === 'col-in-progress' ? 50 : 10),
        custom_class: customClass
      };
    });
  }

  // Extract unique values for filters from ALL tickets (to populate dropdowns)
  const uniqueSystems = [...new Set(tickets.map(t => t.system).filter(Boolean))];
  const uniqueAssignees = [...new Set(tickets.map(t => t.assignee).filter(Boolean))];
  const uniqueStatuses = [...new Set(tickets.map(t => t.columnId).filter(Boolean))];

  // Frappe Gantt Instantiation
  useEffect(() => {
    if (tasks.length === 0) return;
    
    // Clear previous gantt if exists
    const container = document.getElementById('frappe-gantt-container');
    if (container) container.innerHTML = '';

    const gantt = new Gantt('#frappe-gantt-container', tasks, {
      view_mode: viewMode,
      language: 'pt',
      custom_popup_html: function(task) {
        return `
          <div class="gantt-popup">
            <h5>${task.name}</h5>
            <p>De: ${task.start}</p>
            <p>Até: ${task.end}</p>
            <p>${task.progress}% concluído</p>
          </div>
        `;
      }
    });

    // Color weekends and holidays in Frappe SVG
    setTimeout(() => {
      if (viewMode !== 'Day') return; // Apenas colore no modo Diário

      const svg = document.querySelector('#frappe-gantt-container svg');
      if (!svg) return;
      const grid = svg.querySelector('.grid');
      if (!grid) return;

      // Clear existing markers to prevent overlapping opacities
      grid.querySelectorAll('.custom-holiday-marker').forEach(el => el.remove());

      const dateNodes = svg.querySelectorAll('.grid-header .lower-text');
      if (!dateNodes || dateNodes.length === 0 || !gantt.gantt_start) return;

      let currentDate = new Date(gantt.gantt_start.getTime());

      // Prepara o Set de feriados para busca rápida YYYY-MM-DD
      const allHolidays = new Set();
      holidays.forEach(h => allHolidays.add(h.date));
      if (localHolidays.estaduais) localHolidays.estaduais.forEach(h => allHolidays.add(h.date));
      if (localHolidays.municipais) localHolidays.municipais.forEach(h => allHolidays.add(h.date));

      dateNodes.forEach((node, i) => {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        const dayOfWeek = currentDate.getDay(); // 0 = Dom, 6 = Sáb
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        const isHoliday = allHolidays.has(dateStr);
        
        if (isWeekend || isHoliday) {
          const x = node.getAttribute('x');
          const colWidth = 38; // Default in frappe for Day view
          
          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('x', String(parseFloat(x) - colWidth/2));
          rect.setAttribute('y', '0');
          rect.setAttribute('width', String(colWidth));
          rect.setAttribute('height', '4000'); 
          rect.setAttribute('class', 'custom-holiday-marker');
          rect.style.pointerEvents = 'none';

          grid.appendChild(rect);
        }

        // Incrementa 1 dia para a próxima coluna
        currentDate.setDate(currentDate.getDate() + 1);
      });
    }, 500);

  }, [tasks, viewMode, holidays, localHolidays]);

  if (loading) {
    return (
      <Flex align="center" justify="center" style={{ height: '100%' }}>
        <Loader2 className="spinner-icon" size={40} color="var(--primary)" />
      </Flex>
    );
  }



  return (
    <Box p="6" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Header */}
      <Flex justify="between" align="start" mb="4" wrap="wrap" gap="4">
        <Box>
          <Text as="h1" size="6" weight="bold">Roadmap (Gantt)</Text>
          <Text as="p" size="3" color="gray">Visão temporal, agrupamentos e filtros de demandas.</Text>
        </Box>
        <Flex gap="2">
          <select 
            value={viewMode} 
            onChange={(e) => setViewMode(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--glass-border)' }}
          >
            <option value="Day">Diário</option>
            <option value="Week">Semanal</option>
            <option value="Month">Mensal</option>
          </select>
          <Button variant="soft" onClick={() => window.print()}>
            <Printer size={16} /> Exportar
          </Button>
        </Flex>
      </Flex>

      {/* Control Panel: Filters, Grouping and Saved Views */}
      <Card size="2" mb="4">
        <Flex justify="between" align="end" wrap="wrap" gap="4">
          
          <Flex gap="4" wrap="wrap" style={{ flex: 1 }}>
            <Popover.Root>
              <Popover.Trigger>
                <Button variant="surface" color="gray">
                  <Filter size={16} /> Filtros e Agrupamento
                </Button>
              </Popover.Trigger>
              <Popover.Content width="300px">
                <Flex direction="column" gap="3">
                  <Text weight="bold" size="3">Filtros Avançados</Text>
                  
                  <label>
                    <Text as="div" size="1" mb="1" weight="bold">Projeto</Text>
                    <Select.Root value={filters.project} onValueChange={(v) => handleFilterChange('project', v)}>
                      <Select.Trigger style={{ width: '100%' }} />
                      <Select.Content>
                        <Select.Item value="all">Todos</Select.Item>
                        {projects.map(p => <Select.Item key={p.id} value={p.id}>{p.name}</Select.Item>)}
                      </Select.Content>
                    </Select.Root>
                  </label>

                  <label>
                    <Text as="div" size="1" mb="1" weight="bold">Sistema</Text>
                    <Select.Root value={filters.system} onValueChange={(v) => handleFilterChange('system', v)}>
                      <Select.Trigger style={{ width: '100%' }} />
                      <Select.Content>
                        <Select.Item value="all">Todos</Select.Item>
                        {uniqueSystems.map(s => <Select.Item key={s} value={s}>{s}</Select.Item>)}
                      </Select.Content>
                    </Select.Root>
                  </label>

                  <label>
                    <Text as="div" size="1" mb="1" weight="bold">Status</Text>
                    <Select.Root value={filters.status} onValueChange={(v) => handleFilterChange('status', v)}>
                      <Select.Trigger style={{ width: '100%' }} />
                      <Select.Content>
                        <Select.Item value="all">Todos</Select.Item>
                        {uniqueStatuses.map(s => <Select.Item key={s} value={s}>{s.replace('col-', '')}</Select.Item>)}
                      </Select.Content>
                    </Select.Root>
                  </label>

                  <label>
                    <Text as="div" size="1" mb="1" weight="bold">Responsável</Text>
                    <Select.Root value={filters.assignee} onValueChange={(v) => handleFilterChange('assignee', v)}>
                      <Select.Trigger style={{ width: '100%' }} />
                      <Select.Content>
                        <Select.Item value="all">Todos</Select.Item>
                        {uniqueAssignees.map(a => <Select.Item key={a} value={a}>{a}</Select.Item>)}
                      </Select.Content>
                    </Select.Root>
                  </label>

                  {/* Grouping */}
                  <label>
                    <Text as="div" size="1" mb="1" weight="bold" color="indigo" mt="2">Agrupar por</Text>
                    <Select.Root value={groupBy} onValueChange={setGroupBy}>
                      <Select.Trigger style={{ width: '100%' }} />
                      <Select.Content>
                        <Select.Item value="none">Nenhum</Select.Item>
                        <Select.Item value="system">Sistema</Select.Item>
                        <Select.Item value="status">Status</Select.Item>
                        <Select.Item value="assignee">Responsável</Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </label>
                </Flex>
              </Popover.Content>
            </Popover.Root>
          </Flex>

          {/* Saved Views Popover */}
          <Popover.Root>
            <Popover.Trigger>
              <Button variant="outline">
                <Save size={16} /> Visões Salvas ({savedViews.length}/5)
              </Button>
            </Popover.Trigger>
            <Popover.Content width="300px">
              <Text weight="bold" mb="2" as="div">Salvar Visão Atual</Text>
              <Flex gap="2" mb="4">
                <TextField.Root 
                  placeholder="Nome da visão..." 
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  style={{ flex: 1 }}
                />
                <Button size="1" onClick={saveCurrentView} disabled={!newViewName || savedViews.length >= 5}>Salvar</Button>
              </Flex>
              
              <Text weight="bold" mb="2" as="div">Carregar Visão</Text>
              <Flex direction="column" gap="2">
                {savedViews.map(view => (
                  <Flex key={view.id} justify="between" align="center" style={{ background: 'var(--surface)', padding: '8px', borderRadius: '4px' }}>
                    <Text size="2" style={{ cursor: 'pointer', flex: 1 }} onClick={() => loadView(view)}>{view.name}</Text>
                    <Badge color="red" style={{ cursor: 'pointer' }} onClick={() => removeView(view.id)}>X</Badge>
                  </Flex>
                ))}
                {savedViews.length === 0 && <Text size="1" color="gray">Nenhuma visão salva.</Text>}
              </Flex>
            </Popover.Content>
          </Popover.Root>
        </Flex>
      </Card>

      <Box id="gantt-container" style={{ flexGrow: 1, background: 'var(--bg-surface)', borderRadius: '12px', padding: '16px', overflowX: 'auto', border: '1px solid var(--glass-border)' }}>
        {tasks.length > 0 ? (
          <div id="frappe-gantt-container" style={{ minHeight: '400px' }}></div>
        ) : (
          <Flex justify="center" align="center" style={{ height: '100%' }}>
            <Text color="gray">Nenhum ticket corresponde aos filtros selecionados (ou não possuem datas definidas).</Text>
          </Flex>
        )}
      </Box>
    </Box>
  );
};

export default Roadmap;
