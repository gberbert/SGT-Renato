import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, KanbanSquare, Route, FolderDot, Settings, Menu, X, Moon, Sun } from 'lucide-react';
import { IconButton } from '@radix-ui/themes';

const Sidebar = ({ isOpen, toggleSidebar, userRole, user, theme, toggleTheme }) => {
  const menuItems = [
    { name: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/' },
    { name: 'Kanban', icon: <KanbanSquare size={20} />, path: '/kanban' },
    { name: 'Roadmap', icon: <Route size={20} />, path: '/roadmap' },
    { name: 'Projetos', icon: <FolderDot size={20} />, path: '/projetos' },
  ];

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="logo">
          <KanbanSquare className="logo-icon" size={24} />
          <span className="logo-text">SGT</span>
        </div>
        <button className="menu-toggle" onClick={toggleSidebar}>
          <X size={24} />
        </button>
      </div>

      <nav className="sidebar-nav">
        <ul>
          {menuItems.map((item, index) => (
            <li key={index}>
              <NavLink 
                to={item.path} 
                onClick={() => {
                  if (isOpen) toggleSidebar();
                }}
                className={({ isActive }) => isActive ? "active-link" : ""}
                style={({ isActive }) => ({
                  backgroundColor: isActive ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                  color: isActive ? 'var(--primary)' : 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: 'var(--border-radius)',
                  fontWeight: 500,
                  transition: 'all 0.2s ease',
                  textDecoration: 'none'
                })}
              >
                {item.icon} {item.name}
              </NavLink>
            </li>
          ))}
          {userRole === 'admin' && (
            <>
              <li className="divider"></li>
              <li>
                <NavLink 
                  to="/configuracoes"
                  onClick={() => {
                    if (isOpen) toggleSidebar();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: 'var(--border-radius)',
                    color: 'var(--text-muted)',
                    fontWeight: 500,
                    textDecoration: 'none'
                  }}
                >
                  <Settings size={20} /> Configurações
                </NavLink>
              </li>
            </>
          )}
        </ul>
      </nav>

      <div style={{ padding: '0 16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--surface)', borderRadius: 'var(--border-radius)', border: '1px solid var(--gray-5)' }}>
          <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-main)' }}>Modo Noturno</span>
          <IconButton variant="soft" radius="full" onClick={toggleTheme} style={{ cursor: 'pointer' }}>
            {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
          </IconButton>
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="avatar">
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="user-info">
            <span className="name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
              {user?.displayName || user?.email || 'Usuário SGT'}
            </span>
            <span className="role" style={{ textTransform: 'capitalize' }}>
              {userRole} • v{__APP_VERSION__}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
