import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Plus, ArrowLeft, Users, FolderGit2 } from 'lucide-react';
import { Button, Card, Flex, Text, Grid, Dialog, TextField, Box } from '@radix-ui/themes';
import { subscribeToProjects } from '../services/projectService';
import { subscribeToSystems } from '../services/settingsService';
import { subscribeToProjectSquads, createSquad } from '../services/squadService';
import { auth } from '../firebase';
import SquadDetailsModal from './SquadDetailsModal';

const ProjectDetails = ({ userRole }) => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  
  const [project, setProject] = useState(null);
  const [squads, setSquads] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isNewSquadModalOpen, setIsNewSquadModalOpen] = useState(false);
  const [newSquadName, setNewSquadName] = useState('');
  const [newSquadDescription, setNewSquadDescription] = useState('');
  const [newSquadSystemIds, setNewSquadSystemIds] = useState([]);
  const [savingSquad, setSavingSquad] = useState(false);

  const [systems, setSystems] = useState([]);

  const [selectedSquad, setSelectedSquad] = useState(null);

  useEffect(() => {
    const unsubProjects = subscribeToProjects((data) => {
      const found = data.find(p => p.id === projectId);
      setProject(found);
      if (!found) setLoading(false);
    }, console.error);

    const unsubSquads = subscribeToProjectSquads(projectId, (data) => {
      setSquads(data);
      setLoading(false);
    }, console.error);

    const unsubSystems = subscribeToSystems((data) => {
      setSystems(data);
    });

    return () => {
      unsubProjects();
      unsubSquads();
      unsubSystems();
    };
  }, [projectId]);

  const handleCreateSquad = async (e) => {
    e.preventDefault();
    if (!newSquadName.trim()) return;
    setSavingSquad(true);
    try {
      await createSquad({
        projectId,
        name: newSquadName,
        description: newSquadDescription,
        systemIds: newSquadSystemIds,
        users: []
      });
      setIsNewSquadModalOpen(false);
      setNewSquadName('');
      setNewSquadDescription('');
      setNewSquadSystemIds([]);
    } catch (error) {
      alert("Erro ao criar squad.");
    } finally {
      setSavingSquad(false);
    }
  };

  if (loading) {
    return (
      <div className="view-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Loader2 className="spinner-icon" size={40} color="var(--primary)" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="view-content">
        <Text>Projeto não encontrado.</Text>
        <Button onClick={() => navigate('/projetos')}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="view-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div className="welcome-banner" style={{ marginBottom: 0 }}>
        <Flex justify="between" align="center">
          <Flex align="center" gap="3">
            <Button variant="soft" color="gray" onClick={() => navigate('/projetos')}>
              <ArrowLeft size={16} /> Voltar
            </Button>
            <Box>
              <Text as="h1" size="6" weight="bold">{project.name}</Text>
              <Text as="p" size="3" color="gray">Gestão de Squads do projeto.</Text>
            </Box>
          </Flex>
          {userRole === 'admin' && (
            <Button size="3" onClick={() => setIsNewSquadModalOpen(true)}>
              <Plus size={18} /> Nova Squad
            </Button>
          )}
        </Flex>
      </div>

      {(() => {
        const isLeader = userRole === 'squad_leader' && auth.currentUser;
        const filteredSquads = isLeader ? squads.filter(s => s.leaderId === auth.currentUser.uid) : squads;

        if (filteredSquads.length === 0) {
          return (
            <Card size="4" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <FolderGit2 size={48} color="var(--text-muted)" />
              <Text as="h2" size="5" weight="bold">Nenhuma squad disponível</Text>
              <Text color="gray">
                {isLeader ? 'Você não é líder de nenhuma squad neste projeto.' : 'Organize seu time em squads específicas neste projeto.'}
              </Text>
              {userRole === 'admin' && (
                <Button mt="3" onClick={() => setIsNewSquadModalOpen(true)}>Criar Squad</Button>
              )}
            </Card>
          );
        }

        return (
          <Grid columns={{ initial: '1', sm: '2', md: '3' }} gap="4">
            {filteredSquads.map(squad => (
              <Card key={squad.id} size="3" style={{ cursor: 'pointer' }} className="project-card" onClick={() => setSelectedSquad(squad)}>
              <Flex direction="column" gap="4" style={{ height: '100%' }}>
                <Flex align="center" gap="3">
                  <Flex align="center" justify="center" style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'var(--primary-dark)', color: 'white', fontWeight: 'bold' }}>
                    <Users size={20} />
                  </Flex>
                  <Text as="h3" size="4" weight="bold">{squad.name}</Text>
                </Flex>
                
                <Text color="gray" size="2" style={{ flexGrow: 1 }}>
                  {squad.description || 'Sem descrição.'}
                </Text>

                <Flex align="center" gap="2" pt="3" style={{ borderTop: '1px solid var(--glass-border)' }}>
                  <Text size="2" color="gray" weight="bold">{squad.users?.length || 0} Membros</Text>
                </Flex>
              </Flex>
            </Card>
          ))}
        </Grid>
        );
      })()}

      {/* NEW SQUAD MODAL */}
      <Dialog.Root open={isNewSquadModalOpen} onOpenChange={setIsNewSquadModalOpen}>
        <Dialog.Content maxWidth="400px">
          <Dialog.Title>Nova Squad</Dialog.Title>
          <form onSubmit={handleCreateSquad}>
            <Flex direction="column" gap="3">
              <label>
                <Text as="div" size="2" mb="1" weight="bold">Nome da Squad</Text>
                <TextField.Root 
                  required
                  value={newSquadName} 
                  onChange={(e) => setNewSquadName(e.target.value)} 
                  placeholder="Ex: Squad Frontend" 
                />
              </label>
              <label>
                <Text as="div" size="2" mb="1" weight="bold">Descrição</Text>
                <TextField.Root 
                  value={newSquadDescription} 
                  onChange={(e) => setNewSquadDescription(e.target.value)} 
                  placeholder="Ex: Responsável pelos aplicativos" 
                />
              </label>
              <Box>
                <Text as="div" size="2" mb="2" weight="bold">Sistemas Associados</Text>
                <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--gray-6)', padding: '8px', borderRadius: '4px' }}>
                  {systems.length === 0 ? <Text size="1" color="gray">Nenhum sistema cadastrado.</Text> : (
                    <Flex direction="column" gap="2">
                      {systems.map(sys => (
                        <label key={sys.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input 
                            type="checkbox" 
                            checked={newSquadSystemIds.includes(sys.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewSquadSystemIds([...newSquadSystemIds, sys.id]);
                              } else {
                                setNewSquadSystemIds(newSquadSystemIds.filter(id => id !== sys.id));
                              }
                            }}
                          />
                          <Text size="2">{sys.name}</Text>
                        </label>
                      ))}
                    </Flex>
                  )}
                </div>
              </Box>
            </Flex>
            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray" type="button">Cancelar</Button>
              </Dialog.Close>
              <Button type="submit" disabled={savingSquad}>
                {savingSquad ? <Loader2 size={14} className="spinner-icon"/> : "Criar Squad"}
              </Button>
            </Flex>
          </form>
        </Dialog.Content>
      </Dialog.Root>

      {/* SQUAD DETAILS / USERS MODAL */}
      {selectedSquad && (
        <SquadDetailsModal 
          isOpen={!!selectedSquad} 
          onClose={() => setSelectedSquad(null)} 
          squad={selectedSquad} 
          userRole={userRole}
        />
      )}
    </div>
  );
};

export default ProjectDetails;
