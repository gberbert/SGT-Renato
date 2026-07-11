import React, { useState, useEffect } from 'react';
import { Dialog, Flex, Box, Avatar, Text, Badge, Card, Button } from '@radix-ui/themes';
import { Camera, Sun, Moon, Bell } from 'lucide-react';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateUser } from '../services/settingsService';
import { subscribeToProjectSquads } from '../services/squadService';

const UserDetailsModal = ({ open, onOpenChange, user, theme, toggleTheme, notificationPermission, handleNotificationRequest }) => {
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [squads, setSquads] = useState([]);
  const [localUser, setLocalUser] = useState(user);

  useEffect(() => {
    setLocalUser(user);
  }, [user]);

  useEffect(() => {
    if (open) {
      const unsub = subscribeToProjectSquads('all', setSquads);
      return () => unsub();
    }
  }, [open]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !localUser) return;
    try {
      setIsUploadingPhoto(true);
      const storageRef = ref(storage, `profiles/${localUser.id}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      await updateUser(localUser.id, { photoURL: url });
      setLocalUser(prev => ({ ...prev, photoURL: url }));
    } catch (error) {
      console.error(error);
      alert('Erro ao fazer upload da foto.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  if (!localUser) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content style={{ maxWidth: 400 }} onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <Dialog.Title>Detalhes do Membro</Dialog.Title>
        <Flex gap="4" align="center" mb="5" mt="2">
          <Box position="relative">
            <Avatar size="6" src={localUser.photoURL} fallback={(localUser.displayName || localUser.shortName || localUser.name || localUser.email || 'U').charAt(0)} radius="full" />
            <label style={{ position: 'absolute', bottom: -5, right: -5, background: 'var(--indigo-9)', color: 'white', borderRadius: '50%', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} title="Alterar foto">
              {isUploadingPhoto ? <span style={{fontSize: '10px'}}>...</span> : <Camera size={14} />}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} disabled={isUploadingPhoto} />
            </label>
          </Box>
          <Box>
            <Text as="div" size="4" weight="bold">{localUser.displayName || localUser.shortName || localUser.name || localUser.email}</Text>
            <Text as="div" size="2" color="gray">{localUser.email}</Text>
            <Badge color="indigo" mt="2">{localUser.role || 'Membro'}</Badge>
          </Box>
        </Flex>
        
        <Text as="div" weight="bold" mb="2">Squads Atuais</Text>
        <Flex direction="column" gap="2">
          {(() => {
            const userSquads = squads.filter(s => {
              const inUsers = s.users?.some(su => su.id === localUser.id);
              const inMembers = s.members?.includes(localUser.id);
              return inUsers || inMembers || localUser.squadId === s.id;
            });
            if (userSquads.length === 0) return <Text color="gray" size="2">Não pertence a nenhuma squad no momento.</Text>;
            return userSquads.map(sq => {
              const squadUserObj = sq.users?.find(su => su.id === localUser.id);
              const specificRole = squadUserObj?.role || localUser.role || 'Membro';
              return (
                <Card key={sq.id} size="1" variant="surface">
                  <Flex justify="between" align="center">
                    <Text weight="bold" size="2">{sq.name}</Text>
                    <Badge color="blue" variant="soft">{specificRole}</Badge>
                  </Flex>
                </Card>
              );
            });
          })()}
        </Flex>
        
        {toggleTheme && (
          <>
            <Text as="div" weight="bold" mt="4" mb="2">Preferências</Text>
            <Flex direction="column" gap="2">
              {'Notification' in window && handleNotificationRequest && (
                <Card size="1" variant="surface" style={{ cursor: 'pointer' }} onClick={handleNotificationRequest}>
                  <Flex justify="between" align="center">
                    <Text size="2">{notificationPermission === 'granted' ? 'Reconectar Notificações' : 'Ligar Notificações'}</Text>
                    <Bell size={16} />
                  </Flex>
                </Card>
              )}
              
              <Card size="1" variant="surface">
                <Flex justify="between" align="center">
                  <Text size="2">Modo Noturno</Text>
                  <Button variant="soft" size="1" onClick={toggleTheme} style={{ cursor: 'pointer', padding: '0 8px' }}>
                    {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
                  </Button>
                </Flex>
              </Card>
            </Flex>
          </>
        )}
        
        <Flex justify="end" mt="5">
          <Button variant="soft" color="gray" onClick={() => onOpenChange(false)}>Fechar</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default UserDetailsModal;
