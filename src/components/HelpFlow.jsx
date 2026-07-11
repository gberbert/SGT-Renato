import React, { useState } from 'react';
import { Box, Flex, Text, Card, Dialog, Button, Heading } from '@radix-ui/themes';
import { FileText, ArrowRight, Play, CheckCircle2, Bot, Info, UserCheck, ShieldCheck, Calculator } from 'lucide-react';
import MermaidViewer from './MermaidViewer';
import './HelpFlow.css';

const FLOW_STEPS = [
  {
    id: 'criacao',
    title: 'Criação da Demanda',
    description: 'Cadastro inicial do Ticket no Backlog.',
    icon: <Play size={24} color="var(--indigo-9)" />,
    color: 'var(--indigo-9)',
    bgColor: 'var(--indigo-2)',
    uml: `
sequenceDiagram
    participant Requester as Solicitante
    participant System as SGT (Kanban)
    participant Backlog as Coluna Pendente
    Requester->>System: Preenche Título, Descrição, Prazo e Anexos
    System->>System: Gera Código Único (ex: DEM-123-ABC)
    System->>Backlog: Move Card para Pendente
    System-->>Requester: Confirmação de Criação
    `
  },
  {
    id: 'alocacao',
    title: 'Análise & Alocação',
    description: 'Líder analisa o Roadmap e atribui responsáveis.',
    icon: <UserCheck size={24} color="var(--orange-9)" />,
    color: 'var(--orange-9)',
    bgColor: 'var(--orange-2)',
    uml: `
sequenceDiagram
    participant Leader as Team Leader
    participant Roadmap as Visão Roadmap/Capacity
    participant Ticket as Demanda
    participant Dev as Desenvolvedor
    Leader->>Roadmap: Analisa disponibilidade do time
    Leader->>Ticket: Aloca Demanda ao Dev
    Ticket->>Ticket: Atualiza Squad ID e Status
    Ticket-->>Dev: Notifica (App/Email) sobre Atribuição
    Ticket->>Dev: Adiciona à fila "Minhas Atividades"
    `
  },
  {
    id: 'entregaveis_tshirt_est',
    title: 'Geração de T-Shirt e Estimativas',
    description: 'Criação de T-Shirt Size e Estimativa de Esforço baseada em regras.',
    icon: <Calculator size={24} color="var(--pink-9)" />,
    color: 'var(--pink-9)',
    bgColor: 'var(--pink-2)',
    uml: `
sequenceDiagram
    participant Dev as Desenvolvedor
    participant System as SGT (Regras)
    participant Output as Entregável
    Dev->>System: Preenche tamanho macro ou Componentes
    System->>System: Aplica regras de negócio e capacity
    System->>Output: Gera Documento Calculado
    Dev->>Output: Revisa e Confirma
    `
  },
  {
    id: 'entregaveis_ef_et',
    title: 'Geração de EF e ET (IA)',
    description: 'Criação de Especificação Funcional e Técnica via IA generativa.',
    icon: <Bot size={24} color="var(--purple-9)" />,
    color: 'var(--purple-9)',
    bgColor: 'var(--purple-2)',
    uml: `
sequenceDiagram
    participant Dev as Desenvolvedor
    participant SGT as Motor IA (SGT)
    participant GenAI as LLM (Gemini)
    participant Output as Entregável (EF/ET)
    Dev->>SGT: Cria prompt inicial com requisitos detalhados em linguagem natural ou markdown
    Dev->>SGT: Clica em "Gerar com IA"
    SGT->>SGT: Compila Contexto (Ticket, Prompt, Anexos)
    SGT->>GenAI: Envia Prompt Especializado
    GenAI-->>SGT: Retorna Markdown Formatado
    SGT->>Output: Salva Documento no Firestore
    Dev->>Output: Revisa e Edita manualmente (opcional)
    `
  },
  {
    id: 'revisao',
    title: 'Revisão e Aprovação',
    description: 'O Team Leader aprova os documentos.',
    icon: <ShieldCheck size={24} color="var(--cyan-9)" />,
    color: 'var(--cyan-9)',
    bgColor: 'var(--cyan-2)',
    uml: `
sequenceDiagram
    participant Dev as Desenvolvedor
    participant Output as Entregável
    participant Leader as Team Leader
    Dev->>Output: Clica em "Enviar para Revisão"
    Output->>Output: Atualiza status para "em_revisao"
    Output->>Leader: Aparece na aba "Pendentes" (Minhas Atividades)
    Leader->>Output: Revisa Conteúdo (PDF/Tela)
    alt Aprovado
        Leader->>Output: Clica "Aprovar"
        Output->>Output: Atualiza status para "concluido"
    else Reprovado (Ajustes)
        Leader->>Dev: Solicita correções off-band
    end
    `
  },
  {
    id: 'conclusao',
    title: 'Desenvolvimento e Conclusão',
    description: 'Avanço do Kanban e finalização do ciclo.',
    icon: <CheckCircle2 size={24} color="var(--green-9)" />,
    color: 'var(--green-9)',
    bgColor: 'var(--green-2)',
    uml: `
stateDiagram-v2
    [*] --> Pendente
    Pendente --> EmAndamento: Desenvolvimento Iniciado
    EmAndamento --> Homologacao: Testes e Validação
    Homologacao --> Concluido: Demanda Entregue
    Concluido --> [*]
    
    note right of EmAndamento
      Todas as especificações
      devem estar "Aprovadas"
    end note
    `
  }
];

