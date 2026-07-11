import React, { useState, useRef, useEffect } from 'react';
import { Dialog, Flex, Button, Text, TextField, Box, Grid, Heading } from '@radix-ui/themes';
import { useReactToPrint } from 'react-to-print';
import CpflPdfTemplate from './CpflPdfTemplate';
import { auth } from '../firebase';

const PdfExportWizard = ({ isOpen, onClose, spec, parentEstimativa, parentDemanda, projects = [], squads = [] }) => {
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef(null);

  const project = projects.find(p => p.id === parentDemanda?.projectId);
  const squad = squads.find(s => s.id === parentDemanda?.squadId);

  // Form State
  const [formData, setFormData] = useState({
    cliente: project?.cliente || 'CPFL',
    projeto: parentDemanda?.title || project?.name || '',
    demandaId: parentDemanda?.code || parentEstimativa?.ticketCode || '',
    demandaTitle: spec?.title?.replace(/^(EF - |ET - )/, '') || '',
    sistema: parentDemanda?.systems?.join(', ') || parentEstimativa?.sistema || '',
    torre: project?.name || '',
    empresas: 'CPFL',
    versao: '1.0',
    data: new Date().toLocaleDateString('pt-BR'),
    autor: auth.currentUser?.displayName || spec?.authorName || spec?.assignee || '',
    status: spec?.executionStatus === 'concluido' ? 'Aprovado' : 'Em validação',
    aprovador: ''
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        cliente: project?.cliente || 'CPFL',
        projeto: parentDemanda?.title || project?.name || '',
        demandaId: parentDemanda?.code || parentEstimativa?.ticketCode || '',
        demandaTitle: spec?.title?.replace(/^(EF - |ET - )/, '') || '',
        sistema: (parentDemanda?.associatedSystems?.map(s => s.system).join(', ') || parentDemanda?.system) || parentEstimativa?.sistema || '',
        torre: project?.name || '',
        empresas: 'CPFL',
        versao: '1.0',
        data: new Date().toLocaleDateString('pt-BR'),
        autor: auth.currentUser?.displayName || spec?.authorName || spec?.assignee || '',
        status: spec?.executionStatus === 'concluido' ? 'Aprovado' : 'Em validação',
        aprovador: ''
      });
    }
  }, [isOpen, spec, parentDemanda, parentEstimativa, project]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `${spec?.title || 'Especificacao'}`,
    onBeforePrint: () => {
      return new Promise((resolve) => {
        setIsExporting(true);
        setTimeout(resolve, 0); // Permite que o estado seja atualizado
      });
    },
    onAfterPrint: () => {
      setIsExporting(false);
    }
  });

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
            <div style={{ transform: 'scale(0.85)', transformOrigin: 'top center', backgroundColor: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', margin: '0 auto', width: 'fit-content', minWidth: '800px', pointerEvents: 'none' }}>
               <CpflPdfTemplate 
                  specData={formData} 
                  markdownContent={spec.markdownContent}
                  project={project}
               />
            </div>
          </Box>
        </Grid>

        <Box mt="3" mb="3">
          <Text size="2" color="gray" style={{ fontStyle: 'italic' }}>
            <span style={{ fontWeight: 'bold' }}>Atenção:</span> Ao clicar no botão abaixo, a janela de impressão do seu navegador será aberta. Certifique-se de escolher o destino <b>"Salvar como PDF"</b> e habilitar a opção <b>"Gráficos de plano de fundo"</b> (Background graphics) nas configurações de impressão para que o PDF seja gerado com as cores corretas!
          </Text>
        </Box>

        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray" disabled={isExporting}>Cancelar</Button>
          </Dialog.Close>
          <Button onClick={handlePrint} disabled={isExporting} style={{ background: 'linear-gradient(90deg, #0055a4, #0070c0)', color: 'white' }}>
            {isExporting ? 'Preparando...' : 'Gerar PDF via Navegador'}
          </Button>
        </Flex>

        {/* CONTAINER OCULTO PARA O REACT-TO-PRINT */}
        <div style={{ display: 'none' }}>
          <div ref={printRef}>
             <CpflPdfTemplate 
                specData={formData} 
                markdownContent={spec.markdownContent}
                project={project}
                isPrinting={true}
             />
          </div>
        </div>

      </Dialog.Content>
    </Dialog.Root>
  );
};

export default PdfExportWizard;
