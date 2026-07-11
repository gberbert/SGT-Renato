import React, { useState, useEffect, useRef } from 'react';
import { Dialog, Flex, Button, IconButton } from '@radix-ui/themes';
import { Save, Download, X } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import { saveSpecification } from '../services/specService';
import PdfExportWizard from './PdfExportWizard';
import CodeRenderer from './CodeRenderer';

const SpecificationViewerModal = ({ isOpen, onClose, spec, estimations = [], tickets = [], projects = [], squads = [] }) => {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [exportWizardOpen, setExportWizardOpen] = useState(false);

  useEffect(() => {
    if (spec) {
      setContent(spec.markdownContent || '');
    }
  }, [spec]);

  const handleSave = async () => {
    if (!spec) return;
    setIsSaving(true);
    try {
      await saveSpecification({
        ...spec,
        markdownContent: content
      });
      alert('Especificação atualizada com sucesso!');
    } catch (error) {
      alert('Erro ao atualizar a especificação.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPDF = () => {
    setExportWizardOpen(true);
  };

  if (!spec) return null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Content maxWidth="1000px" style={{ height: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }} onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        {/* Header toolbar */}
        <Flex justify="between" align="center" style={{ padding: '16px', borderBottom: '1px solid var(--gray-5)', background: 'var(--panel-solid)' }}>
          <div style={{ fontWeight: 'bold', fontSize: '18px' }}>{spec.title}</div>
          <Flex gap="3">
            <Button variant="soft" onClick={handleSave} disabled={isSaving || content === spec.markdownContent}>
              <Save size={16} /> Salvar
            </Button>
            <Button variant="solid" onClick={handleDownloadPDF} style={{ background: 'linear-gradient(90deg, #0055a4, #0070c0)', color: 'white' }}>
              <Download size={16} /> Exportar PDF Padrão
            </Button>
            <IconButton variant="ghost" color="gray" onClick={onClose}>
              <X size={20} />
            </IconButton>
          </Flex>
        </Flex>

        {/* Editor Area */}
        <div style={{ flexGrow: 1, overflow: 'auto' }} data-color-mode="light">
          <MDEditor
            value={content}
            onChange={setContent}
            height="100%"
            visibleDragbar={false}
            components={{ code: CodeRenderer }}
          />
        </div>

        <PdfExportWizard
          isOpen={exportWizardOpen}
          onClose={() => setExportWizardOpen(false)}
          spec={{...spec, markdownContent: content}}
          parentEstimativa={estimations.find(e => e.id === spec?.parentId)}
          parentDemanda={tickets.find(t => t.id === estimations.find(e => e.id === spec?.parentId)?.ticketId)}
          projects={projects}
          squads={squads}
        />
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default SpecificationViewerModal;
