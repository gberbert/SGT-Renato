import React, { useState, useEffect } from 'react';
import { subscribeToProjects, deleteProject, updateProject } from '../services/projectService';
import { Loader2, Plus, FolderGit2, Users, MoreVertical, Trash2, Edit2 } from 'lucide-react';
import { Button, Card, Flex, Text, Badge, Grid, DropdownMenu } from '@radix-ui/themes';
import NewProjectModal from './NewProjectModal';
import { useNavigate } from 'react-router-dom';
import { subscribeToProjectSquads } from '../services/squadService';
import { auth } from '../firebase';

const Projects = ({ userRole }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [globalSquads, setGlobalSquads] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = subscribeToProjects((data) => {
      setProjects(data);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    const unsubSquads = subscribeToProjectSquads('all', setGlobalSquads, console.error);

    return () => {
      unsubscribe();
      unsubSquads();
    };
  }, []);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (confirm("Deseja realmente excluir este projeto e todos os seus vínculos?")) {
      await deleteProject(id);
    }
  };

  const handleEdit = (e, project) => {
    e.stopPropagation();
    setEditingProject(project);
    setIsModalOpen(true);
  };

  const handleProjectClick = (projectId) => {
    navigate(`/projetos/${projectId}`);
  };

  if (loading) {
    return (
      <div className="view-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Loader2 className="spinner-icon" size={40} color="var(--primary)" />
      </div>
    );
  }

  return (
    <div className="view-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div className="welcome-banner" style={{ marginBottom: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text as="h1" size="6" weight="bold">Gestão de Projetos</Text>
          <Text as="p" size="3" color="gray">Organize seus tickets e times em workspaces separados.</Text>
        </div>
        {userRole === 'admin' && (
          <Button size="3" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} /> Novo Projeto
          </Button>
        )}
      </div>

      {(() => {
        const isLeader = userRole === 'squad_leader' && auth.currentUser;
        const allowedProjectIds = isLeader ? [...new Set(globalSquads.filter(s => s.leaderId === auth.currentUser.uid).map(s => s.projectId))] : [];
        const filteredProjects = isLeader ? projects.filter(p => allowedProjectIds.includes(p.id)) : projects;

        if (filteredProjects.length === 0) {
          return (
            <Card size="4" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <FolderGit2 size={48} color="var(--text-muted)" />
              <Text as="h2" size="5" weight="bold">Nenhum projeto encontrado</Text>
              <Text color="gray">
                {isLeader ? 'Você não é líder em nenhuma squad com projetos vinculados.' : 'Comece criando seu primeiro projeto para agrupar as demandas.'}
              </Text>
              {userRole === 'admin' && (
                <Button mt="3" onClick={() => setIsModalOpen(true)}>Criar Projeto</Button>
              )}
            </Card>
          );
        }

        return (
          <Grid columns={{ initial: '1', sm: '2', md: '3' }} gap="4">
            {filteredProjects.map(project => (
              <Card key={project.id} size="3" style={{ cursor: 'pointer' }} className="project-card" onClick={() => handleProjectClick(project.id)}>
              <Flex direction="column" gap="4" style={{ height: '100%' }}>
                <Flex justify="between" align="start">
                  <Flex align="center" gap="3">
                    <Flex align="center" justify="center" style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'var(--primary-dark)', color: 'white', fontWeight: 'bold' }}>
                      {project.key}
                    </Flex>
                    <Text as="h3" size="4" weight="bold">{project.name}</Text>
                  </Flex>
                  <Flex align="center" gap="2">
                    <Badge color="green" radius="full">{project.status}</Badge>
                    {userRole === 'admin' && (
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="1">
                            <MoreVertical size={16} />
                          </Button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content>
                          <DropdownMenu.Item onClick={(e) => handleEdit(e, project)}>
                            <Edit2 size={14} /> Editar Projeto
                          </DropdownMenu.Item>
                          <DropdownMenu.Item color="red" onClick={(e) => handleDelete(e, project.id)}>
                            <Trash2 size={14} /> Excluir Projeto
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Root>
                    )}
                  </Flex>
                </Flex>
                
                <Text color="gray" size="2" style={{ flexGrow: 1 }}>
                  {project.description || 'Sem descrição.'}
                </Text>

                <Flex align="center" gap="2" pt="3" style={{ borderTop: '1px solid var(--glass-border)' }}>
                  <Users size={16} color="var(--text-muted)" />
                  <Text size="2" color="gray">Líder: <Text weight="bold" color="indigo">{project.leaderName}</Text></Text>
                  </Flex>
                </Flex>
              </Card>
            ))}
          </Grid>
        );
      })()}

      <NewProjectModal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setEditingProject(null);
        }} 
        editingProject={editingProject}
      />
    </div>
  );
};

export default Projects;
