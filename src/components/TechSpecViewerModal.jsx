import React, { useState, useEffect, useRef } from 'react';
import { Dialog, Flex, Button, IconButton } from '@radix-ui/themes';
import { Save, Download, X } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import { saveTechSpecification } from '../services/techSpecService';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const TechSpecViewerModal = ({ isOpen, onClose, spec }) => {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const printRef = useRef(null);

  useEffect(() => {
    if (spec) {
      setContent(spec.markdownContent || '');
    }
  }, [spec]);

  const handleSave = async () => {
    if (!spec) return;
    setIsSaving(true);
    try {
      await saveTechSpecification({
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

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsGeneratingPDF(true);
    try {
      const element = printRef.current;
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight 
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }

      pdf.save(`${spec?.title || 'Especificacao_Funcional'}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (!spec) return null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Content maxWidth="1000px" style={{ height: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
        {/* Header toolbar */}
        <Flex justify="between" align="center" style={{ padding: '16px', borderBottom: '1px solid var(--gray-5)', background: 'var(--panel-solid)' }}>
          <div style={{ fontWeight: 'bold', fontSize: '18px' }}>{spec.title}</div>
          <Flex gap="3">
            <Button variant="soft" onClick={handleSave} disabled={isSaving || content === spec.markdownContent}>
              <Save size={16} /> Salvar
            </Button>
            <Button variant="solid" onClick={handleDownloadPDF} disabled={isGeneratingPDF}>
              <Download size={16} /> {isGeneratingPDF ? 'Gerando...' : 'Baixar PDF'}
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
          />
        </div>

        {/* Hidden Div for PDF Export (renders just the markdown viewer) */}
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '800px' }}>
          <div ref={printRef} style={{ padding: '40px', background: 'white', color: 'black' }} data-color-mode="light">
            <h1 style={{ textAlign: 'center', marginBottom: '20px' }}>{spec.title}</h1>
            <p style={{ textAlign: 'center', color: '#666' }}>Documento gerado por SGT - {new Date().toLocaleDateString('pt-BR')}</p>
            <hr style={{ marginBottom: '30px' }} />
            <MDEditor.Markdown source={content} style={{ background: 'white', color: 'black' }} />
          </div>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default TechSpecViewerModal;
