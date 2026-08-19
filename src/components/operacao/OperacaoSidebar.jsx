import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Network, LayoutDashboard, ArrowLeftRight, X, Settings, Database } from 'lucide-react';
import { clearActiveModule } from '../../utils/moduleSession';
import { subscribeToUsers } from '../../services/settingsService';

const OperacaoSidebar = ({ isOpen, toggleSidebar, userRole, user }) => {
  const navigate = useNavigate();
  const [fullUser, setFullUser] = useState(null);
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    let unsubUsers;
    if (user?.email || user?.uid) {
      unsubUsers = subscribeToUsers((data) => {
        const found = data.find((u) => u.email === user.email || u.id === user.uid);
        if (found) setFullUser(found);
      });
    }
    return () => {
      if (unsubUsers) unsubUsers();
    };
  }, [user]);

  const displayName = fullUser?.displayName || user?.email?.split('@')[0] || 'Usuário SGT';
  const avatarLetter = (fullUser?.displayName || user?.email || 'U').charAt(0).toUpperCase();

  const handleSwitchModule = () => {
    clearActiveModule();
    navigate('/portal');
    if (isOpen) toggleSidebar();
  };

  const linkStyle = ({ isActive }) => ({
    backgroundColor: isActive ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
    color: isActive ? 'var(--info)' : 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: 'var(--border-radius)',
    fontWeight: 500,
    textDecoration: 'none',
  });

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="logo">
          <Network className="logo-icon" size={24} />
          <span className="logo-text">SGT Operação</span>
        </div>
        <button className="menu-toggle" onClick={toggleSidebar}>
          <X size={24} />
        </button>
      </div>

      <nav className="sidebar-nav">
        <ul>
          <li>
            <NavLink
              to="/operacao"
              end
              onClick={() => isOpen && toggleSidebar()}
              className={({ isActive }) => (isActive ? 'active-link' : '')}
              style={linkStyle}
            >
              <LayoutDashboard size={20} /> Radar Operação
            </NavLink>
          </li>

          {isAdmin && (
            <>
              <li>
                <NavLink
                  to="/operacao/config"
                  onClick={() => isOpen && toggleSidebar()}
                  className={({ isActive }) => (isActive ? 'active-link' : '')}
                  style={linkStyle}
                >
                  <Settings size={20} /> Configuração Jira
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/operacao/carga"
                  onClick={() => isOpen && toggleSidebar()}
                  className={({ isActive }) => (isActive ? 'active-link' : '')}
                  style={linkStyle}
                >
                  <Database size={20} /> Carga Jira
                </NavLink>
              </li>
            </>
          )}

          <li className="divider"></li>
          <li>
            <button
              type="button"
              onClick={handleSwitchModule}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: 'var(--border-radius)',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <ArrowLeftRight size={20} /> Trocar módulo
            </button>
          </li>
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="avatar">
            {fullUser?.photoURL ? (
              <img
                src={fullUser.photoURL}
                alt="Avatar"
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              avatarLetter
            )}
          </div>
          <div className="user-info">
            <span
              className="name"
              style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}
            >
              {displayName}
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

export default OperacaoSidebar;
