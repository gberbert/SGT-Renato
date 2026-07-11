import React, { useState, useRef } from 'react';
import { Dialog, Flex, Button, Text, TextField, Box } from '@radix-ui/themes';
import html2pdf from 'html2pdf.js';
import CpflPdfTemplate from './CpflPdfTemplate';

const PdfExportWizard = ({ isOpen, onClose, spec, parentEstimativa, parentDemanda, projects = [], squads = [] }) => {
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef(null);

  const project = projects.find(p => p.id === parentDemanda?.projectId);
  const squad = squads.find(s => s.id === parentDemanda?.squadId);

  // Form State
  const [formData, setFormData] = useState({
    cliente: 'CPFL',
    projeto: project?.name || parentDemanda?.title || '',
    demandaId: parentDemanda?.code || parentEstimativa?.ticketCode || '',
    demandaTitle: spec?.title?.replace(/^(EF - |ET - )/, '') || '',
    sistema: parentEstimativa?.sistema || '',
    torre: squad?.name || '',
    empresas: 'CPFL',
    versao: '1.0',
    data: new Date().toLocaleDateString('pt-BR'),
    autor: spec?.authorName || spec?.assignee || '',
    status: spec?.executionStatus === 'concluido' ? 'Aprovado' : 'Em validação',
    aprovador: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleExport = async () => {
    if (!printRef.current) return;
    setIsExporting(true);

    try {
      const element = printRef.current;
      // Precisamos garantir que o display do elemento não seja "none" durante a exportação
      element.style.display = 'block';

      // Converter URLs para Base64 para evitar bloqueios CORS do jsPDF
      const getBase64Image = (url) => {
        if (!url) return Promise.resolve(null);
        return new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/png"));
          };
          img.onerror = () => resolve(null);
          img.src = url;
        });
      };

      const clientLogoBase64 = await getBase64Image(project?.clientLogoUrl);
      const nttLogoBase64 = await getBase64Image(project?.nttLogoUrl);

      const opt = {
        margin:       [28, 12, 22, 12], // [top, right, bottom, left] em mm
        filename:     `${spec?.title || 'Especificacao'}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
      };

      await html2pdf().set(opt).from(element).toPdf().get('pdf').then(function (pdf) {
        const totalPages = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          
          if (i === 1) {
            // FRONT COVER
            pdf.setFillColor(0, 75, 135); // Azul Petróleo (CPFL/NTT Data)
            pdf.rect(0, 0, 210, 297, 'F'); // A4 is 210x297mm
            
            if (nttLogoBase64) {
              // Tentar centralizar (supondo proporção retangular). A altura do logo será uns 30mm
              pdf.addImage(nttLogoBase64, 'PNG', 55, 120, 100, 30);
            } else {
              pdf.setFontSize(36);
              pdf.setTextColor(255, 255, 255); // Branco
              pdf.setFont('helvetica', 'bold');
              pdf.text('NTT DATA', 105, 140, { align: 'center' });
            }
            
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'normal');
            pdf.text('Especificação Funcional', 105, 150, { align: 'center' });
            
          } else if (i === totalPages) {
            // BACK COVER
            pdf.setFillColor(0, 75, 135);
            pdf.rect(0, 0, 210, 297, 'F');
            
            pdf.setFontSize(30);
            pdf.setTextColor(255, 255, 255);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Obrigado', 105, 148, { align: 'center' });
            
          } else {
            // REGULAR PAGES (Header and Footer)
            
            // ---- HEADER ----
            pdf.setFontSize(10);
            pdf.setTextColor(0, 85, 164); // Azul escuro
            pdf.setFont('helvetica', 'bold');
            
            // Client Logo Mock (Left)
            if (clientLogoBase64) {
              pdf.addImage(clientLogoBase64, 'PNG', 10, 10, 30, 10);
            } else {
              pdf.text('CPFL ENERGIA', 10, 15);
            }
            
            // Title (Center)
            pdf.setFontSize(9);
            pdf.text('Especificação Funcional |', 105, 13, { align: 'center' });
            pdf.text(formData.demandaId || '[NÚMERO DA DEMANDA]', 105, 17, { align: 'center' });
            
            // NTT DATA Logo (Right)
            if (nttLogoBase64) {
              pdf.addImage(nttLogoBase64, 'PNG', 160, 10, 40, 10);
            } else {
              pdf.setFontSize(10);
              pdf.text('NTT DATA', 200, 15, { align: 'right' });
            }
            
            // Blue Horizontal Line
            pdf.setDrawColor(0, 85, 164);
            pdf.setLineWidth(0.5);
            pdf.line(10, 22, 200, 22);

            // ---- FOOTER ----
            pdf.setFontSize(8);
            pdf.setTextColor(128, 128, 128); // Cinza
            pdf.setFont('helvetica', 'normal');
            
            pdf.text('Uso interno/Confidencial', 10, 285);
            pdf.text(`Página ${i - 1}`, 200, 285, { align: 'right' }); // -1 because page 1 is the cover
          }
        }
      }).save();

      // Esconde novamente após exportar
      element.style.display = 'none';
      onClose();
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      alert('Houve um erro ao tentar gerar o PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!spec) return null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Content maxWidth="600px">
        <Dialog.Title>Assistente de Exportação (Padrão CPFL)</Dialog.Title>
        <Dialog.Description size="2" mb="4">
          Preencha ou revise os dados que comporão a capa e as tabelas de controle do documento oficial.
        </Dialog.Description>

        <Flex direction="column" gap="3" style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '10px' }}>
          
          <Flex gap="3">
            <Box style={{ flex: 1 }}>
              <Text as="div" size="2" mb="1" weight="bold">Cliente</Text>
              <TextField.Root name="cliente" value={formData.cliente} onChange={handleChange} />
            </Box>
            <Box style={{ flex: 1 }}>
              <Text as="div" size="2" mb="1" weight="bold">Torre / Diretoria</Text>
              <TextField.Root name="torre" value={formData.torre} onChange={handleChange} placeholder="Ex: AMS, Infra..." />
            </Box>
          </Flex>

          <Box>
            <Text as="div" size="2" mb="1" weight="bold">Projeto</Text>
            <TextField.Root name="projeto" value={formData.projeto} onChange={handleChange} />
          </Box>

          <Flex gap="3">
            <Box style={{ flex: 1 }}>
              <Text as="div" size="2" mb="1" weight="bold">Demanda / DM</Text>
              <TextField.Root name="demandaId" value={formData.demandaId} onChange={handleChange} />
            </Box>
            <Box style={{ flex: 1 }}>
              <Text as="div" size="2" mb="1" weight="bold">Título (Capa)</Text>
              <TextField.Root name="demandaTitle" value={formData.demandaTitle} onChange={handleChange} />
            </Box>
          </Flex>

          <Flex gap="3">
            <Box style={{ flex: 1 }}>
              <Text as="div" size="2" mb="1" weight="bold">Projeto</Text>
              <TextField.Root name="projeto" value={formData.projeto} onChange={handleChange} />
            </Box>
            <Box style={{ flex: 1 }}>
              <Text as="div" size="2" mb="1" weight="bold">Torre / Diretoria</Text>
              <TextField.Root name="torre" value={formData.torre} onChange={handleChange} />
            </Box>
          </Flex>

          <Flex gap="3">
            <Box style={{ flex: 1 }}>
              <Text as="div" size="2" mb="1" weight="bold">Sistema / Módulo</Text>
              <TextField.Root name="sistema" value={formData.sistema} onChange={handleChange} />
            </Box>
            <Box style={{ flex: 1 }}>
              <Text as="div" size="2" mb="1" weight="bold">Empresas Impactadas</Text>
              <TextField.Root name="empresas" value={formData.empresas} onChange={handleChange} />
            </Box>
          </Flex>

          <Flex gap="3">
            <Box style={{ flex: 1 }}>
              <Text as="div" size="2" mb="1" weight="bold">Versão</Text>
              <TextField.Root name="versao" value={formData.versao} onChange={handleChange} />
            </Box>
            <Box style={{ flex: 1 }}>
              <Text as="div" size="2" mb="1" weight="bold">Status</Text>
              <TextField.Root name="status" value={formData.status} onChange={handleChange} />
            </Box>
          </Flex>

          <Flex gap="3">
            <Box style={{ flex: 1 }}>
              <Text as="div" size="2" mb="1" weight="bold">Data</Text>
              <TextField.Root name="data" value={formData.data} onChange={handleChange} />
            </Box>
            <Box style={{ flex: 1 }}>
              <Text as="div" size="2" mb="1" weight="bold">Autor</Text>
              <TextField.Root name="autor" value={formData.autor} onChange={handleChange} />
            </Box>
          </Flex>

          <Box>
            <Text as="div" size="2" mb="1" weight="bold">Aprovador</Text>
            <TextField.Root name="aprovador" value={formData.aprovador} onChange={handleChange} placeholder="Nome do aprovador (opcional)" />
          </Box>

        </Flex>

        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray" disabled={isExporting}>Cancelar</Button>
          </Dialog.Close>
          <Button onClick={handleExport} disabled={isExporting} style={{ background: 'linear-gradient(90deg, #0055a4, #0070c0)', color: 'white' }}>
            {isExporting ? 'Gerando PDF...' : 'Gerar e Baixar PDF'}
          </Button>
        </Flex>

        {/* CONTAINER OCULTO PARA O HTML2PDF */}
        <div style={{ display: 'none' }}>
          <div ref={printRef}>
             <CpflPdfTemplate 
                specData={formData} 
                markdownContent={spec.markdownContent} 
             />
          </div>
        </div>

      </Dialog.Content>
    </Dialog.Root>
  );
};

export default PdfExportWizard;
