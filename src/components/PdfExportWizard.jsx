import React, { useState, useRef } from 'react';
import { Dialog, Flex, Button, Text, TextField, Box, Grid, Heading } from '@radix-ui/themes';
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
            resolve({
              data: canvas.toDataURL("image/png"),
              width: img.width,
              height: img.height
            });
          };
          img.onerror = () => resolve(null);
          img.src = url;
        });
      };

      const clientLogo = await getBase64Image(project?.clientLogoUrl);
      const nttLogo = await getBase64Image(project?.nttLogoUrl);

      const opt = {
        margin:       [28, 12, 22, 12], // [top, right, bottom, left] em mm
        filename:     `${spec?.title || 'Especificacao'}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { 
          mode: ['css', 'legacy'],
          avoid: 'h1, h2, h3, h4, p, li, tr, img, table, blockquote, pre, .pdf-title-container, .pdf-info-header, .pdf-control-header'
        }
      };

      await html2pdf().set(opt).from(element).toPdf().get('pdf').then(function (pdf) {
        const totalPages = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          
          if (i === 1) {
            // FRONT COVER
            pdf.setFillColor(255, 255, 255); // Branca
            pdf.rect(0, 0, 210, 297, 'F'); // A4 is 210x297mm
            
            if (clientLogo) {
              const ratio = clientLogo.width / clientLogo.height;
              const calcHeight = 40; // Altura base 40mm
              const calcWidth = calcHeight * ratio;
              const finalWidth = calcWidth > 120 ? 120 : calcWidth;
              const finalHeight = finalWidth / ratio;
              
              const xPos = 105 - (finalWidth / 2);
              pdf.addImage(clientLogo.data, 'PNG', xPos, 110, finalWidth, finalHeight);
              
              pdf.setFontSize(18);
              pdf.setTextColor(0, 85, 164); // Azul Escuro
              pdf.setFont('helvetica', 'bold');
              pdf.text('Especificação Funcional', 105, 110 + finalHeight + 15, { align: 'center' });
            } else {
              pdf.setFontSize(36);
              pdf.setTextColor(0, 85, 164);
              pdf.setFont('helvetica', 'bold');
              pdf.text('CPFL ENERGIA', 105, 130, { align: 'center' });
              
              pdf.setFontSize(18);
              pdf.text('Especificação Funcional', 105, 150, { align: 'center' });
            }
            
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
            
            // Client Logo (Left)
            if (clientLogo) {
              const ratio = clientLogo.width / clientLogo.height;
              const calcHeight = 16;
              const calcWidth = calcHeight * ratio;
              const finalWidth = calcWidth > 50 ? 50 : calcWidth;
              const finalHeight = finalWidth / ratio;
              pdf.addImage(clientLogo.data, 'PNG', 10, 23 - finalHeight, finalWidth, finalHeight);
            } else {
              pdf.setTextColor(0, 85, 164); // Azul escuro
              pdf.setFontSize(14);
              pdf.setFont('helvetica', 'bold');
              pdf.text('CPFL ENERGIA', 10, 18);
            }
            
            // Title (Center)
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(110, 139, 163);
            pdf.text('Especificação Funcional |', 105, 13, { align: 'center' });
            
            const demandText = formData.demandaId ? `[${formData.demandaId}] ${formData.demandaTitle || ''}` : '[NÚMERO E NOME DA DEMANDA]';
            pdf.text(demandText, 105, 18, { align: 'center' });
            
            // NTT DATA Logo (Right)
            if (nttLogo) {
              const ratio = nttLogo.width / nttLogo.height;
              const calcHeight = 11; // Aumentado
              const calcWidth = calcHeight * ratio;
              const finalWidth = calcWidth > 45 ? 45 : calcWidth;
              const finalHeight = finalWidth / ratio;
              pdf.addImage(nttLogo.data, 'PNG', 200 - finalWidth, 24 - finalHeight, finalWidth, finalHeight);
            } else {
              pdf.setTextColor(0, 85, 164); // Azul escuro
              pdf.setFontSize(10);
              pdf.setFont('helvetica', 'bold');
              pdf.text('NTT DATA', 200, 18, { align: 'right' });
            }
            
            // Blue Horizontal Line
            pdf.setDrawColor(128, 179, 219); // Azul claro
            pdf.setLineWidth(0.5);
            pdf.line(10, 26, 200, 26);

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
      <Dialog.Content maxWidth="1100px">
        <Dialog.Title>Assistente de Exportação (Padrão CPFL)</Dialog.Title>
        <Dialog.Description size="2" mb="4">
          Preencha ou revise os dados que comporão a capa e as tabelas de controle do documento oficial. Ao lado você pode ver a pré-visualização.
        </Dialog.Description>

        <Grid columns="2" gap="5">
          {/* Lado Esquerdo - Formulário */}
          <Flex direction="column" gap="3" style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: '10px' }}>
          
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

          {/* Lado Direito - Preview */}
          <Box style={{ maxHeight: '65vh', overflowY: 'auto', backgroundColor: '#e9ecef', border: '1px solid #ccc', borderRadius: '4px', padding: '20px 10px' }}>
            <Heading size="3" mb="4" style={{ color: '#555', textAlign: 'center' }}>Pré-visualização do Documento</Heading>
            <div style={{ transform: 'scale(0.85)', transformOrigin: 'top center', backgroundColor: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', margin: '0 auto', maxWidth: '800px', pointerEvents: 'none' }}>
               <CpflPdfTemplate 
                  specData={formData} 
                  markdownContent={spec.markdownContent} 
               />
            </div>
          </Box>
        </Grid>

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
