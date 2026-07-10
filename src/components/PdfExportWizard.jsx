import React, { useState, useRef } from 'react';
import { Dialog, Flex, Button, Text, TextField, Box } from '@radix-ui/themes';
import html2pdf from 'html2pdf.js';
import CpflPdfTemplate from './CpflPdfTemplate';

const PdfExportWizard = ({ isOpen, onClose, spec, parentEstimativa, parentDemanda }) => {
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef(null);

  // Form State
  const [formData, setFormData] = useState({
    cliente: 'CPFL',
    projeto: parentDemanda?.title || '',
    demandaId: parentDemanda?.code || parentEstimativa?.ticketCode || '',
    demandaTitle: spec?.title?.replace(/^(EF - |ET - )/, '') || '',
    sistema: parentEstimativa?.sistema || '',
    torre: '',
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

      const opt = {
        margin:       10, // mm
        filename:     `${spec?.title || 'Especificacao'}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['css', 'legacy'] }
      };

      await html2pdf().set(opt).from(element).save();

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
