import React, { useState, useEffect } from 'react';
import { Dialog, Flex, Button, Text, Box, Select } from '@radix-ui/themes';
import { Loader2, Wand2 } from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import { generateFunctionalSpecification } from '../services/aiService';
import { saveSpecification } from '../services/specService';
import { subscribeToAISettings } from '../services/settingsService';
import { auth } from '../firebase';

import MDEditor from '@uiw/react-md-editor';

const SpecificationGeneratorModal = ({ isOpen, onClose, tickets, estimations, userRole, initialSpec }) => {
  const [parentId, setParentId] = useState('');
  const [requirements, setRequirements] = useState('');
  const [userAdjustments, setUserAdjustments] = useState('');
  const [currentMarkdown, setCurrentMarkdown] = useState('');
  const [aiConfig, setAiConfig] = useState(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialSpec) {
      setParentId(initialSpec.parentId || '');
      setCurrentMarkdown(initialSpec.markdownContent || '');
      setRequirements('');
      setUserAdjustments('');
    } else {
      setParentId('');
      setCurrentMarkdown('');
      setRequirements('');
      setUserAdjustments('');
    }
  }, [initialSpec, isOpen]);

  useEffect(() => {
    const unsub = subscribeToAISettings((data) => {
      if (data) {
        setAiConfig(data);
      }
    });
    return () => unsub();
  }, []);

  const handleGenerate = async () => {
    if (!parentId) {
      alert("Selecione uma estimativa para associar a especificação.");
      return;
    }
    if (!requirements || requirements === '<p></p>') {
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
      
      const title = `EF - ${parentEst?.ticketCode || 'Demanda'} - ${parentTicket?.title || 'Documento'}`;

      // Build enriched requirements string
      let enrichedRequirements = requirements;
      enrichedRequirements += `\n\n--- INFORMAÇÕES HERDADAS DA ESTIMATIVA PAI ---\n`;
      if (parentTicket) enrichedRequirements += `- Demanda Pai: ${parentTicket.code} - ${parentTicket.title}\n`;
      if (parentEst?.squad) enrichedRequirements += `- Squad Responsável: ${parentEst.squad}\n`;
      if (parentEst?.sistema) enrichedRequirements += `- Sistema Afetado: ${parentEst.sistema}\n`;
      if (parentEst?.components?.length) enrichedRequirements += `- Componentes Envolvidos: ${parentEst.components.join(', ')}\n`;
      if (parentEst?.details) enrichedRequirements += `- Detalhes da Estimativa: ${parentEst.details}\n`;

      const hasPrevious = !!currentMarkdown.trim();

      const markdownResponse = await generateFunctionalSpecification(
        aiConfig.geminiApiKey,
        aiConfig.efInitialPrompt || '',
        aiConfig.efModelTemplate || '',
        enrichedRequirements,
        hasPrevious ? currentMarkdown : null,
        hasPrevious ? userAdjustments : null
      );

      const executionStatus = markdownResponse && markdownResponse.trim() !== '' ? 'concluido' : 'pendente';

      await saveSpecification({
        id: initialSpec?.id,
        title,
        parentId,
        markdownContent: markdownResponse,
        executionStatus,
        authorId: auth.currentUser?.uid,
        authorName: auth.currentUser?.displayName || auth.currentUser?.email,
      });

      alert("Especificação Funcional gerada/atualizada com sucesso!");
      onClose();
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar especificação. Verifique o console.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDirectly = async () => {
    setIsSaving(true);
    try {
      const executionStatus = currentMarkdown && currentMarkdown.trim() !== '' ? 'concluido' : 'pendente';

      await saveSpecification({
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

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Content maxWidth="700px" style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <Dialog.Title>Nova Especificação Funcional (IA)</Dialog.Title>
        <Dialog.Description size="2" mb="4">
          Escreva os requisitos e deixe a inteligência artificial formatar a Especificação Funcional.
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

          {currentMarkdown ? (
            <>
              <Box pt="1">
                <Text as="div" size="2" mb="2" weight="bold">
                  Versão Atual (Edição Direta)
                </Text>
                <div data-color-mode="light">
                  <MDEditor
                    value={currentMarkdown}
                    onChange={setCurrentMarkdown}
                    height={350}
                  />
                </div>
              </Box>
              <Box pt="2">
                <Text as="div" size="2" mb="2" color="gray">
                  Solicite ajustes específicos para a IA reescrever a especificação (Opcional):
                </Text>
                <div style={{ border: '1px solid var(--gray-6)', borderRadius: 'var(--border-radius)' }}>
                  <RichTextEditor value={userAdjustments} onChange={setUserAdjustments} />
                </div>
              </Box>
            </>
          ) : (
            <Box pt="3">
              <Text as="div" size="2" mb="2" color="gray">
                Descreva o que o sistema deve fazer. Não se preocupe com formatação.
              </Text>
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
          <Button onClick={handleGenerate} disabled={isGenerating || isSaving || !parentId} size="3" style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', color: 'white' }}>
            {isGenerating ? <Loader2 size={18} className="spinner-icon" /> : <Wand2 size={18} />}
            {isGenerating ? "Gerando..." : currentMarkdown ? "Re-gerar com IA" : "Gerar Especificação"}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default SpecificationGeneratorModal;
