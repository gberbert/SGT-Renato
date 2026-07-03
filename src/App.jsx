import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';

import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Login from './components/Login';
import KanbanBoard from './components/KanbanBoard';
import NewTicketModal from './components/NewTicketModal';
import Dashboard from './components/Dashboard';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
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
    return <Login />;
  }

  return (
    <Router>
      <div className="app-layout">
        <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
        
        <main className="main-content">
          <header className="topbar">
             <div className="topbar-search">
               <span className="material-symbols-outlined">search</span>
               <input type="text" placeholder="Buscar tickets, projetos..." />
             </div>
             <div className="topbar-actions">
               <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>Novo Ticket</button>
               <button className="btn-icon" onClick={handleLogout} title="Sair">
                 <span style={{ fontSize: '0.8rem' }}>Sair</span>
               </button>
             </div>
          </header>
          
          <section className="view-container">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/kanban" element={<KanbanBoard />} />
              <Route path="/roadmap" element={<div><h2>Roadmap</h2><p>Em breve integrado ao Firestore.</p></div>} />
              <Route path="/projetos" element={<div><h2>Projetos</h2></div>} />
              <Route path="/configuracoes" element={<div><h2>Configurações</h2></div>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </section>
        </main>
        
        <NewTicketModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </div>
    </Router>
  );
}

export default App;
