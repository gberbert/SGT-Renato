import React, { useState, useEffect } from 'react';
import { subscribeToTickets } from '../services/ticketService';
import { subscribeToProjects } from '../services/projectService';
import { Loader2, Printer } from 'lucide-react';
import { Text, Box, Flex, Button, Select } from '@radix-ui/themes';
import { Gantt, ViewMode } from 'gantt-task-react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import "gantt-task-react/dist/index.css";

const Roadmap = () => {
  const [tickets, setTickets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(ViewMode.Day);
  const [holidays, setHolidays] = useState([]);
  const [localHolidays, setLocalHolidays] = useState({ estaduais: [], municipais: [] });

  // Fetch national holidays
  useEffect(() => {
    const year = new Date().getFullYear();
    fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`)
      .then(res => res.json())
      .then(data => {
        setHolidays(data || []);
      })
      .catch(err => console.error("Erro ao buscar feriados nacionais:", err));
  }, []);

  // Fetch local holidays when project changes
  useEffect(() => {
    const fetchLocal = async () => {
      if (selectedProjectId === 'all') {
        setLocalHolidays({ estaduais: [], municipais: [] });
        return;
      }
      const proj = projects.find(p => p.id === selectedProjectId);
      if (proj && proj.estado && proj.municipio) {
        try {
          const q = query(collection(db, "municipios"), 
            where("uf", "==", proj.estado), 
            where("nome", "==", proj.municipio)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            const data = snap.docs[0].data();
            setLocalHolidays({
              estaduais: data.feriados_estaduais || [],
              municipais: data.feriados_municipais || []
            });
          } else {
            setLocalHolidays({ estaduais: [], municipais: [] });
          }
        } catch (e) {
          console.error("Erro ao buscar feriados locais:", e);
        }
      } else {
        setLocalHolidays({ estaduais: [], municipais: [] });
      }
    };
    fetchLocal();
  }, [selectedProjectId, projects]);

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

  // DOM manipulation to highlight weekends and holidays
  useEffect(() => {
    if (viewMode !== ViewMode.Day || tasks.length === 0) return;

    const highlightTimer = setTimeout(() => {
      const grid = document.querySelector('#gantt-container g.grid');
      if (!grid) return;

      // Clean up previous custom markers
      const existing = document.querySelectorAll('#gantt-container .custom-holiday-marker');
      existing.forEach(e => e.remove());

      // Calculate Gantt internal start date for ViewMode.Day
      // gantt-task-react sets start date to earliest task start - 1 day
      const minDate = new Date(Math.min(...tasks.map(t => t.start.getTime())));
      minDate.setHours(0, 0, 0, 0);
      const ganttStartDate = new Date(minDate);
      ganttStartDate.setDate(ganttStartDate.getDate() - 1);

      const maxDate = new Date(Math.max(...tasks.map(t => t.end.getTime())));
      maxDate.setHours(0, 0, 0, 0);
      const ganttEndDate = new Date(maxDate);
      ganttEndDate.setDate(ganttEndDate.getDate() + 2); // default postStepsCount is usually 1, but let's be safe

      const totalDays = Math.ceil((ganttEndDate.getTime() - ganttStartDate.getTime()) / (1000 * 3600 * 24));
      const colWidth = 60; // our columnWidth prop
      
      // We don't need headerHeight because the grid is in its own SVG without the header
      const rowHeight = 50;
      const totalHeight = tasks.length * rowHeight;

      const fragment = document.createDocumentFragment();

      for (let i = 0; i <= totalDays; i++) {
        const currentDate = new Date(ganttStartDate);
        currentDate.setDate(currentDate.getDate() + i);
        
        const dayOfWeek = currentDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        // Format to YYYY-MM-DD for matching holidays
        const dateString = currentDate.toISOString().split('T')[0];
        const natHoliday = holidays.find(h => h.date === dateString);
        const isEstadual = localHolidays.estaduais.includes(dateString);
        const isMunicipal = localHolidays.municipais.includes(dateString);
        
        const isHoliday = natHoliday || isEstadual || isMunicipal;

        if (isWeekend || isHoliday) {
          let bgColor = 'rgba(0,0,0,0.05)'; // Default weekend (grey)
          let titleText = 'Fim de Semana';

          if (natHoliday) {
            bgColor = 'rgba(255, 99, 132, 0.2)'; // National (Red)
            titleText = `Feriado Nacional: ${natHoliday.name}`;
          } else if (isEstadual) {
            bgColor = 'rgba(54, 162, 235, 0.2)'; // Estadual (Blue)
            titleText = `Feriado Estadual`;
          } else if (isMunicipal) {
            bgColor = 'rgba(75, 192, 192, 0.2)'; // Municipal (Green)
            titleText = `Feriado Municipal`;
          }

          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('x', String(i * colWidth));
          rect.setAttribute('y', "0");
          rect.setAttribute('width', String(colWidth));
          rect.setAttribute('height', String(totalHeight));
          rect.setAttribute('fill', bgColor);
          rect.setAttribute('class', 'custom-holiday-marker');
          rect.style.pointerEvents = 'none'; // Don't block clicks
          
          if (isHoliday) {
            // Add a title tooltip for the holiday
            const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            title.textContent = titleText;
            rect.appendChild(title);
          }
          
          fragment.appendChild(rect);
        }
      }

      // Prepend to grid so it stays behind lines and tasks
      grid.prepend(fragment);

    }, 300); // Wait for Gantt to render

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
            <Text color="gray">Nenhum ticket com data definida para exibir no Roadmap.</Text>
          </Flex>
        )}
      </Box>
    </Box>
  );
};

export default Roadmap;
