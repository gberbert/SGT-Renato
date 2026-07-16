import React, { useState, useEffect } from 'react';
import { Menu, Plus, LogOut, Bell, Check, Trash2 } from 'lucide-react';
import { Flex, DropdownMenu, Button, IconButton, Badge, Box, Text, ScrollArea } from '@radix-ui/themes';
import { useLocation } from 'react-router-dom';
import GlobalSearch from './GlobalSearch';
import { auth } from '../firebase';
import { subscribeToUserNotifications, markNotificationAsRead, deleteAllNotifications, deleteNotification } from '../services/notificationService';
import { getTicketById } from '../services/ticketService';

const Topbar = ({ toggleSidebar, setIsModalOpen, setSelectedTicket, handleLogout }) => {
  const [notifications, setNotifications] = useState([]);
  const user = auth.currentUser;
  const location = useLocation();
  const currentBoard = location.pathname === '/atividades' ? 'atividades' : 'demandas';

  useEffect(() => {
    if (!user) return;

    const handleNewNotification = (data) => {
      if ('Notification' in window && Notification.permission === 'granted') {
        const title = data.senderName || data.title?.split(':')[0] || 'SGT - Nova Notificação';
        const bodyText = data.ticketTitle 
          ? `[${data.ticketTitle}]\n${data.textSnippet || data.message}`
          : (data.textSnippet || data.message);
          
        new Notification(title, { 
          body: bodyText,
          icon: '/vite.svg' 
        });
      }
    };

    const unsubscribe = subscribeToUserNotifications(user.uid, (data) => {
      setNotifications(data);
    }, handleNewNotification);
    
    return () => unsubscribe();
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleNotificationClick = async (n) => {
    // Apaga a notificação (não precisa mais ficar na lista)
    await deleteNotification(n.id);
    if (n.link && setSelectedTicket) {
      const ticket = await getTicketById(n.link);
      if (ticket) {
        setSelectedTicket(ticket);
      }
    }
  };

  return (
    <header className="topbar">
      <button className="mobile-menu-toggle" onClick={toggleSidebar}>
        <Menu size={24} />
      </button>
      
      <GlobalSearch onSelectTicket={setSelectedTicket} />
      
      <div className="topbar-actions">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <IconButton variant="ghost" style={{ position: 'relative', cursor: 'pointer' }}>
              <Bell size={20} />
              {unreadCount > 0 && (
                <Badge color="red" variant="solid" radius="full" style={{ position: 'absolute', top: -4, right: -4, width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end" style={{ width: '300px' }}>
            <Flex justify="between" align="center" p="2" style={{ borderBottom: '1px solid var(--gray-5)' }}>
              <Text weight="bold">Notificações</Text>
              {notifications.length > 0 && (
                <Button size="1" color="red" variant="soft" onClick={() => deleteAllNotifications(notifications)} style={{ cursor: 'pointer' }}>
                  Apagar todas
                </Button>
              )}
            </Flex>
            <ScrollArea style={{ maxHeight: '300px' }}>
              {notifications.length === 0 ? (
                <Box p="4" style={{ textAlign: 'center' }}>
                  <Text color="gray">Sem notificações.</Text>
                </Box>
              ) : (
                notifications.map(n => (
                  <DropdownMenu.Item 
                    key={n.id} 
                    onClick={() => handleNotificationClick(n)}
                    style={{ background: n.read ? 'transparent' : 'var(--indigo-2)', padding: '12px', cursor: 'pointer', height: 'auto', display: 'block' }}
                  >
                    <Flex direction="column" gap="1" style={{ width: '100%' }}>
                      <Flex justify="between" align="start">
                        <Text weight="bold" size="2">{n.senderName || n.title.split(':')[0]}</Text>
                        {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--indigo-9)', flexShrink: 0 }} />}
                      </Flex>
                      {n.ticketTitle && <Text weight="bold" size="1" color="indigo" mt="1">{n.ticketTitle}</Text>}
                      <Text size="2" color="gray" style={{ whiteSpace: 'normal', lineHeight: 1.2, marginTop: '4px' }}>
                        {n.textSnippet || n.message}
                      </Text>
                      <Text size="1" color="gray" mt="2">
                        {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString('pt-BR') : 'Agora'}
                      </Text>
                    </Flex>
                  </DropdownMenu.Item>
                ))
              )}
            </ScrollArea>
          </DropdownMenu.Content>
        </DropdownMenu.Root>


        <button className="btn-icon" onClick={handleLogout} title="Sair">
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
};

export default Topbar;
