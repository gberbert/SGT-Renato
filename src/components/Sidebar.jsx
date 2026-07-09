import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, KanbanSquare, Route, FolderDot, Settings, Menu, X, Moon, Sun, Download, Bell, Share, Calculator } from 'lucide-react';
import { IconButton, Dialog, Button, Flex, Text } from '@radix-ui/themes';
import { auth } from '../firebase';
import { requestFCMToken } from '../services/notificationService';

const Sidebar = ({ isOpen, toggleSidebar, userRole, user, theme, toggleTheme }) => {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [showDesktopPrompt, setShowDesktopPrompt] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(
    'Notification' in window ? Notification.permission : 'denied'
  );

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }

    // Detect iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);

    // Detect if already installed
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    setIsStandalone(standalone);

    // Catch the install prompt for Android/Desktop
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSPrompt(true);
    } else if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstallPrompt(null);
      }
    } else {
      setShowDesktopPrompt(true);
    }
  };

  const handleNotificationRequest = async () => {
    if (!('Notification' in window)) {
      alert("Este navegador não suporta notificações web.");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') {
      new Notification("Notificações ativadas!", { body: "Você receberá atualizações do SGT aqui." });
      if (user) {
        await requestFCMToken(user.uid);
      }
    }
  };

  useEffect(() => {
    if (user && 'Notification' in window && Notification.permission === 'granted') {
      requestFCMToken(user.uid);
    }
  }, [user]);

  const menuItems = [
    { name: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/' },
    { name: 'Kanban', icon: <KanbanSquare size={20} />, path: '/kanban' },
    { name: 'Estimativas', icon: <Calculator size={20} />, path: '/estimativas' },
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

      <div style={{ padding: '0 16px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        
        {!isStandalone && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--primary)', color: 'white', borderRadius: 'var(--border-radius)', cursor: 'pointer', transition: 'all 0.2s' }} onClick={handleInstallClick}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Instalar App SGT</span>
            <Download size={16} />
          </div>
        )}

        {'Notification' in window && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--surface)', borderRadius: 'var(--border-radius)', border: '1px solid var(--gray-5)', cursor: 'pointer' }} onClick={handleNotificationRequest}>
            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-main)' }}>
              {notificationPermission === 'granted' ? 'Reconectar Notificações' : 'Ligar Notificações'}
            </span>
            <Bell size={16} />
          </div>
        )}

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

      <Dialog.Root open={showIOSPrompt} onOpenChange={setShowIOSPrompt}>
        <Dialog.Content maxWidth="400px">
          <Dialog.Title>Instalar no iPhone (iOS)</Dialog.Title>
          <Flex direction="column" gap="4">
            <Text>Para instalar o SGT no seu iPhone, siga estes 2 passos:</Text>
            <div style={{ background: 'var(--gray-3)', padding: '16px', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 12px 0', lineHeight: 1.5 }}>
                1. Toque no ícone de <strong>Compartilhar</strong> <Share size={16} style={{ display: 'inline', verticalAlign: 'middle', margin: '0 4px' }} /> na barra do Safari (na parte inferior da tela).
              </p>
              <p style={{ margin: 0 }}>
                2. Role para baixo e selecione <strong>"Adicionar à Tela de Início"</strong> (Add to Home Screen).
              </p>
            </div>
            <Flex justify="end" mt="2">
              <Button onClick={() => setShowIOSPrompt(false)}>Entendi</Button>
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={showDesktopPrompt} onOpenChange={setShowDesktopPrompt}>
        <Dialog.Content maxWidth="400px">
          <Dialog.Title>Instalar no Computador / Android</Dialog.Title>
          <Flex direction="column" gap="4">
            <Text>Para instalar o SGT e usá-mo como aplicativo nativo:</Text>
            <div style={{ background: 'var(--gray-3)', padding: '16px', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 12px 0' }}>
                <strong>No Computador (Chrome/Edge):</strong><br/>
                Clique no ícone de "Instalar" (uma tela com uma setinha para baixo) no lado direito da barra de endereços (onde fica a URL do site).
              </p>
              <p style={{ margin: 0 }}>
                <strong>No Android (Chrome):</strong><br/>
                Toque nos três pontinhos no canto superior direito e escolha <strong>"Adicionar à tela inicial"</strong> ou <strong>"Instalar aplicativo"</strong>.
              </p>
            </div>
            <Flex justify="end" mt="2">
              <Button onClick={() => setShowDesktopPrompt(false)}>Entendi</Button>
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

    </aside>
  );
};

export default Sidebar;