export default function HelpFlow() {
  const [selectedStep, setSelectedStep] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleStepClick = (step) => {
    setSelectedStep(step);
    setIsModalOpen(true);
  };

  return (
    <div className="view-content help-flow-container">
      <div className="welcome-banner">
        <Flex justify="between" align="center">
          <Box>
            <Text as="h1" size="6" weight="bold">Ajuda & Processos</Text>
            <Text as="p" size="3" color="gray">
              Conheça o fluxo de vida de uma Demanda no SGT. Clique nas etapas para ver o UML detalhado.
            </Text>
          </Box>
          <Info size={32} color="var(--indigo-9)" opacity={0.8} />
        </Flex>
      </div>

      <Box className="flow-track-container" mt="6" p="6" style={{ backgroundColor: 'var(--gray-2)', borderRadius: '12px' }}>
        <Flex justify="center" align="stretch" wrap="wrap" className="flow-track">
          {FLOW_STEPS.map((step, index) => (
            <React.Fragment key={step.id}>
              <Card 
                className="flow-step-card" 
                onClick={() => handleStepClick(step)}
                style={{ 
                  cursor: 'pointer', 
                  flex: '1 1 180px', 
                  maxWidth: '220px',
                  transition: 'all 0.2s ease',
                  border: `1px solid ${step.color}40`
                }}
              >
                <Flex direction="column" align="center" gap="3" p="4" style={{ textAlign: 'center', height: '100%' }}>
                  <Box p="3" style={{ backgroundColor: step.bgColor, borderRadius: '50%' }}>
                    {step.icon}
                  </Box>
                  <Text weight="bold" size="3">{step.title}</Text>
                  <Text size="2" color="gray">{step.description}</Text>
                </Flex>
              </Card>

              {index < FLOW_STEPS.length - 1 && (
                <Flex align="center" justify="center" className="flow-arrow" style={{ padding: '0 12px' }}>
                  <ArrowRight size={24} color="var(--gray-8)" />
                </Flex>
              )}
            </React.Fragment>
          ))}
        </Flex>
      </Box>

      {/* MODAL DE DETALHE UML */}
      <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
        <Dialog.Content style={{ maxWidth: '800px', width: '90vw' }}>
          <Dialog.Title>
            <Flex align="center" gap="2">
              {selectedStep?.icon}
              <Text>{selectedStep?.title}</Text>
            </Flex>
          </Dialog.Title>
          <Dialog.Description size="2" mb="4" color="gray">
            Diagrama UML (Sequence / Activity) detalhando as interações lógicas do sistema.
          </Dialog.Description>

          <Box my="5">
            {selectedStep && <MermaidViewer chart={selectedStep.uml} />}
          </Box>

          <Flex justify="end" mt="4">
            <Dialog.Close>
              <Button variant="soft" color="gray">Fechar</Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

    </div>
  );
}
