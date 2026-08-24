import React, { useEffect, useMemo, useState } from "react";
import "./Team.css";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { subscribeToUsers } from "../services/settingsService";

import { Box, Card, Flex, Text, TextField, Table, IconButton } from "@radix-ui/themes";
import { Edit2, Eye } from "lucide-react";
import UserDetailsModal from "./UserDetailsModal";

function safe(v) {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function getUserLabel(u) {
  return u?.displayName || u?.shortName || u?.name || u?.email || u?.id || "Sem nome";
}

function squadBadge(squad) {
  return safe(squad?.name) || safe(squad?.key) || safe(squad?.sigla) || "SQUAD";
}

function userIdFromMaybe(maybeId) {
  if (!maybeId) return "";
  if (typeof maybeId === "string") return maybeId;
  return maybeId?.id || "";
}

export default function Team() {
  const [loadingSquads, setLoadingSquads] = useState(true);
  const [squads, setSquads] = useState([]);

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [userSearchTerm, setUserSearchTerm] = useState("");

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserModalMode, setSelectedUserModalMode] = useState("edit");

  useEffect(() => {
    const q = query(collection(db, "squads"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setSquads(data);
        setLoadingSquads(false);
      },
      (err) => {
        console.error(err);
        setLoadingSquads(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsubUsers = subscribeToUsers((data) => {
      setUsers(data || []);
      setLoadingUsers(false);
    });
    return () => unsubUsers();
  }, []);

  // Para marcar checkboxes readOnly por squad: userId -> Set(squadId)
  const membership = useMemo(() => {
    const map = new Map();
    for (const squad of squads || []) {
      const squadId = squad?.id;
      if (!squadId) continue;

      const memberIds = Array.isArray(squad.users) ? squad.users : [];
      for (const member of memberIds) {
        const userId = userIdFromMaybe(member);
        if (!userId) continue;

        if (!map.has(userId)) map.set(userId, new Set());
        map.get(userId).add(squadId);
      }
    }
    return map;
  }, [squads]);

  const squadsSorted = useMemo(() => {
    return [...(squads || [])].sort((a, b) => {
      const an = (a?.name || a?.key || "").toString().toUpperCase();
      const bn = (b?.name || b?.key || "").toString().toUpperCase();
      return an.localeCompare(bn, "pt-BR");
    });
  }, [squads]);

  const usersSorted = useMemo(() => {
    return [...(users || [])].sort((a, b) => {
      const an = getUserLabel(a).toUpperCase();
      const bn = getUserLabel(b).toUpperCase();
      return an.localeCompare(bn, "pt-BR");
    });
  }, [users]);

  const usersFiltered = useMemo(() => {
    const term = userSearchTerm.trim().toLowerCase();
    if (!term) return usersSorted;

    const matchesBySearch = (u) => {
      const label = (getUserLabel(u) || "").toLowerCase();
      const email = (u?.email || "").toLowerCase();
      const id = (u?.id || "").toLowerCase();
      return label.includes(term) || email.includes(term) || id.includes(term);
    };

    return usersSorted.filter((u) => matchesBySearch(u));
  }, [userSearchTerm, usersSorted]);

  const isLoading = loadingSquads || loadingUsers;

  if (isLoading) {
    return (
      <div className="team-page">
        <div className="loader-container">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <UserDetailsModal
        open={userModalOpen}
        onOpenChange={setUserModalOpen}
        user={selectedUser}
        mode={selectedUserModalMode}
      />

      <div className="view-content" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div className="welcome-banner" style={{ marginBottom: 0 }}>
          <Flex justify="between" align="center" wrap="wrap" gap="4">
            <Box>
              <Text as="h1" size="6" weight="bold">
                Gestão de Time (Squads & Pessoas)
              </Text>
              <Text as="p" size="3" color="gray" mt="1">
                Colunas = squads; linhas = pessoas (users).
              </Text>
            </Box>
          </Flex>
        </div>

        <Card size="4">
          <Flex mb="4" align="center" gap="3" wrap="wrap">
            <TextField.Root
              placeholder="Pesquisar pessoas (nome, e-mail ou id)..."
              value={userSearchTerm}
              onChange={(e) => setUserSearchTerm(e.target.value)}
              style={{ flexGrow: 1, minWidth: 260 }}
            />
          </Flex>

          <Box mb="3">
            <Text color="gray" size="2">
              Pessoas: <b>{usersFiltered.length}</b> | Squads: <b>{squadsSorted.length}</b>
            </Text>
          </Box>

          <Box
            style={{
              maxHeight: "560px",
              overflow: "auto",
              borderRadius: "10px",
              border: "1px solid var(--glass-border)",
              background: "rgba(0,0,0,0.18)",
            }}
          >
            <Table.Root variant="surface">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>SAP ID</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Pessoa</Table.ColumnHeaderCell>
                  {squadsSorted.map((squad) => (
                    <Table.ColumnHeaderCell key={squad.id} title={squadBadge(squad)} align="center">
                      {squadBadge(squad)}
                    </Table.ColumnHeaderCell>
                  ))}
                  <Table.ColumnHeaderCell align="center">Ações</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>

              <Table.Body>
                {usersFiltered.map((user) => {
                  const userId = user?.id;
                  const squadSet = membership.get(userId) || new Set();

                  return (
                    <Table.Row key={userId} align="center">
                      <Table.Cell>
                        <Text size="2">{user?.sapId || "-"}</Text>
                      </Table.Cell>

                      <Table.Cell>
                        <Flex direction="column">
                          <Text weight="bold">{getUserLabel(user)}</Text>
                          {user?.email ? (
                            <Text size="1" color="gray">
                              {user.email}
                            </Text>
                          ) : null}
                        </Flex>
                      </Table.Cell>

                      {squadsSorted.map((squad) => (
                        <Table.Cell key={squad.id} align="center">
                          <input type="checkbox" checked={squadSet.has(squad.id)} readOnly />
                        </Table.Cell>
                      ))}

                      <Table.Cell align="center">
                        <Flex gap="2" justify="center">
                          <IconButton
                            size="1"
                            color="gray"
                            variant="soft"
                            onClick={() => {
                              setSelectedUser(user);
                              setSelectedUserModalMode("view");
                              setUserModalOpen(true);
                            }}
                            title="Visualizar dados"
                            data-accent-color="title"
                          >
                            <Eye size={14} />
                          </IconButton>

                          <IconButton
                            size="1"
                            color="indigo"
                            variant="soft"
                            onClick={() => {
                              setSelectedUser(user);
                              setSelectedUserModalMode("edit");
                              setUserModalOpen(true);
                            }}
                            title="Editar Usuário"
                            data-accent-color="title"
                          >
                            <Edit2 size={14} />
                          </IconButton>
                        </Flex>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}

                {(!usersFiltered || usersFiltered.length === 0) && (
                  <Table.Row>
                    <Table.Cell colSpan={3 + squadsSorted.length}>
                      <Text color="gray">Nenhum user encontrado.</Text>
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table.Root>
          </Box>
        </Card>
      </div>
    </>
  );
}
