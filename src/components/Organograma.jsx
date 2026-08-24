import React, { useEffect, useMemo, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { subscribeToUsers } from '../services/settingsService';
import { Box, Flex, Text, Dialog } from '@radix-ui/themes';
import { User, X } from 'lucide-react';
import './Organograma.css';

function getUserLabel(u) {
  return u?.displayName || u?.shortName || u?.name || u?.email || 'Sem nome';
}

function userIdFromMaybe(maybeId) {
  if (!maybeId) return '';
  if (typeof maybeId === 'string') return maybeId;
  return maybeId?.id || '';
}

function normalizeRole(raw) {
  return String(raw || '').trim() || 'Sem papel';
}

function isGpRole(raw) {
  return String(raw || '').trim().toUpperCase() === 'GP';
}

function squadDisplayName(squad) {
  return squad?.name || squad?.nome || squad?.key || 'Squad sem nome';
}

function squadBadge(squad) {
  if (squad?.sigla) return String(squad.sigla).toUpperCase();
  const name = squadDisplayName(squad);
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
  return words.map((w) => w[0]).join('').slice(0, 4).toUpperCase();
}

const Organograma = () => {
  const [squads, setSquads] = useState([]);
  const [loadingSquads, setLoadingSquads] = useState(true);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedSquadId, setSelectedSquadId] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'squads'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setSquads(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
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
    const unsub = subscribeToUsers((data) => {
      setUsers(data || []);
      setLoadingUsers(false);
    });
    return () => unsub();
  }, []);

  const usersById = useMemo(() => {
    const map = new Map();
    for (const u of users) map.set(u.id, u);
    return map;
  }, [users]);

  // Enriquece cada squad com { members: [{user, role}], gpMember, totalMembers }
  const squadsEnriched = useMemo(() => {
    return squads.map((squad) => {
      const rawUsers = Array.isArray(squad.users) ? squad.users : [];
      const members = rawUsers
        .map((entry) => {
          const userId = userIdFromMaybe(entry);
          const role = typeof entry === 'object' ? entry.role : null;
          const user = usersById.get(userId);
          if (!user) return null;
          return { user, role: normalizeRole(role) };
        })
        .filter(Boolean);

      const gpMember = members.find((m) => isGpRole(m.role)) || null;

      return {
        ...squad,
        members,
        gpMember,
        totalMembers: members.length,
      };
    });
  }, [squads, usersById]);

  const squadsSorted = useMemo(() => {
    return [...squadsEnriched].sort((a, b) =>
      squadDisplayName(a).localeCompare(squadDisplayName(b), 'pt-BR')
    );
  }, [squadsEnriched]);

  const selectedSquad = useMemo(
    () => squadsSorted.find((s) => s.id === selectedSquadId) || null,
    [squadsSorted, selectedSquadId]
  );

  const membersByRole = useMemo(() => {
    if (!selectedSquad) return [];
    const map = new Map();
    for (const member of selectedSquad.members) {
      const role = member.role;
      if (!map.has(role)) map.set(role, []);
      map.get(role).push(member);
    }
    return [...map.entries()]
      .map(([role, members]) => ({
        role,
        members: members.sort((a, b) =>
          getUserLabel(a.user).localeCompare(getUserLabel(b.user), 'pt-BR')
        ),
      }))
      .sort((a, b) => b.members.length - a.members.length || a.role.localeCompare(b.role, 'pt-BR'));
  }, [selectedSquad]);

  const isLoading = loadingSquads || loadingUsers;

  if (isLoading) {
    return (
      <div className="organograma-page">
        <div className="loader-container">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <Box className="organograma-page" p="5">
      <Flex align="center" justify="between" wrap="wrap" gap="3" mb="5">
        <Box>
          <Text as="h1" size="7" weight="bold">
            Organograma da <span className="organograma-title-accent">Operação AMS</span>
          </Text>
        </Box>
        <Box className="organograma-hint">
          <Text size="2" color="gray">
            Liderança por squad. Clique em um card para expandir e ver o time completo.
          </Text>
        </Box>
      </Flex>

      {squadsSorted.length === 0 ? (
        <Text color="gray">Nenhuma squad cadastrada.</Text>
      ) : (
        <Box className="organograma-grid">
          {squadsSorted.map((squad) => {
            const gp = squad.gpMember;
            const label = gp ? getUserLabel(gp.user) : squadDisplayName(squad);
            const photoURL = gp?.user?.photoURL;

            return (
              <button
                type="button"
                key={squad.id}
                className="organograma-card"
                onClick={() => setSelectedSquadId(squad.id)}
              >
                <Box className="organograma-card-avatar">
                  {photoURL ? (
                    <img src={photoURL} alt={label} />
                  ) : (
                    <User size={28} />
                  )}
                </Box>
                <Text as="div" weight="bold" size="4" className="organograma-card-name">
                  {gp ? getUserLabel(gp.user) : 'Sem GP definido'}
                </Text>
                <Text as="div" weight="bold" size="3" className="organograma-card-squad">
                  {squadDisplayName(squad)}
                </Text>
                <Box className="organograma-card-badge">{squadBadge(squad)}</Box>
              </button>
            );
          })}
        </Box>
      )}

      <Dialog.Root open={!!selectedSquad} onOpenChange={(open) => !open && setSelectedSquadId(null)}>
        <Dialog.Content maxWidth="720px" className="organograma-modal">
          {selectedSquad && (
            <>
              <Flex justify="between" align="start" mb="4">
                <Flex align="center" gap="3">
                  <Box className="organograma-modal-avatar">
                    {selectedSquad.gpMember?.user?.photoURL ? (
                      <img src={selectedSquad.gpMember.user.photoURL} alt="" />
                    ) : (
                      <User size={22} />
                    )}
                  </Box>
                  <Box>
                    <Text as="div" weight="bold" size="5">
                      {selectedSquad.gpMember ? getUserLabel(selectedSquad.gpMember.user) : 'Sem GP definido'}
                    </Text>
                    <Text as="div" weight="bold" size="4" className="organograma-modal-squad">
                      {squadDisplayName(selectedSquad)}
                    </Text>
                    <Text as="div" size="2" color="gray">
                      {selectedSquad.totalMembers} pessoa{selectedSquad.totalMembers === 1 ? '' : 's'}
                    </Text>
                  </Box>
                </Flex>
                <Dialog.Close>
                  <button type="button" className="organograma-modal-close">
                    <X size={18} />
                  </button>
                </Dialog.Close>
              </Flex>

              {membersByRole.length === 0 ? (
                <Text color="gray">Nenhum membro cadastrado nesta squad.</Text>
              ) : (
                <Box className="organograma-modal-body">
                  <Box className="organograma-modal-counts">
                    {membersByRole.map(({ role, members }) => (
                      <Box key={role} className="organograma-modal-count-item">
                        <Text as="div" size="7" weight="bold" className="organograma-modal-count-value">
                          {members.length}
                        </Text>
                        <Text as="div" size="2" color="gray" className="organograma-modal-count-label">
                          {role.toUpperCase()}
                        </Text>
                      </Box>
                    ))}
                  </Box>

                  <Box className="organograma-modal-list">
                    {membersByRole.map(({ role, members }) => (
                      <Box key={role} mb="4">
                        <Text as="div" size="2" weight="bold" className="organograma-modal-role-title">
                          {role.toUpperCase()}
                        </Text>
                        {members.map((m) => (
                          <Text as="div" key={m.user.id} size="3" className="organograma-modal-member">
                            {getUserLabel(m.user)}
                          </Text>
                        ))}
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
};

export default Organograma;
