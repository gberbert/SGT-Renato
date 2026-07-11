import React from 'react';
import MDEditor from '@uiw/react-md-editor';
import './CpflPdfTemplate.css';
import CodeRenderer from './CodeRenderer';

const CpflPdfTemplate = ({ specData, markdownContent, project, isPrinting }) => {
  const demandText = specData?.demandaId ? `[${specData.demandaId}] ${specData.demandaTitle || ''}` : '[NÚMERO E NOME DA DEMANDA]';

  return (
    <div id="cpfl-pdf-template" className={`pdf-container ${isPrinting ? 'is-printing' : ''}`}>
      
      {/* HEADER REPETIDO (SÓ APARECE NA IMPRESSÃO) */}
      <div className="print-header">
        <div className="header-left">
          {project?.clientLogoUrl ? (
            <img src={project.clientLogoUrl} alt="Cliente" className="header-client-logo" />
          ) : (
            <span className="header-client-text">{specData?.cliente || 'CPFL ENERGIA'}</span>
          )}
        </div>
        <div className="header-center">
          <span className="header-title">Especificação Funcional |</span><br/>
          <span className="header-subtitle">{demandText}</span>
        </div>
        <div className="header-right">
          {project?.nttLogoUrl ? (
            <img src={project.nttLogoUrl} alt="NTT DATA" className="header-ntt-logo" />
          ) : (
            <span className="header-ntt-text">NTT DATA</span>
          )}
        </div>
        <div className="header-divider"></div>
      </div>

      {/* FOOTER REPETIDO */}
      <div className="print-footer">
        <span className="footer-left">Uso interno/Confidencial</span>
        {/* Número da página (só no Chrome, com limitações, mas deixamos o espaço) */}
      </div>

      {/* CAPA (TAPA O HEADER E FOOTER COM Z-INDEX SE FOR IMPRESSÃO) */}
      <div className="pdf-page pdf-cover-page">
        <div className="cover-content">
          {project?.clientLogoUrl ? (
            <>
              <img src={project.clientLogoUrl} alt="Logo Cliente" className="cover-client-logo" />
              <div className="cover-title">Especificação Funcional</div>
            </>
          ) : (
            <>
              <div className="cover-client-text">CPFL ENERGIA</div>
              <div className="cover-title">Especificação Funcional</div>
            </>
          )}
        </div>
      </div>

      {/* ENVOLVENDO O CONTEÚDO EM TABELA PARA FORÇAR ESPAÇO DO HEADER/FOOTER NAS PÁGINAS SEGUINTES */}
      <table className="print-content-table">
        <thead>
          <tr><td><div className="print-header-space"></div></td></tr>
        </thead>
        <tbody>
          <tr>
            <td>

      {/* DOCUMENT INFO PAGE */}
      <div className="pdf-page pdf-first-page" style={{ pageBreakBefore: 'always' }}>
        
        <div className="pdf-title-container">
          <div className="pdf-blue-bar"></div>
          <div className="pdf-titles-wrapper">
            <h1 className="pdf-main-title">Especificação Funcional (EF)</h1>
            <h2 className="pdf-subtitle">[{specData?.demandaId}] {specData?.demandaTitle}</h2>
          </div>
        </div>

        <div className="pdf-info-header">Informações do documento</div>
        <table className="pdf-table info-table">
          <tbody>
            <tr><td className="pdf-td-label">Cliente</td><td>{specData?.cliente || 'CPFL'}</td></tr>
            <tr><td className="pdf-td-label">Projeto</td><td className={!specData?.projeto ? "yellow-bg" : ""}>{specData?.projeto || '[Nome do projeto]'}</td></tr>
            <tr><td className="pdf-td-label">Demanda / DM</td><td className={!specData?.demandaId ? "yellow-bg" : ""}>{specData?.demandaId || '[Número da DM]'}</td></tr>
            <tr><td className="pdf-td-label">Sistema / módulo</td><td className={!specData?.sistema ? "yellow-bg" : ""}>{specData?.sistema || '[Sistema ou módulo]'}</td></tr>
            <tr><td className="pdf-td-label">Torre / Diretoria</td><td className={!specData?.torre ? "yellow-bg" : ""}>{specData?.torre || '[Torre / Diretoria]'}</td></tr>
            <tr><td className="pdf-td-label">Empresas / unidades impactadas:</td><td className={!specData?.empresas ? "yellow-bg" : ""}>{specData?.empresas || '[CPFL Listar empresas]'}</td></tr>
            <tr><td className="pdf-td-label">Versão</td><td>{specData?.versao || '1.0'}</td></tr>
            <tr><td className="pdf-td-label">Data da criação</td><td className={!specData?.data ? "yellow-bg" : ""}>{specData?.data || '[dd/mm/aaaa]'}</td></tr>
            <tr><td className="pdf-td-label">Elaborado por</td><td className={!specData?.autor ? "yellow-bg" : ""}>NTT DATA | {specData?.autor || '[Nome do responsável]'}</td></tr>
            <tr><td className="pdf-td-label">Status</td><td className={!specData?.status ? "yellow-bg" : ""}>{specData?.status || 'Aprovado'}</td></tr>
          </tbody>
        </table>
        
        <div className="pdf-classification">Classificação: Uso interno / Confidencial</div>

        <div className="pdf-control-header">Controle do documento</div>
        <table className="pdf-table control-table">
          <thead>
            <tr>
              <th>Versão</th>
              <th>Data</th>
              <th>Autor</th>
              <th>Descrição da alteração</th>
              <th>Aprovador</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{specData?.versao || '1.0'}</td>
              <td>{specData?.data || 'N/A'}</td>
              <td>{specData?.autor || 'N/A'}</td>
              <td>Criação inicial do documento</td>
              <td>{specData?.aprovador || '-'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* MARKDOWN CONTENT PAGES */}
      <div className="pdf-page pdf-content-page" style={{ pageBreakBefore: 'always' }} data-color-mode="light">
        <MDEditor.Markdown 
          source={markdownContent} 
          style={{ backgroundColor: 'transparent', color: 'black' }} 
          components={{ code: CodeRenderer }}
        />
      </div>

      {/* FECHAMENTO DA TABELA DE CONTEÚDO */}
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr><td><div className="print-footer-space"></div></td></tr>
        </tfoot>
      </table>

      {/* BACK COVER */}
      <div className="pdf-page pdf-back-cover-page" style={{ pageBreakBefore: 'always' }}>
        <div className="back-cover-content">
          Obrigado
        </div>
      </div>
      
    </div>
  );
};

export default CpflPdfTemplate;
