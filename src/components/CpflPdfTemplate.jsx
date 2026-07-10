import React from 'react';
import MDEditor from '@uiw/react-md-editor';
import './CpflPdfTemplate.css';

const CpflPdfTemplate = ({ specData, markdownContent }) => {
  return (
    <div id="cpfl-pdf-template" className="pdf-container">
      
      {/* COVER PAGE */}
      <div className="pdf-page pdf-first-page">
        {/* HEADER COVER */}
        <div className="pdf-header">
          <div className="pdf-header-logos">
             {/* Mocking CPFL Logo */}
             <div className="cpfl-logo-mock">
               <span className="cpfl-line cpfl-green"></span>
               <span className="cpfl-line cpfl-yellow"></span>
               <span className="cpfl-line cpfl-orange"></span>
               <div className="cpfl-text">CPFL<br/><span>ENERGIA</span></div>
             </div>
          </div>
          
          <div className="pdf-header-title">
            Especificação Funcional | <br/>
            {specData?.demandaId}
          </div>

          <div className="pdf-header-logos right">
             {/* Mocking NTT DATA Logo */}
             <div className="ntt-logo-mock">
                <span>NTT</span> data
             </div>
          </div>
        </div>

        <div className="pdf-header-divider"></div>

        {/* REPEATED LOGOS JUST FOR AESTHETICS (As in the screenshot where they appear twice on page 1) */}
        <div className="pdf-header" style={{ marginTop: '20px', marginBottom: '40px' }}>
          <div className="pdf-header-logos">
             <div className="cpfl-logo-mock large">
               <span className="cpfl-line cpfl-green"></span>
               <span className="cpfl-line cpfl-yellow"></span>
               <span className="cpfl-line cpfl-orange"></span>
               <div className="cpfl-text">CPFL<br/><span>ENERGIA</span></div>
             </div>
          </div>
          <div className="pdf-header-logos right">
             <div className="ntt-logo-mock large">
                <span>NTT</span> data
             </div>
          </div>
        </div>

        <div className="pdf-blue-bar"></div>
        <h1 className="pdf-main-title">Especificação Funcional (EF)</h1>
        <h2 className="pdf-subtitle">[{specData?.demandaId}] {specData?.demandaTitle}</h2>

        <div className="pdf-info-header">Informações do documento</div>
        <table className="pdf-table info-table">
          <tbody>
            <tr><td className="pdf-td-label">Cliente</td><td>{specData?.cliente || 'CPFL'}</td></tr>
            <tr><td className="pdf-td-label">Projeto</td><td>{specData?.projeto || 'N/A'}</td></tr>
            <tr><td className="pdf-td-label">Demanda / DM</td><td>{specData?.demandaId || 'N/A'}</td></tr>
            <tr><td className="pdf-td-label">Sistema / módulo</td><td>{specData?.sistema || 'N/A'}</td></tr>
            <tr><td className="pdf-td-label">Torre / Diretoria</td><td>{specData?.torre || 'N/A'}</td></tr>
            <tr><td className="pdf-td-label">Empresas / unidades impactadas</td><td>{specData?.empresas || 'N/A'}</td></tr>
            <tr><td className="pdf-td-label">Versão</td><td>{specData?.versao || '1.0'}</td></tr>
            <tr><td className="pdf-td-label">Data da criação</td><td>{specData?.data || 'N/A'}</td></tr>
            <tr><td className="pdf-td-label">Elaborado por</td><td>NTT DATA | {specData?.autor || 'N/A'}</td></tr>
            <tr><td className="pdf-td-label">Status</td><td>{specData?.status || 'Aprovado'}</td></tr>
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
        <MDEditor.Markdown source={markdownContent} style={{ backgroundColor: 'transparent', color: 'black' }} />
      </div>
      
    </div>
  );
};

export default CpflPdfTemplate;
