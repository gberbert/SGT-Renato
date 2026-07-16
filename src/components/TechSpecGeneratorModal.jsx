import React, { useState, useEffect } from 'react';
import { Dialog, Flex, Button, Text, Box, Select, Grid, Heading, Callout, Checkbox } from '@radix-ui/themes';
import { Loader2, Wand2, Info, Copy, CheckCircle2, AlertTriangle } from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import { generateFunctionalSpecification } from '../services/aiService';
import { saveTechSpecification } from '../services/techSpecService';
import { subscribeToAISettings } from '../services/settingsService';
import { auth } from '../firebase';

import WysiwygMarkdownEditor from './WysiwygMarkdownEditor';
import CpflPdfTemplate from './CpflPdfTemplate';

const TechSpecGeneratorModal = ({ isOpen, onClose, tickets, estimations, userRole, initialSpec, projects = [], squads = [] }) => {
  const [parentId, setParentId] = useState('');
  const [requirements, setRequirements] = useState('');
  const [userAdjustments, setUserAdjustments] = useState('');
  const [currentMarkdown, setCurrentMarkdown] = useState('');
  const [aiConfig, setAiConfig] = useState(null);
  const [attachments, setAttachments] = useState([]);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditAIModalOpen, setIsEditAIModalOpen] = useState(false);
  const [isPromptHelperOpen, setIsPromptHelperOpen] = useState(false);
  const [topicStatus, setTopicStatus] = useState([]); // Array of { name, status }

  useEffect(() => {
    if (initialSpec) {
      setParentId(initialSpec.parentId || '');
      setCurrentMarkdown(initialSpec.markdownContent || '');
      setRequirements('');
      setUserAdjustments('');
      setAttachments([]);
    } else {
      setParentId('');
      setCurrentMarkdown('');
      setRequirements('');
      setUserAdjustments('');
      setAttachments([]);
    }
  }, [initialSpec, isOpen]);

  // Real-time Checklist Validation (ET version)
  useEffect(() => {
    if (currentMarkdown) {
      const expectedTopics = [
        "Objetivo",
        "Visão técnica da solução",
        "Arquitetura",
        "Detalhamento das alterações técnicas",
        "Dados e banco de dados",
        "Estratégia de testes técnicos",
        "Impactos, riscos e dependências técnicas",
        "Referências e anexos técnicos",
        "Glossário técnico"
      ];
      
      const lines = currentMarkdown.split('\n');
      
      const statusMap = expectedTopics.map(topicName => {
         // Encontrar o tópico no markdown (ignorando case e espaços)
         const topicRegex = new RegExp(`^#+\\s*(?:\\d+\\.)?\\s*${topicName.replace(/[.*+?^$\\{\\}()|[\\]\\\\]/g, '\\\\$&')}`, 'i');
         const topicIndex = lines.findIndex(line => line.match(topicRegex));
         
         if (topicIndex === -1) {
           return { name: topicName, status: 'ausente' };
         }
         
         // Olhar o conteúdo até o próximo tópico
         let hasPending = false;
         for (let i = topicIndex + 1; i < lines.length; i++) {
            if (lines[i].startsWith('#')) break; // Próximo tópico
            if (lines[i].includes('[PENDENTE: Informação técnica ausente no requisito original]')) {
              hasPending = true;
              break;
            }
         }
         
         return { name: topicName, status: hasPending ? 'pendente' : 'concluido' };
      });
      
      setTopicStatus(statusMap);
    } else {
      setTopicStatus([]);
    }
  }, [currentMarkdown]);

  useEffect(() => {
    const unsub = subscribeToAISettings((data) => {
      if (data) {
        setAiConfig(data);
      }
    });
    return () => unsub();
  }, []);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    
    files.forEach(file => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const result = event.target.result;
        
        if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
          const base64Data = result.split(',')[1];
          setAttachments(prev => [...prev, { name: file.name, mimeType: file.type, data: base64Data, text: null }]);
        } else {
          setAttachments(prev => [...prev, { name: file.name, mimeType: file.type || 'text/plain', data: null, text: result }]);
        }
      };

      if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    });
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (!parentId) {
      alert("Selecione uma estimativa para associar a especificação.");
      return;
    }
    const hasPrevious = !!currentMarkdown?.trim();

    if (!hasPrevious && (!requirements || requirements === '<p></p>' || requirements === '<p><br></p>')) {
      alert("Descreva os requisitos antes de gerar.");
      return;
    }
    if (!aiConfig?.geminiApiKey) {
      alert("A API Key do Gemini não está configurada nas Opções.");
      return;
    }

    setIsGenerating(true);
    try {
      const parentEst = estimations.find(e => e.id === parentId);
      const parentTicket = tickets.find(t => t.id === parentEst?.ticketId);
      
      const title = `ET - ${parentEst?.ticketCode || 'Demanda'} - ${parentTicket?.title || 'Documento'}`;

      let enrichedRequirements = requirements;
      enrichedRequirements += `\n\n--- INFORMAÇÕES HERDADAS DA ESTIMATIVA PAI ---\n`;
      if (parentTicket) enrichedRequirements += `- Demanda Pai: ${parentTicket.code} - ${parentTicket.title}\n`;
      if (parentEst?.squad) enrichedRequirements += `- Squad Responsável: ${parentEst.squad}\n`;
      if (parentEst?.sistema) enrichedRequirements += `- Sistema Afetado: ${parentEst.sistema}\n`;
      if (parentEst?.components?.length) enrichedRequirements += `- Componentes Envolvidos: ${parentEst.components.join(', ')}\n`;
      if (parentEst?.details) enrichedRequirements += `- Detalhes da Estimativa: ${parentEst.details}\n`;

      const markdownResponse = await generateFunctionalSpecification(
        aiConfig.geminiApiKey,
        aiConfig.etInitialPrompt || '',
        enrichedRequirements,
        hasPrevious ? currentMarkdown : null,
        hasPrevious ? userAdjustments : null,
        attachments,
        'ET'
      );

      const executionStatus = markdownResponse && markdownResponse.trim() !== '' ? 'concluido' : 'pendente';

      await saveTechSpecification({
        id: initialSpec?.id,
        title,
        parentId,
        markdownContent: markdownResponse,
        executionStatus,
        authorId: auth.currentUser?.uid,
        authorName: auth.currentUser?.displayName || auth.currentUser?.email,
      });

      alert("Especificação Técnica gerada/atualizada com sucesso!");
      onClose();
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar especificação técnica. Verifique o console.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDirectly = async () => {
    setIsSaving(true);
    try {
      const executionStatus = currentMarkdown && currentMarkdown.trim() !== '' ? 'concluido' : 'pendente';

      await saveTechSpecification({
        id: initialSpec?.id,
        parentId,
        markdownContent: currentMarkdown,
        executionStatus,
      });
      alert("Especificação salva com sucesso!");
      onClose();
    } catch (err) {
      alert("Erro ao salvar especificação diretamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const copyPromptTemplate = () => {
    const template = `Por favor, atue como um Arquiteto de Software Sênior. Estou prestes a criar uma Especificação Técnica e preciso que você me ajude a extrair, organizar e detalhar todas as informações necessárias baseadas no contexto que vou te fornecer.

O documento final deverá OBRIGATORIAMENTE conter informações claras e objetivas para os 9 tópicos abaixo. Se faltar informação para preencher algum, me pergunte antes de gerar o documento:
1. Objetivo (Detalhar a solução técnica descrevendo arquitetura, componentes, integrações, alterações, dados, etc)
2. Visão técnica da solução (Solução técnica proposta de forma objetiva, sem regras funcionais)
3. Arquitetura (Registrar arquitetura, componentes, pipelines. Usar mermaid para desenhos)
4. Detalhamento das alterações técnicas (Alterações em frontend, backend/serviços, jobs, relatórios, logs, tratamento de erro)
5. Dados e banco de dados (Bancos de dados, Tabelas, Procedures afetados)
6. Estratégia de testes técnicos (Unitário, Integração, API, Performance, Segurança, Regressão)
7. Impactos, riscos e dependências técnicas
8. Referências e anexos técnicos
9. Glossário técnico

Faça-me perguntas se alguma dessas informações estiver faltando no meu contexto. Assim que eu fornecer tudo, gere um rascunho completo cobrindo todos esses 9 pontos.`;
    navigator.clipboard.writeText(template);
    alert('Prompt copiado para a área de transferência! Cole no ChatGPT ou Claude.');
  };

  const selectedEstimation = estimations?.find(e => e.id === parentId);
  const selectedTicket = tickets?.find(t => t.id === selectedEstimation?.ticketId);
  const selectedProject = projects?.find(p => p.id === selectedTicket?.projectId);
  const selectedSquads = (selectedTicket?.squadIds && selectedTicket?.squadIds.length > 0)
    ? selectedTicket.squadIds.map(id => squads?.find(s => s.id === id)).filter(Boolean)
    : [squads?.find(s => s.id === selectedTicket?.squadId)].filter(Boolean);

  const mockSpecData = {
    cliente: selectedProject?.cliente || 'CPFL',
    projeto: selectedTicket?.title || selectedProject?.name || '',
    demandaId: selectedTicket?.code || selectedEstimation?.ticketCode || '',
    demandaTitle: initialSpec?.title?.replace(/^(EF - |ET - )/, '') || 'Nova Especificação',
    sistema: (selectedTicket?.associatedSystems?.map(s => s.system).join(', ') || selectedTicket?.system) || selectedEstimation?.sistema || '',
    torre: selectedProject?.name || '',
    empresas: 'CPFL',
    versao: '1.0',
    data: new Date().toLocaleDateString('pt-BR'),
    autor: auth.currentUser?.displayName || 'Desconhecido',
    status: 'Em validação',
    aprovador: ''
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Content maxWidth={currentMarkdown ? "1400px" : "700px"} style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh', position: 'relative', overflow: 'hidden' }} onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        {isGenerating && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255, 255, 255, 0.9)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 size={48} color="var(--indigo-9)" className="spinner-icon" style={{ marginBottom: '16px', animation: 'spin 1s linear infinite' }} />
            <Heading size="5" mb="2" style={{ color: 'var(--indigo-9)' }}>A Inteligência Artificial está trabalhando...</Heading>
            <Text size="3" color="gray">Escrevendo a Especificação Técnica, isso pode levar alguns segundos.</Text>
            
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}
        <Dialog.Title>Nova Especificação Técnica (IA)</Dialog.Title>
        <Dialog.Description size="2" mb="4">
          Escreva os requisitos e deixe a inteligência artificial formatar a Especificação Técnica.
        </Dialog.Description>

        <Flex direction="column" gap="4" style={{ flexGrow: 1, overflowY: 'auto' }}>
          <label>
            <Text as="div" size="2" mb="1" weight="bold">Vincular à Estimativa</Text>
            <Select.Root value={parentId} onValueChange={setParentId} disabled={!!initialSpec}>
              <Select.Trigger style={{ width: '100%' }} placeholder="Selecione a estimativa pai" />
              <Select.Content>
                {estimations.map(e => {
                  const parentTicket = tickets.find(t => t.id === e.ticketId);
                  return (
                    <Select.Item key={e.id} value={e.id}>
                      {e.ticketCode} {parentTicket ? `- ${parentTicket.title}` : ''}
                    </Select.Item>
                  );
                })}
              </Select.Content>
            </Select.Root>
          </label>

          <Box>
            <Text as="div" size="2" mb="1" weight="bold">Documentos de Referência (Opcional)</Text>
            <Text color="gray" size="1" mb="2" as="div">Faça upload de PDFs, Imagens, TXTs ou MDs para a IA ler e usar como contexto adicional.</Text>
            
            <Flex gap="2" align="center" mb="2">
              <Button variant="soft" asChild>
                <label style={{ cursor: 'pointer' }}>
                  <Text>Anexar Arquivos</Text>
                  <input type="file" multiple accept=".pdf,.txt,.md,image/*" style={{ display: 'none' }} onChange={handleFileChange} />
                </label>
              </Button>
            </Flex>

            {attachments.length > 0 && (
              <Flex gap="2" wrap="wrap" mt="2">
                {attachments.map((att, idx) => (
                  <Flex key={idx} align="center" gap="1" style={{ padding: '4px 8px', backgroundColor: 'var(--gray-3)', borderRadius: '6px' }}>
                    <Text size="1" weight="bold">{att.name}</Text>
                    <div onClick={() => removeAttachment(idx)} style={{ cursor: 'pointer', marginLeft: '4px', color: 'var(--danger)' }}>x</div>
                  </Flex>
                ))}
              </Flex>
            )}
          </Box>

          {currentMarkdown ? (
            <>
              {topicStatus.length > 0 && (
                <Box mb="3" p="3" style={{ backgroundColor: 'var(--gray-2)', border: '1px solid var(--gray-5)', borderRadius: '6px' }}>
                  <Flex align="center" gap="2" mb="3">
                    <CheckCircle2 size={18} color="var(--indigo-9)" />
                    <Text size="3" weight="bold">Checklist de Tópicos Obrigatórios</Text>
                  </Flex>
                  <Grid columns="2" gapX="4" gapY="2">
                    {topicStatus.map((topic, idx) => (
                      <Flex key={idx} align="center" gap="2">
                        {topic.status === 'concluido' ? (
                           <CheckCircle2 size={16} color="var(--green-9)" />
                        ) : topic.status === 'pendente' ? (
                           <AlertTriangle size={16} color="var(--amber-9)" />
                        ) : (
                           <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '1px solid var(--red-9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                             <Text size="1" color="red" style={{ lineHeight: 1 }}>x</Text>
                           </div>
                        )}
                        <Text size="2" color={topic.status === 'concluido' ? 'gray' : topic.status === 'pendente' ? 'amber' : 'red'} style={{ textDecoration: topic.status === 'concluido' ? 'line-through' : 'none' }}>
                          {idx + 1}. {topic.name}
                        </Text>
                      </Flex>
                    ))}
                  </Grid>
                </Box>
              )}
              <Grid columns="2" gap="4">
                {/* Lado Esquerdo - Editor */}
                <Flex direction="column" gap="3">
                  <Box pt="1">
                    <Text as="div" size="2" mb="2" weight="bold">
                      Versão Atual (Edição Direta)
                    </Text>
                    <div data-color-mode="light" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                      <WysiwygMarkdownEditor
                        content={currentMarkdown}
                        onChange={setCurrentMarkdown}
                        height="60vh"
                      />
                    </div>
                  </Box>
                </Flex>

                {/* Lado Direito - Preview PDF */}
                <Box style={{ maxHeight: '600px', overflowY: 'auto', backgroundColor: '#e9ecef', border: '1px solid #ccc', borderRadius: '4px', padding: '10px' }}>
                  <Heading size="3" mb="3" style={{ color: '#555', textAlign: 'center' }}>Pré-visualização do Documento</Heading>
                  <div style={{ transform: 'scale(0.85)', transformOrigin: 'top center', backgroundColor: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', margin: '0 auto', width: 'fit-content', minWidth: '800px', pointerEvents: 'none' }}>
                     <CpflPdfTemplate 
                        specData={mockSpecData} 
                        markdownContent={currentMarkdown}
                        project={selectedProject}
                     />
                  </div>
                </Box>
              </Grid>
            </>
          ) : (
            <Box pt="3">
              <Flex justify="between" align="center" mb="2">
                <Text as="div" size="2" color="gray">
                  Descreva o que o sistema deve fazer. Não se preocupe com formatação.
                </Text>
                <Button variant="soft" color="indigo" size="1" onClick={() => setIsPromptHelperOpen(true)}>
                  <Info size={14} /> Usar IA Externa
                </Button>
              </Flex>
              <div style={{ border: '1px solid var(--gray-6)', borderRadius: 'var(--border-radius)' }}>
                <RichTextEditor value={requirements} onChange={setRequirements} />
              </div>
            </Box>
          )}
        </Flex>

        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray" disabled={isGenerating || isSaving}>Cancelar</Button>
          </Dialog.Close>
          {currentMarkdown && (
            <Button variant="soft" color="blue" onClick={handleSaveDirectly} disabled={isSaving || isGenerating}>
              {isSaving ? <Loader2 size={18} className="spinner-icon" /> : "Salvar Edição Manual"}
            </Button>
          )}
          <Button onClick={() => currentMarkdown ? setIsEditAIModalOpen(true) : handleGenerate()} disabled={isGenerating || isSaving || !parentId} size="3" style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', color: 'white' }}>
            {isGenerating ? <Loader2 size={18} className="spinner-icon" /> : <Wand2 size={18} />}
            {isGenerating ? "Processando..." : currentMarkdown ? "Editar com IA" : "Gerar Especificação"}
          </Button>
        </Flex>
      </Dialog.Content>

      <Dialog.Root open={isEditAIModalOpen} onOpenChange={setIsEditAIModalOpen}>
        <Dialog.Content maxWidth="600px" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <Dialog.Title>Editar com IA</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Descreva o que você gostaria que a IA alterasse, adicionasse ou removesse da especificação atual.
          </Dialog.Description>
          <div style={{ border: '1px solid var(--gray-6)', borderRadius: 'var(--border-radius)', marginBottom: '16px' }}>
             <RichTextEditor value={userAdjustments} onChange={setUserAdjustments} minHeight="120px" />
          </div>
          <Flex gap="3" justify="end">
            <Button variant="soft" color="gray" onClick={() => setIsEditAIModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
                setIsEditAIModalOpen(false);
                handleGenerate();
            }} style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', color: 'white' }}>
              <Wand2 size={16} /> Ajustar com IA
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* Prompt Helper Modal */}
      <Dialog.Root open={isPromptHelperOpen} onOpenChange={setIsPromptHelperOpen}>
        <Dialog.Content maxWidth="650px" onInteractOutside={(e) => e.preventDefault()}>
          <Dialog.Title>Preparar Demanda com IA Externa</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Para garantir que a Especificação Técnica não fique com tópicos pendentes, você pode usar ferramentas como <strong>ChatGPT</strong> ou <strong>Claude</strong> para preparar e refinar a demanda antes de colar aqui.
          </Dialog.Description>
          
          <Box p="4" style={{ backgroundColor: 'var(--gray-3)', borderRadius: 'var(--border-radius)', fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'pre-wrap' }}>
            Por favor, atue como um Arquiteto de Software Sênior. Estou prestes a criar uma Especificação Técnica e preciso que você me ajude a extrair, organizar e detalhar todas as informações necessárias baseadas no contexto que vou te fornecer.
            {'\n\n'}
            O documento final deverá OBRIGATORIAMENTE conter informações claras e objetivas para os 9 tópicos abaixo. Se faltar informação para preencher algum, me pergunte antes de gerar o documento:
            {'\n'}1. Objetivo
            {'\n'}2. Visão técnica da solução
            {'\n'}3. Arquitetura (Registrar arquitetura, componentes, pipelines. Usar mermaid para desenhos)
            {'\n'}4. Detalhamento das alterações técnicas (Alterações em frontend, backend/serviços, jobs, relatórios, logs, tratamento de erro)
            {'\n'}5. Dados e banco de dados
            {'\n'}6. Estratégia de testes técnicos (Unitário, Integração, API, Performance, Segurança, Regressão)
            {'\n'}7. Impactos, riscos e dependências técnicas
            {'\n'}8. Referências e anexos técnicos
            {'\n'}9. Glossário técnico
            {'\n\n'}
            Faça-me perguntas se alguma dessas informações estiver faltando no meu contexto.
          </Box>

          <Flex gap="3" mt="4" justify="end">
            <Button variant="soft" color="gray" onClick={() => setIsPromptHelperOpen(false)}>Fechar</Button>
            <Button onClick={copyPromptTemplate} style={{ background: 'linear-gradient(90deg, #10b981, #059669)', color: 'white' }}>
              <Copy size={16} /> Copiar Prompt
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Dialog.Root>
  );
};

export default TechSpecGeneratorModal;
