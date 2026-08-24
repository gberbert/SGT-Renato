import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  FolderDot,
  KanbanSquare,
  Settings,
  Download,
  Menu,
  X,
  Check,
  Share,
  Calculator,
  Route,
  FileText,
  Shirt,
  FileCode,
  ListChecks,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Radar,
  Users,
} from 'lucide-react';
import { IconButton, Dialog, Button, Flex, Text } from '@radix-ui/themes';
import { auth } from '../firebase';
import { requestFCMToken } from '../services/notificationService';
import { subscribeToUsers } from '../services/settingsService';
import UserDetailsModal from './UserDetailsModal';
import { getPermissionProfile } from '../services/permissionService';
import { PermissionFunctionKeys } from '../services/permissionKeys';

const Sidebar = ({ isOpen, toggleSidebar, userRole, user, theme, toggleTheme }) => {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [showDesktopPrompt, setShowDesktopPrompt] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(
    'Notification' in window ? Notification.permission : 'denied'
  );
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [fullUser, setFullUser] = useState(null);
  const [isDemandasOpen, setIsDemandasOpen] = useState(false);

  useEffect(() => {
    let unsubUsers;
    if (user?.email || user?.uid) {
      unsubUsers = subscribeToUsers((data) => {
        const found = data.find(u => u.email === user.email || u.id === user.uid);
        if (found) setFullUser(found);
      });
    }
    return () => {
      if (unsubUsers) unsubUsers();
    };
  }, [user]);

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

  const [allowedFunctions, setAllowedFunctions] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function loadAllowed() {
      if (!userRole) return;

      // permissionProfiles.profileId é o "id" (que você configurou no SECOPS)
      const profile = await getPermissionProfile(userRole);
      const af = Array.isArray(profile?.allowedFunctions) ? profile.allowedFunctions : [];
      if (!cancelled) setAllowedFunctions(af);
    }
    loadAllowed();
    return () => {
      cancelled = true;
    };
  }, [userRole]);

  const has = (fnKey) => allowedFunctions.includes(fnKey);

  let menuItems = [
    { name: 'Radar Operação', icon: <Radar size={20} />, path: '/', requiredFn: PermissionFunctionKeys.RADAR_VIEW },
    { name: 'Minhas Atividades', icon: <ListChecks size={20} />, path: '/minhas-atividades', requiredFn: PermissionFunctionKeys.MINHAS_ATIVIDADES_VIEW },
    { name: 'Team', icon: <Users size={20} />, path: '/team', requiredFn: PermissionFunctionKeys.TEAM_VIEW },
    { name: 'Demandas', icon: <KanbanSquare size={20} />, path: '/demandas', isDemandasParent: true, requiredFn: PermissionFunctionKeys.DEMANDAS_VIEW },
    { name: 'Roadmap', icon: <Route size={20} />, path: '/roadmap', isChild: true, requiredFn: PermissionFunctionKeys.DEMANDAS_VIEW },
    { name: 'T-Shirt', icon: <Shirt size={20} />, path: '/t-shirt', isChild: true, requiredFn: PermissionFunctionKeys.DEMANDAS_VIEW },
    { name: 'Estimativas', icon: <Calculator size={20} />, path: '/estimativas', isChild: true, requiredFn: PermissionFunctionKeys.DEMANDAS_VIEW },
    { name: 'Espec. Func.', icon: <FileText size={20} />, path: '/especificacoes', isChild: true, requiredFn: PermissionFunctionKeys.DEMANDAS_VIEW },
    { name: 'Espec. Técnica', icon: <FileCode size={20} />, path: '/espec-tecnica', isChild: true, requiredFn: PermissionFunctionKeys.DEMANDAS_VIEW },
    { name: 'Desenvolvimento', icon: <Check size={20} />, path: '/atividades', isChild: true, requiredFn: PermissionFunctionKeys.DEMANDAS_VIEW },
  ];

  // "Projetos" (antes era admin/squad_leader). Agora será permitido via ADMIN_ALL ou SETTINGS_VIEW/PLANEJAMENTO_VIEW.
  // Ajuste se você quiser uma chave específica.
  if (has(PermissionFunctionKeys.ADMIN_ALL) || has(PermissionFunctionKeys.SETTINGS_VIEW)) {
    menuItems.splice(1, 0, { name: 'Projetos', icon: <FolderDot size={20} />, path: '/projetos', requiredFn: PermissionFunctionKeys.ADMIN_ALL });
  }

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
          {menuItems.map((item, index) => {
            if (item.isChild && !isDemandasOpen) return null;

            // aplica permissões por allowedFunctions
            if (item.requiredFn && !has(item.requiredFn)) return null;

            return (
            <li key={index}>
              <NavLink
                to={item.path}
                end={item.path === '/'}
                onClick={(e) => {
                  if (item.isDemandasParent) {
                    setIsDemandasOpen(!isDemandasOpen);
                  }
                  if (isOpen && !item.isDemandasParent) {
                    toggleSidebar();
                  }
                }}
                className={({ isActive }) => (isActive && !item.isDemandasParent) ? "active-link" : ""}
                style={({ isActive }) => ({
                  backgroundColor: (isActive && !item.isDemandasParent) ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                  color: (isActive && !item.isDemandasParent) ? 'var(--primary)' : 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '12px 16px',
                  paddingLeft: item.isChild ? '40px' : '16px',
                  borderRadius: 'var(--border-radius)',
                  fontWeight: 500,
                  transition: 'all 0.2s ease',
                  textDecoration: 'none'
                })}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {item.icon} {item.name}
                </div>
                {item.isDemandasParent && (
                  isDemandasOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                )}
              </NavLink>
            </li>
          )})}
          <li className="divider"></li>
          <li>
            <NavLink 
              to="/ajuda"
              onClick={() => {
                if (isOpen) toggleSidebar();
              }}
              className={({ isActive }) => isActive ? "active-link" : ""}
              style={({ isActive }) => ({
                backgroundColor: isActive ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: 'var(--border-radius)',
                color: isActive ? 'var(--primary)' : 'inherit',
                fontWeight: 500,
                textDecoration: 'none'
              })}
            >
              <HelpCircle size={20} /> Ajuda
            </NavLink>
          </li>
          {(has(PermissionFunctionKeys.SETTINGS_VIEW) || has(PermissionFunctionKeys.PLANEJAMENTO_VIEW) || has(PermissionFunctionKeys.ADMIN_ALL)) && (
            <>
              <li className="divider"></li>

              {has(PermissionFunctionKeys.SETTINGS_VIEW) || has(PermissionFunctionKeys.ADMIN_ALL) ? (
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
                      textDecoration: 'none',
                    }}
                  >
                    <Settings size={20} /> Configurações
                  </NavLink>
                </li>
              ) : null}

              {has(PermissionFunctionKeys.PLANEJAMENTO_VIEW) || has(PermissionFunctionKeys.ADMIN_ALL) ? (
                <li>
                  <NavLink
                    to="/planejamento"
                    onClick={() => {
                      if (isOpen) toggleSidebar();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      borderRadius: 'var(--border-radius)',
                      fontWeight: 500,
                      transition: 'all 0.2s ease',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                    className={({ isActive }) => (isActive ? 'active-link' : '')}
                  >
                    <Calculator size={20} /> Planejamento
                  </NavLink>
                </li>
              ) : null}
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


      </div>

      <div className="sidebar-footer" onClick={() => setShowProfileModal(true)} style={{ cursor: 'pointer' }}>
        <div className="user-profile">
          <div className="avatar">
            {fullUser?.photoURL ? (
              <img src={fullUser.photoURL} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              (fullUser?.displayName || user?.email || 'U').charAt(0).toUpperCase()
            )}
          </div>
          <div className="user-info">
            <span className="name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
              {fullUser?.displayName || user?.email || 'Usuário SGT'}
            </span>
            <span className="role" style={{ textTransform: 'capitalize' }}>
              {userRole} • v{__APP_VERSION__}
            </span>
          </div>
        </div>
      </div>

      <Dialog.Root open={showIOSPrompt} onOpenChange={setShowIOSPrompt}>
        <Dialog.Content maxWidth="400px" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
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
        <Dialog.Content maxWidth="400px" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
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

      {fullUser && (
        <UserDetailsModal 
          open={showProfileModal} 
          onOpenChange={setShowProfileModal} 
          user={fullUser} 
          theme={theme}
          toggleTheme={toggleTheme}
          notificationPermission={notificationPermission}
          handleNotificationRequest={handleNotificationRequest}
        />
      )}

    </aside>
  );
};

export default Sidebar;
