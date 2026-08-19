import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Menu, LogOut } from 'lucide-react';
import OperacaoSidebar from '../components/operacao/OperacaoSidebar';
import OperacaoHome from '../components/operacao/OperacaoHome';
import OperacaoConfig from '../components/operacao/OperacaoConfig';
import OperacaoCarga from '../components/operacao/OperacaoCarga';

const AdminOperacaoRoute = ({ userRole, children }) => {
  if (userRole !== 'admin') {
    return <Navigate to="/operacao" replace />;
  }
  return children;
};

const OperacaoLayout = ({ user, userRole, handleLogout, isSidebarOpen, toggleSidebar }) => {
  return (
    <div className="app-layout">
      <OperacaoSidebar
        isOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
        userRole={userRole}
        user={user}
      />
      {isSidebarOpen && <div className="sidebar-overlay" onClick={toggleSidebar}></div>}

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu-toggle" onClick={toggleSidebar}>
            <Menu size={24} />
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost" onClick={handleLogout} title="Sair">
            <LogOut size={18} /> <span className="hide-on-mobile">Sair</span>
          </button>
        </header>

        <section className="view-container">
          <Routes>
            <Route index element={<OperacaoHome userRole={userRole} />} />
            <Route
              path="config"
              element={
                <AdminOperacaoRoute userRole={userRole}>
                  <OperacaoConfig userRole={userRole} />
                </AdminOperacaoRoute>
              }
            />
            <Route
              path="carga"
              element={
                <AdminOperacaoRoute userRole={userRole}>
                  <OperacaoCarga userRole={userRole} />
                </AdminOperacaoRoute>
              }
            />
            <Route path="*" element={<Navigate to="/operacao" replace />} />
          </Routes>
        </section>
      </main>
    </div>
  );
};

export default OperacaoLayout;
