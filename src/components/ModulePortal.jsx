import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Flex, Text, Card, Button } from '@radix-ui/themes';
import { KanbanSquare, Network, LogOut, ArrowRight } from 'lucide-react';
import { MODULES, setActiveModule } from '../utils/moduleSession';

const MODULE_OPTIONS = [
  {
    id: MODULES.GESTAO,
    title: 'Gestão de Demandas',
    description: 'Kanban, roadmap, estimativas, especificações e planejamento de capacidade.',
    path: '/',
    icon: KanbanSquare,
    accent: 'var(--primary)',
    iconBg: 'rgba(99, 102, 241, 0.12)',
  },
  {
    id: MODULES.OPERACAO,
    title: 'Operação AMS',
    description: 'Visão integrada da operação AMS. Módulo em evolução para importação futura.',
    path: '/operacao',
    icon: Network,
    accent: 'var(--info)',
    iconBg: 'rgba(59, 130, 246, 0.12)',
  },
];

const ModulePortal = ({ user, handleLogout }) => {
  const navigate = useNavigate();

  const handleSelect = (option) => {
    setActiveModule(option.id);
    navigate(option.path);
  };

  return (
    <div className="module-portal-page">
      <Box className="module-portal-shell glass-panel">
        <Flex direction="column" align="center" gap="2" className="module-portal-header">
          <KanbanSquare size={40} color="var(--primary)" />
          <Text size="6" weight="bold" align="center">SGT — Plataforma AMS</Text>
          <Text size="2" color="gray" align="center">
            Escolha o módulo que deseja acessar
          </Text>
          {user?.email && (
            <Text size="1" color="gray" align="center">
              Conectado como {user.email}
            </Text>
          )}
        </Flex>

        <div className="module-portal-grid">
          {MODULE_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <Card
                key={option.id}
                className="module-portal-card glass-panel"
                onClick={() => handleSelect(option)}
              >
                <Flex direction="column" align="center" gap="4" className="module-portal-card-inner">
                  <Box className="module-portal-icon" style={{ background: option.iconBg, color: option.accent }}>
                    <Icon size={28} />
                  </Box>
                  <Flex direction="column" align="center" gap="2" className="module-portal-card-copy">
                    <Text size="4" weight="bold" align="center">{option.title}</Text>
                    <Text size="2" color="gray" align="center">{option.description}</Text>
                  </Flex>
                  <Button variant="soft" className="module-portal-card-action">
                    Acessar <ArrowRight size={16} />
                  </Button>
                </Flex>
              </Card>
            );
          })}
        </div>

        <Flex justify="center" className="module-portal-footer">
          <Button variant="ghost" color="gray" onClick={handleLogout}>
            <LogOut size={16} /> Sair
          </Button>
        </Flex>
      </Box>

      <style>{`
        .module-portal-page {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          box-sizing: border-box;
          background: var(--bg-base);
          background-image: radial-gradient(circle at top right, rgba(99, 102, 241, 0.15), transparent 400px);
        }
        .module-portal-shell {
          width: 100%;
          max-width: 760px;
          margin: 0 auto;
          padding: 40px 32px;
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .module-portal-header {
          width: 100%;
          max-width: 520px;
          margin-bottom: 32px;
          text-align: center;
        }
        .module-portal-grid {
          width: 100%;
          max-width: 640px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px;
          justify-content: center;
          align-items: stretch;
        }
        .module-portal-card {
          cursor: pointer;
          border: 1px solid var(--glass-border);
          transition: border-color 0.2s ease, transform 0.2s ease;
          height: 100%;
        }
        .module-portal-card:hover {
          border-color: rgba(99, 102, 241, 0.45) !important;
          transform: translateY(-2px);
        }
        .module-portal-card-inner {
          padding: 28px 20px;
          height: 100%;
          text-align: center;
        }
        .module-portal-icon {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .module-portal-card-copy {
          width: 100%;
          flex: 1;
        }
        .module-portal-card-action {
          margin-top: auto;
        }
        .module-portal-footer {
          width: 100%;
          margin-top: 28px;
        }
        @media (max-width: 640px) {
          .module-portal-shell {
            padding: 28px 20px;
          }
          .module-portal-grid {
            grid-template-columns: 1fr;
            max-width: 360px;
          }
        }
      `}</style>
    </div>
  );
};

export default ModulePortal;
