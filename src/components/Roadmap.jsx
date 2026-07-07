import React, { useState, useEffect } from 'react';
import { subscribeToTickets } from '../services/ticketService';
import { subscribeToProjects } from '../services/projectService';
import { Loader2, Printer, Save, Filter, LayoutList } from 'lucide-react';
import { Text, Box, Flex, Button, Select, TextField, IconButton, Badge, Card, Popover } from '@radix-ui/themes';
import { Gantt, ViewMode } from 'gantt-task-react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import "gantt-task-react/dist/index.css";

const Roadmap = () => {
  const [tickets, setTickets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(ViewMode.Day);
  
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
      // Create Project node for the group
      const minDate = new Date(Math.min(...groupTickets.map(t => new Date(t.startDate).getTime())));
      const maxDate = new Date(Math.max(...groupTickets.map(t => new Date(t.deadline).getTime())));
      
      const groupId = `group-${key}`;
      tasks.push({
        start: minDate,
        end: maxDate,
        name: key.replace('col-', '').toUpperCase(), // better formatting for status
        id: groupId,
        type: 'project',
        progress: 0, // Could calc avg progress
        isDisabled: true,
        styles: { progressColor: 'var(--primary)', progressSelectedColor: 'var(--primary-hover)' }
      });

      // Add children
      groupTickets.forEach(t => {
        tasks.push({
          start: new Date(t.startDate),
          end: new Date(t.deadline) < new Date(t.startDate) ? new Date(new Date(t.startDate).getTime() + 86400000) : new Date(t.deadline),
          name: t.title,
          id: t.id,
          project: groupId,
          type: 'task',
          progress: t.columnId === 'col-done' ? 100 : (t.columnId === 'col-in-progress' ? 50 : 10),
          isDisabled: true,
          styles: { progressColor: 'var(--accent)', progressSelectedColor: 'var(--accent)' }
        });
      });
    });
  } else {
    // No grouping
    tasks = processedTickets.map(t => {
      const start = new Date(t.startDate);
      const end = new Date(t.deadline); 
      if (end < start) end.setTime(start.getTime() + 86400000);
      return {
        start,
        end,
        name: t.title,
        id: t.id,
        type: 'task',
        progress: t.columnId === 'col-done' ? 100 : (t.columnId === 'col-in-progress' ? 50 : 10),
        isDisabled: true,
        styles: { progressColor: 'var(--primary)', progressSelectedColor: 'var(--primary-hover)' }
      };
    });
  }

  // Extract unique values for filters from ALL tickets (to populate dropdowns)
  const uniqueSystems = [...new Set(tickets.map(t => t.system).filter(Boolean))];
  const uniqueAssignees = [...new Set(tickets.map(t => t.assignee).filter(Boolean))];
  const uniqueStatuses = [...new Set(tickets.map(t => t.columnId).filter(Boolean))];

  // DOM manipulation to highlight weekends and holidays
  useEffect(() => {
    if (viewMode !== ViewMode.Day || tasks.length === 0) return;

    const highlightInterval = setInterval(() => {
      const svg = document.querySelector('#gantt-container svg');
      if (!svg) return;

      // If already injected, don't inject again
      if (svg.querySelectorAll('.custom-holiday-marker').length > 0) return;

      const minDate = new Date(Math.min(...tasks.map(t => t.start.getTime())));
      minDate.setHours(0, 0, 0, 0);
      const ganttStartDate = new Date(minDate);
      ganttStartDate.setDate(ganttStartDate.getDate() - 1);

      const maxDate = new Date(Math.max(...tasks.map(t => t.end.getTime())));
      maxDate.setHours(0, 0, 0, 0);
      const ganttEndDate = new Date(maxDate);
      ganttEndDate.setDate(ganttEndDate.getDate() + 2);

      const totalDays = Math.ceil((ganttEndDate.getTime() - ganttStartDate.getTime()) / (1000 * 3600 * 24));
      const colWidth = 60; 
      const headerHeight = 50; 
      
      const svgHeight = svg.getAttribute('height') || (tasks.length * 50 + headerHeight + 50);

      const fragment = document.createDocumentFragment();

      let added = false;
      for (let i = 0; i <= totalDays; i++) {
        const currentDate = new Date(ganttStartDate);
        currentDate.setDate(currentDate.getDate() + i);
        
        const dayOfWeek = currentDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        const offset = currentDate.getTimezoneOffset();
        const targetDate = new Date(currentDate.getTime() - (offset*60*1000));
        const dateString = targetDate.toISOString().split('T')[0];

        const natHoliday = holidays.find(h => h.date === dateString);
        const isEstadual = localHolidays.estaduais.includes(dateString);
        const isMunicipal = localHolidays.municipais.includes(dateString);
        
        const isHoliday = natHoliday || isEstadual || isMunicipal;

        if (isWeekend || isHoliday) {
          added = true;
          const isLightMode = !!document.querySelector('.radix-themes.light, [data-theme="light"], .light');
          let bgColor = isLightMode ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.1)';
          let titleText = 'Fim de Semana';

          if (natHoliday) {
            bgColor = 'rgba(239, 68, 68, 0.3)'; // red
            titleText = `Feriado Nacional: ${natHoliday.name}`;
          } else if (isEstadual) {
            bgColor = 'rgba(59, 130, 246, 0.3)'; // blue
            titleText = `Feriado Estadual`;
          } else if (isMunicipal) {
            bgColor = 'rgba(16, 185, 129, 0.3)'; // green
            titleText = `Feriado Municipal`;
          }

          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('x', String(i * colWidth));
          rect.setAttribute('y', String(headerHeight));
          rect.setAttribute('width', String(colWidth));
          rect.setAttribute('height', '4000'); // Force cover full height, clipped by SVG
          rect.setAttribute('fill', bgColor);
          rect.setAttribute('class', 'custom-holiday-marker');
          rect.style.pointerEvents = 'none';
          
          if (isHoliday) {
            const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            title.textContent = titleText;
            rect.appendChild(title);
          }
          
          fragment.appendChild(rect);
        }
      }

      if (added) {
        // Append directly to the SVG root so it renders on top of ALL internal gantt groups
        // Since we use pointer-events: none and translucency, it tints the whole column safely.
        svg.appendChild(fragment);
      }
    }, 500);

    return () => clearInterval(highlightInterval);

    return () => clearTimeout(highlightTimer);
  }, [viewMode, tasks, holidays, localHolidays]);

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
            <option value={ViewMode.Day}>Diário</option>
            <option value={ViewMode.Week}>Semanal</option>
            <option value={ViewMode.Month}>Mensal</option>
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
            {/* Filters */}
            <label>
              <Text as="div" size="1" mb="1" weight="bold">Projeto</Text>
              <Select.Root value={filters.project} onValueChange={(v) => handleFilterChange('project', v)}>
                <Select.Trigger style={{ width: '150px' }} />
                <Select.Content>
                  <Select.Item value="all">Todos</Select.Item>
                  {projects.map(p => <Select.Item key={p.id} value={p.id}>{p.name}</Select.Item>)}
                </Select.Content>
              </Select.Root>
            </label>

            <label>
              <Text as="div" size="1" mb="1" weight="bold">Sistema</Text>
              <Select.Root value={filters.system} onValueChange={(v) => handleFilterChange('system', v)}>
                <Select.Trigger style={{ width: '150px' }} />
                <Select.Content>
                  <Select.Item value="all">Todos</Select.Item>
                  {uniqueSystems.map(s => <Select.Item key={s} value={s}>{s}</Select.Item>)}
                </Select.Content>
              </Select.Root>
            </label>

            <label>
              <Text as="div" size="1" mb="1" weight="bold">Status</Text>
              <Select.Root value={filters.status} onValueChange={(v) => handleFilterChange('status', v)}>
                <Select.Trigger style={{ width: '150px' }} />
                <Select.Content>
                  <Select.Item value="all">Todos</Select.Item>
                  {uniqueStatuses.map(s => <Select.Item key={s} value={s}>{s.replace('col-', '')}</Select.Item>)}
                </Select.Content>
              </Select.Root>
            </label>

            <label>
              <Text as="div" size="1" mb="1" weight="bold">Responsável</Text>
              <Select.Root value={filters.assignee} onValueChange={(v) => handleFilterChange('assignee', v)}>
                <Select.Trigger style={{ width: '150px' }} />
                <Select.Content>
                  <Select.Item value="all">Todos</Select.Item>
                  {uniqueAssignees.map(a => <Select.Item key={a} value={a}>{a}</Select.Item>)}
                </Select.Content>
              </Select.Root>
            </label>

            {/* Grouping */}
            <label>
              <Text as="div" size="1" mb="1" weight="bold" color="indigo">Agrupar por</Text>
              <Select.Root value={groupBy} onValueChange={setGroupBy}>
                <Select.Trigger style={{ width: '150px' }} />
                <Select.Content>
                  <Select.Item value="none">Nenhum</Select.Item>
                  <Select.Item value="system">Sistema</Select.Item>
                  <Select.Item value="status">Status</Select.Item>
                  <Select.Item value="assignee">Responsável</Select.Item>
                </Select.Content>
              </Select.Root>
            </label>
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
          <Gantt
            tasks={tasks}
            viewMode={viewMode}
            locale="pt-BR"
            listCellWidth={155}
            columnWidth={60}
            rowHeight={50}
            barCornerRadius={6}
            barFill={60}
          />
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
