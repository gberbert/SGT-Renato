import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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
