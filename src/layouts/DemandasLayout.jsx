import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import KanbanBoard from '../components/KanbanBoard';
import NewTicketModal from '../components/NewTicketModal';
import Projects from '../components/Projects';
import ProjectDetails from '../components/ProjectDetails';
import Roadmap from '../components/Roadmap';
import Settings from '../components/Settings';
import Estimations from '../components/Estimations';
import RunMigration from '../components/RunMigration';
import Specifications from '../components/Specifications';
import TechSpecs from '../components/TechSpecs';
import TShirts from '../components/TShirts';
import CapacityPlanning from '../components/CapacityPlanning';
import MyActivities from '../components/MyActivities';
import HelpFlow from '../components/HelpFlow';
import TicketDetailsModal from '../components/TicketDetailsModal';
import OperacaoHome from '../components/operacao/OperacaoHome';
import RoadmapGeral from '../components/RoadmapGeral';
import Team from '../components/Team';
import Organograma from '../components/Organograma';
import SecopsPermissionsLayout from './SecopsPermissionsLayout';
import { getTicketById } from '../services/ticketService';
import { logUserAccess } from '../services/auditService';

/** Gera ou reutiliza um ID de sessão único por aba/sessão do browser */
function getOrCreateSessionId() {
  let id = sessionStorage.getItem('sgt_session_id');
  if (!id) {
    id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem('sgt_session_id', id);
  }
  return id;
}

const DemandasLayout = ({
  userRole,
  user,
  theme,
  toggleTheme,
  handleLogout,
  isSidebarOpen,
  toggleSidebar,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const location = useLocation();
  const sessionId = useRef(getOrCreateSessionId()).current;
  // Throttle: não registra o mesmo path mais de 1x por segundo
  const lastLoggedPath = useRef(null);

  useEffect(() => {
    if (!user?.uid) return;
    if (lastLoggedPath.current === location.pathname) return;
    lastLoggedPath.current = location.pathname;
    logUserAccess(user, location.pathname, userRole, sessionId);
  }, [location.pathname, user, userRole, sessionId]);

  useEffect(() => {
    const checkUrlForTicket = async () => {
      const params = new URLSearchParams(window.location.search);
      const ticketId = params.get('ticket');
      if (ticketId) {
        const ticket = await getTicketById(ticketId);
        if (ticket) {
          setSelectedTicket(ticket);
        }
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };
    checkUrlForTicket();
  }, []);

  return (
    <div className="app-layout">
      <Sidebar
        isOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
        userRole={userRole}
        user={user}
        theme={theme}
        toggleTheme={toggleTheme}
      />
      {isSidebarOpen && <div className="sidebar-overlay" onClick={toggleSidebar}></div>}

      <main className="main-content">
        <Topbar
          toggleSidebar={toggleSidebar}
          setIsModalOpen={setIsModalOpen}
          setSelectedTicket={setSelectedTicket}
          handleLogout={handleLogout}
        />

        <section className="view-container">
          <Routes>
            <Route index element={<OperacaoHome userRole={userRole} />} />
            <Route path="/radar/:tabParam" element={<OperacaoHome userRole={userRole} />} />
            <Route path="/radar-operacao" element={<Navigate to="/" replace />} />
            <Route path="/roadmap-geral" element={<RoadmapGeral userRole={userRole} />} />
            <Route path="/demandas" element={<KanbanBoard onCardClick={setSelectedTicket} userRole={userRole} board="demandas" setIsModalOpen={setIsModalOpen} />} />
            <Route path="/atividades" element={<KanbanBoard onCardClick={setSelectedTicket} userRole={userRole} board="atividades" setIsModalOpen={setIsModalOpen} />} />
            <Route path="/roadmap" element={<Roadmap userRole={userRole} />} />
            <Route path="/projetos" element={<Projects userRole={userRole} />} />
            <Route path="/especificacoes" element={<Specifications userRole={userRole} />} />
            <Route path="/espec-tecnica" element={<TechSpecs userRole={userRole} />} />
            <Route path="/t-shirt" element={<TShirts userRole={userRole} />} />
            <Route path="/estimativas" element={<Estimations userRole={userRole} />} />
            <Route path="/migracao" element={<RunMigration />} />
            <Route path="/projetos/:projectId" element={<ProjectDetails userRole={userRole} />} />
            <Route path="/ajuda" element={<HelpFlow />} />
            <Route path="/configuracoes" element={userRole === 'admin' ? <Settings userRole={userRole} /> : <Navigate to="/" replace />} />
            <Route path="/planejamento" element={(userRole === 'admin' || userRole === 'squad_leader') ? <CapacityPlanning userRole={userRole} /> : <Navigate to="/" replace />} />
            <Route path="/secops/permissions" element={<SecopsPermissionsLayout userRole={userRole} />} />
            <Route path="/team" element={<Team userRole={userRole} />} />
            <Route path="/organograma" element={<Organograma userRole={userRole} />} />
            <Route path="/minhas-atividades" element={<MyActivities userRole={userRole} user={user} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </section>
      </main>

      <NewTicketModal
        isOpen={!!isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentBoard={typeof isModalOpen === 'string' ? isModalOpen : 'demandas'}
      />
      {selectedTicket && (
        <TicketDetailsModal
          isOpen={!!selectedTicket}
          onClose={() => setSelectedTicket(null)}
          ticket={selectedTicket}
          userRole={userRole}
        />
      )}
    </div>
  );
};

export default DemandasLayout;
