import React, { useState, useEffect } from 'react';
import { Dialog, Flex, Button, Text, Box, Select } from '@radix-ui/themes';
import { Loader2, Wand2 } from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import { generateFunctionalSpecification } from '../services/aiService';
import { saveTechSpecification } from '../services/techSpecService';
import { subscribeToAISettings } from '../services/settingsService';
import { auth } from '../firebase';

import WysiwygMarkdownEditor from './WysiwygMarkdownEditor';

const TechSpecGeneratorModal = ({ isOpen, onClose, tickets, estimations, userRole, initialSpec }) => {
  const [parentId, setParentId] = useState('');
  const [requirements, setRequirements] = useState('');
  const [userAdjustments, setUserAdjustments] = useState('');
  const [currentMarkdown, setCurrentMarkdown] = useState('');
  const [aiConfig, setAiConfig] = useState(null);
  const [attachments, setAttachments] = useState([]);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditAIModalOpen, setIsEditAIModalOpen] = useState(false);

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
        
        if (file.type === 'application/pdf') {
          // Extrair apenas o base64
          const base64Data = result.split(',')[1];
          setAttachments(prev => [...prev, { name: file.name, mimeType: file.type, data: base64Data, text: null }]);
        } else {
          // Arquivos de texto (.txt, .md)
          setAttachments(prev => [...prev, { name: file.name, mimeType: file.type || 'text/plain', data: null, text: result }]);
        }
      };

      if (file.type === 'application/pdf') {
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
      
      const title = `ET - ${parentEst?.ticketCode || 'Demanda'} - ${parentTicket?.title || 'Documento'}`;

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
        enrichedRequirements,
        hasPrevious ? currentMarkdown : null,
        hasPrevious ? userAdjustments : null,
        attachments
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

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Content maxWidth="700px" style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }} onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
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
            <Text color="gray" size="1" mb="2" as="div">Faça upload de PDFs, TXTs ou MDs para a IA ler e usar como contexto adicional.</Text>
            
            <Flex gap="2" align="center" mb="2">
              <Button variant="soft" asChild>
                <label style={{ cursor: 'pointer' }}>
                  <Text>Anexar Arquivos</Text>
                  <input type="file" multiple accept=".pdf,.txt,.md" style={{ display: 'none' }} onChange={handleFileChange} />
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
              <Box pt="1">
                <Text as="div" size="2" mb="2" weight="bold">
                  Versão Atual (Edição Direta)
                </Text>
                <div data-color-mode="light" style={{ display: 'flex', flexDirection: 'column' }}>
                  <WysiwygMarkdownEditor
                    content={currentMarkdown}
                    onChange={setCurrentMarkdown}
                    height="50vh"
                  />
                </div>
              </Box>
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
    </Dialog.Root>
  );
};

export default TechSpecGeneratorModal;
