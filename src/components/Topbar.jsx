import React, { useState, useEffect } from 'react';
import { Menu, Plus, LogOut, Bell, Check, Trash2 } from 'lucide-react';
import { Flex, DropdownMenu, Button, IconButton, Badge, Box, Text, ScrollArea } from '@radix-ui/themes';
import GlobalSearch from './GlobalSearch';
import { auth } from '../firebase';
import { subscribeToUserNotifications, markNotificationAsRead, markAllAsRead } from '../services/notificationService';

const Topbar = ({ toggleSidebar, setIsModalOpen, setSelectedTicket, handleLogout }) => {
  const [notifications, setNotifications] = useState([]);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToUserNotifications(user.uid, (data) => {
      setNotifications(data);
    });
    return () => unsubscribe();
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleNotificationClick = async (n) => {
    if (!n.read) await markNotificationAsRead(n.id);
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
              {unreadCount > 0 && (
                <Button size="1" variant="ghost" onClick={() => markAllAsRead(user.uid, notifications)} style={{ cursor: 'pointer' }}>
                  Marcar lidas
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
                    style={{ background: n.read ? 'transparent' : 'var(--indigo-2)', padding: '12px', cursor: 'pointer' }}
                  >
                    <Flex direction="column" gap="1">
                      <Flex justify="between" align="start">
                        <Text weight="bold" size="2">{n.title}</Text>
                        {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--indigo-9)', flexShrink: 0 }} />}
                      </Flex>
                      <Text size="2" color="gray" style={{ whiteSpace: 'normal', lineHeight: 1.2 }}>{n.message}</Text>
                      <Text size="1" color="gray" mt="1">
                        {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : 'Agora'}
                      </Text>
                    </Flex>
                  </DropdownMenu.Item>
                ))
              )}
            </ScrollArea>
          </DropdownMenu.Content>
        </DropdownMenu.Root>

        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> <span className="hide-on-mobile">Novo Ticket</span>
        </button>
        <button className="btn-icon" onClick={handleLogout} title="Sair">
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
};

export default Topbar;
