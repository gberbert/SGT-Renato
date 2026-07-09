import React, { useState, useEffect } from 'react';
import '@radix-ui/themes/styles.css';
import { Theme } from '@radix-ui/themes';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Login from './components/Login';
import KanbanBoard from './components/KanbanBoard';
import NewTicketModal from './components/NewTicketModal';
import Dashboard from './components/Dashboard';
import Projects from './components/Projects';
import ProjectDetails from './components/ProjectDetails';
import Roadmap from './components/Roadmap';
import GlobalSearch from './components/GlobalSearch';
import TicketDetailsModal from './components/TicketDetailsModal';
import Settings from './components/Settings';
import Estimations from './components/Estimations';
import RunMigration from './components/RunMigration';
import ResetPassword from './components/ResetPassword';
import { getUserRole, getTicketById } from './services/ticketService';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState('user');
  const [loading, setLoading] = useState(true);

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('sgt_theme') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('sgt_theme', theme);
    if (theme === 'light') {
      document.body.classList.add('light');
    } else {
      document.body.classList.remove('light');
    }
  }, [theme]);

  // Verificar se há um ticket na URL (vindo de uma Notificação Push)
  useEffect(() => {
    const checkUrlForTicket = async () => {
      const params = new URLSearchParams(window.location.search);
      const ticketId = params.get('ticket');
      if (ticketId) {
        const ticket = await getTicketById(ticketId);
        if (ticket) {
          setSelectedTicket(ticket);
        }
        // Opcional: limpar a URL sem recarregar a página
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };
    checkUrlForTicket();
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Garantir que todos os usuários logados existam no Firestore (mesmo os antigos "fantasmas")
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              email: currentUser.email,
              displayName: currentUser.email.split('@')[0],
              role: 'user',
              createdAt: serverTimestamp()
            });
          }
        } catch (error) {
          console.error("Erro ao sincronizar usuário no Firestore:", error);
        }

        // FORCANDO ADMIN TEMPORARIAMENTE
        setUserRole('admin');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleLogout = () => {
    signOut(auth);
  };

  if (loading) {
    return (
      <div className="loader-container">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <Theme appearance={theme} accentColor="iris" panelBackground="translucent">
        <Router>
          <Routes>
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<Login />} />
          </Routes>
        </Router>
      </Theme>
    );
  }

  return (
    <Theme appearance={theme} accentColor="iris" panelBackground="translucent">
      <Router>
        <div className="app-layout">
        <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} userRole={userRole} user={user} theme={theme} toggleTheme={toggleTheme} />
        {isSidebarOpen && (
          <div className="sidebar-overlay" onClick={toggleSidebar}></div>
        )}
        
        <main className="main-content">
          <Topbar 
            toggleSidebar={toggleSidebar} 
            setIsModalOpen={setIsModalOpen} 
            setSelectedTicket={setSelectedTicket}
            handleLogout={handleLogout}
          />
          
          <section className="view-container">
            <Routes>
              <Route path="/" element={<Dashboard userRole={userRole} />} />
              <Route path="/demandas" element={<KanbanBoard onCardClick={setSelectedTicket} userRole={userRole} board="demandas" />} />
              <Route path="/atividades" element={<KanbanBoard onCardClick={setSelectedTicket} userRole={userRole} board="atividades" />} />
              <Route path="/roadmap" element={<Roadmap userRole={userRole} />} />
              <Route path="/projetos" element={<Projects userRole={userRole} />} />
              <Route path="/estimativas" element={<Estimations />} />
              <Route path="/migracao" element={<RunMigration />} />
              <Route path="/projetos/:projectId" element={<ProjectDetails userRole={userRole} />} />
              <Route path="/configuracoes" element={userRole === 'admin' ? <Settings /> : <Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </section>
        </main>
        
        <NewTicketModal isOpen={!!isModalOpen} onClose={() => setIsModalOpen(false)} currentBoard={typeof isModalOpen === 'string' ? isModalOpen : 'demandas'} />
        {selectedTicket && (
          <TicketDetailsModal 
            isOpen={!!selectedTicket} 
            onClose={() => setSelectedTicket(null)} 
            ticket={selectedTicket} 
            userRole={userRole}
          />
        )}
        </div>
      </Router>
    </Theme>
  );
}

export default App;
