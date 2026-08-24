import React, { useState, useEffect } from 'react';
import { Dialog, Flex, Box, Avatar, Text, Badge, Card, Button, Select } from '@radix-ui/themes';
import { Camera, Sun, Moon, Bell } from 'lucide-react';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateUser } from '../services/settingsService';
import { subscribeToProjectSquads } from '../services/squadService';
import { userHasFunctionPermission } from '../services/permissionService';
import { PermissionFunctionKeys } from '../services/permissionKeys';
import { SELECT_OPTIONS_BY_KEY } from '../utils/userFieldOptions';

const UserDetailsModal = ({ open, onOpenChange, user, theme, toggleTheme, notificationPermission, handleNotificationRequest, mode = "edit" }) => {
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [squads, setSquads] = useState([]);
  const [localUser, setLocalUser] = useState(user);
  const [draftUser, setDraftUser] = useState(user);
  const [activeTab, setActiveTab] = useState("DADOS PESSOAIS");

  const [canSeeCsr, setCanSeeCsr] = useState(true);
  const [canSeeRatecard, setCanSeeRatecard] = useState(true);

  useEffect(() => {
    setLocalUser(user);
    setDraftUser(user);
  }, [user]);

  useEffect(() => {
    if (!open) return;

    const role = localUser?.role;
    if (!role) {
      setCanSeeCsr(false);
      setCanSeeRatecard(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const [csrOk, rateOk] = await Promise.all([
          userHasFunctionPermission(role, PermissionFunctionKeys.USER_CSR_VIEW),
          userHasFunctionPermission(role, PermissionFunctionKeys.USER_RATECARD_VIEW),
        ]);
        if (cancelled) return;
        setCanSeeCsr(!!csrOk);
        setCanSeeRatecard(!!rateOk);
      } catch (e) {
        console.error(e);
        if (cancelled) return;
        setCanSeeCsr(false);
        setCanSeeRatecard(false);
      }
    })();

    const unsub = subscribeToProjectSquads('all', setSquads);
    return () => {
      cancelled = true;
      if (typeof unsub === "function") unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, localUser?.role]);

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

  const tabs = [
    "DADOS PESSOAIS",
    "CONTRATAÇÃO",
    "RATECARD",
    "SISTEMA",
  ];

  const fieldsByTab = {
    "DADOS PESSOAIS": [
      ["sapId", "SAP"],
      ["status", "STATUS"],
      ["displayName", "NOME"],
      ["shortName", "NOME RESUMIDO"],
      ["email", "EMAIL"],
      ["cidade", "CIDADE"],
      ["uf", "UF"],
      ["dataNascimento", "NASCIMENTO"],
    ],
    "CONTRATAÇÃO": [
      ["dataInicio", "INÍCIO NTT"],
      ["contract", "CONTRATO"],
      ["foundation", "FOUNDATION"],
      ["perfilNTT", "CARGO"],
      ["seniority", "SENIORIDADE"],
      ["csr", "CSR"],
    ],
    "RATECARD": [
      ["perfilRatecard", "PERFIL RATECARD"],
      ["rcSeniority", "SENIORIDADE RATECARD"],
      ["rc", "RATE CARD"],
    ],
    "SISTEMA": [
      ["role", "PERFIL ACESSO"],
    ],
  };

  const isDateField = (key) => key === "dataNascimento" || key === "dataInicio";
  const isSelectField = (key) => Object.prototype.hasOwnProperty.call(SELECT_OPTIONS_BY_KEY, key);

  const toInputDateValue = (value) => {
    if (!value) return "";
    try {
      if (typeof value === "object" && typeof value.toDate === "function") {
        const d = value.toDate();
        return d.toISOString().slice(0, 10);
      }
      const d = value instanceof Date ? value : new Date(value);
      if (!d || Number.isNaN(d.getTime())) return "";
      return d.toISOString().slice(0, 10);
    } catch {
      return "";
    }
  };

  const fromInputDateValue = (value) => {
    if (!value) return null;
    const d = new Date(`${value}T00:00:00.000Z`);
    if (!d || Number.isNaN(d.getTime())) return null;
    return d;
  };

  const toPersistValue = (key, value) => {
    if (isDateField(key)) {
      if (typeof value === "string") return fromInputDateValue(value);
      if (!value) return null;
      if (typeof value === "object" && typeof value.toDate === "function") return value.toDate();
      if (value instanceof Date) return value;
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return value ?? null;
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (next === false) return; onOpenChange(next); }}>
      <Dialog.Content
        style={{ maxWidth: 520 }}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
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
        <Flex direction="column" gap="2" mb="4">
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

        <Flex gap="2" mb="3" wrap="wrap">
          {tabs.map((t) => {
            const selected = activeTab === t;
            return (
              <Button
                key={t}
                type="button"
                variant={selected ? "solid" : "soft"}
                size="1"
                onClick={() => setActiveTab(t)}
                style={{ cursor: "pointer" }}
              >
                {t}
              </Button>
            );
          })}
        </Flex>

        <Box mb="4">
          <Flex direction="column" gap="2">
            {fieldsByTab[activeTab]
              .filter(([key]) => {
                if (key === "csr" && !canSeeCsr) return false;
                if (key === "rc" && !canSeeRatecard) return false;
                return true;
              })
              .map(([key, label]) => {
                const v = draftUser?.[key];
                const readOnly = mode === "view" || key === "role";
                return (
                  <Card key={key} size="1" variant="surface">
                    <Flex direction="column" gap="1">
                      <Text size="1" color="gray" style={{ textTransform: "uppercase" }}>
                        {label}
                      </Text>

                      {isDateField(key) ? (
                        <input
                          type="date"
                          value={toInputDateValue(v)}
                          readOnly={readOnly}
                          disabled={readOnly}
                          onChange={(e) => {
                            const next = e.target.value;
                            setDraftUser((prev) => ({ ...prev, [key]: next }));
                          }}
                          style={{
                            width: "100%",
                            height: 34,
                            borderRadius: 8,
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid var(--glass-border)",
                            color: "var(--text)",
                            padding: "0 10px",
                          }}
                        />
                      ) : isSelectField(key) ? (
                        <Select.Root
                          value={v || ""}
                          onValueChange={(next) => setDraftUser((prev) => ({ ...prev, [key]: next }))}
                          disabled={readOnly}
                        >
                          <Select.Trigger style={{ width: "100%" }} placeholder="Selecione..." />
                          <Select.Content>
                            {SELECT_OPTIONS_BY_KEY[key].map((opt) => (
                              <Select.Item key={opt} value={opt}>
                                {opt}
                              </Select.Item>
                            ))}
                          </Select.Content>
                        </Select.Root>
                      ) : (
                        <input
                          value={v ?? ""}
                          readOnly={readOnly}
                          disabled={readOnly}
                          onChange={(e) => setDraftUser((prev) => ({ ...prev, [key]: e.target.value }))}
                          style={{
                            width: "100%",
                            height: 34,
                            borderRadius: 8,
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid var(--glass-border)",
                            color: "var(--text)",
                            padding: "0 10px",
                          }}
                        />
                      )}
                    </Flex>
                  </Card>
                );
              })}
          </Flex>
        </Box>

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

        <Flex justify="end" mt="5" gap="2">
          {mode !== "view" && (
            <Button
              variant="soft"
              color="gray"
              onClick={() => {
                setDraftUser(localUser);
              }}
            >
              Cancelar
            </Button>
          )}

          {mode !== "view" && (
            <Button
              variant="solid"
              onClick={async () => {
                try {
                  const payload = {};
                  for (const tab of tabs) {
                    for (const [key] of fieldsByTab[tab] || []) {
                      payload[key] = toPersistValue(key, draftUser?.[key]);
                    }
                  }
                  await updateUser(localUser.id, payload);
                  setLocalUser((prev) => ({ ...prev, ...payload }));
                  setDraftUser((prev) => ({ ...prev }));
                } catch (err) {
                  console.error(err);
                }
              }}
            >
              Salvar
            </Button>
          )}

          <Button variant="soft" color="gray" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default UserDetailsModal;
