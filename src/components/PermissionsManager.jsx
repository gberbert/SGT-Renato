import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  Flex,
  Text,
  Badge,
  Table,
  Select,
  Dialog,
  TextField,
} from "@radix-ui/themes";
import { Loader2 } from "lucide-react";
import {
  createOrUpdatePermissionProfile,
  ensurePermissionProfileExists,
  getPermissionProfile,
} from "../services/permissionService";
import { PermissionFunctionKeys } from "../services/permissionKeys";

export default function PermissionsManager({ initialProfileId = "admin" }) {
  const [profileId, setProfileId] = useState(initialProfileId);
  const [profile, setProfile] = useState(null);

  const [allowedFunctions, setAllowedFunctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [profiles, setProfiles] = useState([]); // { profileId, displayName }
  const [profilesLoading, setProfilesLoading] = useState(true);

  // users (para validação de exclusão)
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProfileId, setNewProfileId] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");

  // edição / exclusão
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const allFunctionKeys = useMemo(() => Object.values(PermissionFunctionKeys), []);

  async function loadProfile(pid) {
    setLoading(true);
    setError("");
    try {
      // garante perfil padrão existir (rodar local sem seed manual)
      await ensurePermissionProfileExists(pid, {});
      const p = await getPermissionProfile(pid);
      setProfile(p);
      const af = Array.isArray(p?.allowedFunctions) ? p.allowedFunctions : [];
      setAllowedFunctions(af);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadProfiles() {
    setProfilesLoading(true);
    setError("");
    try {
      // lê todos os perfis existentes pela coleção
      const { collection, getDocs } = await import("firebase/firestore");
      const { db } = await import("../firebase");
      const { permissionProfiles } = await import("firebase/firestore");

      // acima pode falhar por bundling; então fazemos do jeito "simples":
      const fs = await import("firebase/firestore");
      const { collection: col, getDocs: docs } = fs;

      const { db: _db } = await import("../firebase");
      const snap = await docs(col(_db, "permissionProfiles"));
      const arr = [];
      snap.forEach((d) => {
        const data = d.data() || {};
        arr.push({ profileId: d.id, displayName: data.displayName || d.id });
      });
      setProfiles(arr);
    } catch (e) {
      // fallback: não impede a tela de carregar o perfil
      setProfiles([{ profileId: initialProfileId, displayName: initialProfileId }]);
      setError(`Não foi possível listar perfis. ${e?.message || String(e)}`);
    } finally {
      setProfilesLoading(false);
    }
  }

  async function loadUsersOnce() {
    setLoadingUsers(true);
    setDeleteError("");
    try {
      const fs = await import("firebase/firestore");
      const { db } = await import("../firebase");
      const snap = await fs.getDocs(
        fs.query(fs.collection(db, "users"), fs.orderBy("createdAt", "desc"))
      );

      const arr = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      setUsers(arr);
    } catch (e) {
      setUsers([]);
      setError(`Não foi possível listar usuários. ${e?.message || String(e)}`);
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => {
    loadProfiles();
    loadUsersOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadProfile(profileId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFn = (fnKey) => {
    setAllowedFunctions((prev) => {
      const set = new Set(prev);
      if (set.has(fnKey)) set.delete(fnKey);
      else set.add(fnKey);
      return Array.from(set);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await createOrUpdatePermissionProfile(profileId, {
        profileId,
        displayName: profile?.displayName || profileId,
        allowedFunctions,
        updatedAt: new Date().toISOString(),
      });
      const p = await getPermissionProfile(profileId);
      setProfile(p);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const canSave = profileId && !saving;

  const openCreate = () => {
    setNewProfileId("");
    setNewDisplayName("");
    setIsCreateOpen(true);
  };

  const handleCreateProfile = async () => {
    const pid = newProfileId.trim();
    if (!pid) return;

    const displayName = (newDisplayName || pid).trim();

    setSaving(true);
    setError("");
    try {
      await createOrUpdatePermissionProfile(pid, {
        profileId: pid,
        displayName,
        allowedFunctions: [],
        updatedAt: new Date().toISOString(),
      });

      setIsCreateOpen(false);
      await loadProfiles();
      setProfileId(pid);
      await loadProfile(pid);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!profileId) return;

    const dn = (editDisplayName || "").trim();
    if (!dn) return;

    setSaving(true);
    setError("");
    try {
      await createOrUpdatePermissionProfile(profileId, {
        profileId,
        displayName: dn,
        allowedFunctions: Array.isArray(allowedFunctions) ? allowedFunctions : [],
        updatedAt: new Date().toISOString(),
      });

      const p = await getPermissionProfile(profileId);
      setProfile(p);
      setIsEditOpen(false);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!profileId) return;

    setDeleteBusy(true);
    setDeleteError("");
    try {
      // bloqueia se existir user usando este profileId como role
      const inUse = users.some((u) => (u.role || "") === profileId);
      if (inUse) {
        throw new Error(`Não é possível excluir: existe(m) usuário(s) com role="${profileId}".`);
      }

      const fs = await import("firebase/firestore");
      const { db } = await import("../firebase");

      await fs.deleteDoc(fs.doc(db, "permissionProfiles", profileId));

      setIsDeleteConfirmOpen(false);

      await loadProfiles();

      const fallback =
        profiles.find((p) => p.profileId !== profileId)?.profileId || initialProfileId;

      setProfileId(fallback);
      await loadProfile(fallback);
    } catch (e) {
      setDeleteError(e?.message || String(e));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <Box p="4">
      <Card size="4" style={{ padding: 16 }}>
        <Flex justify="between" align="start" wrap="wrap" gap="3" mb="3">
          <Box>
            <Text as="h2" size="4" weight="bold" mb="1">
              SECOPS - Gerenciar Permissões
            </Text>
            <Text color="gray" size="2">
              Associe <b>perfis</b> (profileId) a <b>funcionalidades</b> (allowedFunctions).
            </Text>
          </Box>

          <Flex gap="2" align="end" wrap="wrap">
            <Box style={{ minWidth: 260 }}>
              <Select.Root
                value={profileId}
                onValueChange={(val) => setProfileId(val)}
                disabled={profilesLoading}
              >
                <Select.Trigger placeholder="Selecione um perfil..." style={{ width: "100%" }} />
                <Select.Content>
                  {profiles.map((p) => (
                    <Select.Item key={p.profileId} value={p.profileId}>
                      {p.displayName}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Box>

            <Button
              variant="solid"
              onClick={() => loadProfile(profileId)}
              disabled={!profileId || loading}
              type="button"
            >
              {loading ? <Loader2 size={16} className="spinner-icon" /> : "Carregar"}
            </Button>

            <Button variant="soft" onClick={openCreate} disabled={saving} type="button">
              Criar perfil
            </Button>

            <Button
              variant="soft"
              disabled={!profileId || profilesLoading || loading}
              type="button"
              onClick={() => {
                setEditDisplayName(profile?.displayName || profileId);
                setIsEditOpen(true);
              }}
            >
              Editar
            </Button>

            <Button variant="soft" onClick={handleSave} disabled={!canSave} type="button">
              {saving ? <Loader2 size={16} className="spinner-icon" /> : "Salvar"}
            </Button>

            <Button
              variant="soft"
              color="red"
              disabled={!profileId || profilesLoading || loading}
              type="button"
              onClick={() => {
                setDeleteError("");
                setIsDeleteConfirmOpen(true);
              }}
            >
              Excluir
            </Button>
          </Flex>
        </Flex>

        {error ? (
          <Text color="red" mb="3">
            {error}
          </Text>
        ) : null}

        <Dialog.Root open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <Dialog.Content maxWidth="420px" onInteractOutside={(e) => e.preventDefault()}>
            <Dialog.Title>Criar perfil simples</Dialog.Title>
            <Flex direction="column" gap="3">
              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  profileId
                </Text>
                <TextField.Root
                  value={newProfileId}
                  onChange={(e) => setNewProfileId(e.target.value)}
                  placeholder="ex: admin_2"
                />
              </label>

              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  displayName (opcional)
                </Text>
                <TextField.Root
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="ex: Admin 2"
                />
              </label>

              <Flex gap="3" mt="2" justify="end">
                <Dialog.Close>
                  <Button variant="soft" color="gray" type="button">
                    Cancelar
                  </Button>
                </Dialog.Close>
                <Button onClick={handleCreateProfile} disabled={!newProfileId.trim() || saving}>
                  {saving ? <Loader2 size={16} className="spinner-icon" /> : "Criar"}
                </Button>
              </Flex>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>

        <Dialog.Root open={isEditOpen} onOpenChange={setIsEditOpen}>
          <Dialog.Content maxWidth="420px" onInteractOutside={(e) => e.preventDefault()}>
            <Dialog.Title>Editar perfil</Dialog.Title>
            <Flex direction="column" gap="3">
              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  profileId
                </Text>
                <TextField.Root value={profileId} disabled />
              </label>

              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  displayName
                </Text>
                <TextField.Root
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="Nome exibido do perfil"
                />
              </label>

              <Flex gap="3" mt="2" justify="end">
                <Dialog.Close>
                  <Button variant="soft" color="gray" type="button">
                    Cancelar
                  </Button>
                </Dialog.Close>
                <Button onClick={handleSaveEdit} disabled={saving || profilesLoading}>
                  Salvar
                </Button>
              </Flex>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>

        <Dialog.Root open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
          <Dialog.Content maxWidth="460px" onInteractOutside={(e) => e.preventDefault()}>
            <Dialog.Title>Excluir perfil</Dialog.Title>
            <Flex direction="column" gap="3">
              <Text color="gray">
                Isso vai excluir <b>{profileId}</b> da coleção <code>permissionProfiles</code>.
              </Text>

              {deleteError ? (
                <Text color="red">
                  {deleteError}
                </Text>
              ) : null}

              <Text color="gray" size="2">
                A exclusão será bloqueada se houver algum usuário com <b>role</b> igual a este <b>profileId</b>.
              </Text>

              <Flex gap="3" mt="2" justify="end">
                <Dialog.Close>
                  <Button variant="soft" color="gray" type="button" disabled={deleteBusy}>
                    Cancelar
                  </Button>
                </Dialog.Close>
                <Button
                  color="red"
                  variant="solid"
                  disabled={deleteBusy}
                  onClick={async () => {}}
                >
                  {deleteBusy ? "Excluindo..." : "Excluir"}
                </Button>
              </Flex>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>

        {loading ? (
          <Flex justify="center" p="6">
            <Loader2 className="spinner-icon" size={28} />
          </Flex>
        ) : (
          <>
            <Text as="div" size="2" color="gray" mb="2">
              Perfil atual: <Badge color="indigo">{profileId}</Badge>
              {Array.isArray(allowedFunctions) ? (
                <>
                  {" "}
                  <Badge color="green">{allowedFunctions.length} funções</Badge>
                </>
              ) : null}
            </Text>

            <Table.Root variant="surface">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Funcionalidade</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Menu</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Rota (URL)</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell align="right">Permitido?</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {allFunctionKeys.map((fnKey) => {
                  const isAllowed = allowedFunctions.includes(fnKey);

                  const menuMapping = {
                    RADAR_VIEW: "Radar",
                    RADAR_REFRESH: "Radar (atualizar)",
                    RADAR_GERAL_VIEW: "Radar > Aba Geral",
                    RADAR_PROBLEMAS_VIEW: "Radar > Aba Problemas",
                    RADAR_DEMANDAS_TAB_VIEW: "Radar > Aba Demandas",
                    RADAR_INCIDENTES_VIEW: "Radar > Aba Incidentes",
                    RADAR_SOLICITACOES_VIEW: "Radar > Aba Solicitações",
                    RADAR_CATALOGO_VIEW: "Radar > Aba Catálogo",
                    RADAR_EFICIENCIA_VIEW: "Radar > Aba Eficiência",
                    DEMANDAS_VIEW: "Demandas",
                    MINHAS_ATIVIDADES_VIEW: "Minhas Atividades",
                    TEAM_VIEW: "Team (visualizar)",
                    TEAM_EDIT: "Team (editar)",
                    USER_CSR_VIEW: "User > Contratação (visualizar CSR)",
                    USER_RATECARD_VIEW: "User > Ratecard (visualizar RATE CARD)",
                    SETTINGS_VIEW: "Configurações",
                    PLANEJAMENTO_VIEW: "Planejamento",
                    CONFIGURACOES_VIEW: "Configurações (Jira / Operação)",
                    ADMIN_ALL: "Admin (tudo)",
                  };

                  const routeMapping = {
                    RADAR_VIEW: "/",
                    RADAR_REFRESH: "/ (botão Atualizar)",
                    RADAR_GERAL_VIEW: "/",
                    RADAR_PROBLEMAS_VIEW: "/radar/problemas",
                    RADAR_DEMANDAS_TAB_VIEW: "/radar/demandas",
                    RADAR_INCIDENTES_VIEW: "/radar/incidentes",
                    RADAR_SOLICITACOES_VIEW: "/radar/solicitacoes",
                    RADAR_CATALOGO_VIEW: "/radar/catalogo",
                    RADAR_EFICIENCIA_VIEW: "/radar/eficiencia",
                    DEMANDAS_VIEW: "/demandas",
                    MINHAS_ATIVIDADES_VIEW: "/minhas-atividades",
                    TEAM_VIEW: "/team",
                    TEAM_EDIT: "/team (edição inline)",
                    USER_CSR_VIEW: "/team (modal do usuário)",
                    USER_RATECARD_VIEW: "/team (modal do usuário)",
                    SETTINGS_VIEW: "/configuracoes",
                    PLANEJAMENTO_VIEW: "/planejamento",
                    CONFIGURACOES_VIEW: "/configuracoes",
                    ADMIN_ALL: "— (todas as rotas)",
                  };

                  return (
                    <Table.Row key={fnKey}>
                      <Table.Cell>
                        <Text weight="bold">{fnKey}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text>{menuMapping[fnKey] || "-"}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="1" style={{ fontFamily: "monospace" }} color="gray">
                          {routeMapping[fnKey] || "-"}
                        </Text>
                      </Table.Cell>
                      <Table.Cell align="right">
                        <Button
                          type="button"
                          size="1"
                          variant={isAllowed ? "solid" : "soft"}
                          color={isAllowed ? "green" : "gray"}
                          onClick={() => toggleFn(fnKey)}
                        >
                          {isAllowed ? "Sim" : "Não"}
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>

            <Box mt="3">
              <Text size="1" color="gray">
                Observação: este gerenciamento controla as chaves via coleção
                <code> permissionProfiles </code> no Firestore.
              </Text>
            </Box>
          </>
        )}
      </Card>
    </Box>
  );
}
