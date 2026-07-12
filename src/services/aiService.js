import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Gera uma Especificação Funcional usando o modelo Gemini.
 * @param {string} apiKey A chave de API do Gemini configurada pelo admin.
 * @param {string} initialPrompt As instruções comportamentais para a IA.
 * @param {string} modelTemplate O modelo (esqueleto) em Markdown.
 * @param {string} userRequirements Os requisitos em linguagem natural escritos pelo usuário.
 * @param {string} previousMarkdown (Opcional) A versão atual do markdown, para ajustes.
 * @param {string} userAdjustments (Opcional) Sugestões de ajuste do usuário.
 * @param {Array} attachments (Opcional) Array de anexos { name, mimeType, data, text }.
 * @returns {Promise<string>} O markdown gerado pela IA.
 */
export const generateFunctionalSpecification = async (apiKey, initialPrompt, userRequirements, previousMarkdown = null, userAdjustments = null, attachments = []) => {
  if (!apiKey) {
    throw new Error("API Key do Gemini não está configurada.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);


  let finalPrompt = '';

  // Adicionar textos extraídos dos arquivos (.txt, .md) aos requisitos
  let finalRequirements = userRequirements;
  attachments.forEach(att => {
    if (att.mimeType === 'text/plain' || att.mimeType === 'text/markdown') {
      finalRequirements += `\n\n--- CONTEÚDO DO ANEXO (${att.name}) ---\n${att.text}\n`;
    }
  });

  if (previousMarkdown && userAdjustments) {
    finalPrompt = `
${initialPrompt}

--- VERSÃO ATUAL DA ESPECIFICAÇÃO ---
${previousMarkdown}

--- SOLICITAÇÃO DE AJUSTE DO USUÁRIO ---
${userAdjustments}

REGRAS CRÍTICAS DE GERAÇÃO:
1. ESTRUTURA RIGOROSA: A sua resposta deve ser APENAS o conteúdo da Especificação em formato Markdown. Aplique os ajustes solicitados seguindo rigorosamente a estrutura e template originais.
2. RETENÇÃO TOTAL (PROIBIDO RESUMIR): É terminantemente PROIBIDO resumir, abreviar ou parafrasear o conteúdo original. Se o usuário forneceu listas, regras ou critérios, você deve COPIAR EXATAMENTE o texto original (Ctrl+C / Ctrl+V) e apenas adicionar/expandir novos pontos.
3. DIAGRAMAS E VISUAL: Sempre preserve e expanda os diagramas visuais (Mermaid) e tabelas.
4. AUTO-CORREÇÃO DE SINTAXE (CRÍTICO): O sistema renderiza apenas "Mermaid.js" padrão. Não utilize "usecaseDiagram" ou "actor" (sintaxe PlantUML). Se houver fluxos de caso de uso, converta-os OBRIGATORIAMENTE para "flowchart TD" ou "flowchart LR" no formato Mermaid válido.
5. Não adicione saudações, conclusões ou explicações fora do Markdown.
    `.trim();
  } else {
      finalPrompt = `
${initialPrompt}

--- REQUISITOS DO USUÁRIO E CONTEXTO ---
${finalRequirements}

REGRAS CRÍTICAS DE GERAÇÃO:
1. ESTRUTURA RIGOROSA (12 TÓPICOS): A sua resposta deve ser APENAS o conteúdo da Especificação em formato Markdown, contendo OBRIGATORIAMENTE OS 12 TÓPICOS ABAIXO, NA ORDEM EXATA:
   1. Sumário
   2. Plano de comunicação (Momento [Pré-deploy, deploy, pós-deploy], Público, Canal, Conteúdo)
   3. Objetivo
   4. Contexto e Justificativa de Negócio
   5. Escopo Funcional
   6. Requisitos Funcionais (RF-001 - Descrição, Atores, Resultado. OBRIGATÓRIO: Tabela de "Alterações funcionais em tela, relatório ou processo" com as colunas: Campo/elemento, Descrição funcional, Tipo/formato, Obrigatório, Regra/domínio, Exemplo).
   7. Requisitos Não Funcionais (Listar explicitamente itens que não serão tratados nesta demanda para evitar interpretações divergentes).
   8. Regras de Negócio (RN-001 - Fluxo Principal, Alternativos, Exceção, Validações obrigatórias, Permissões funcionais, Cálculos).
   9. Premissas, restrições, riscos e dependências (OBRIGATÓRIO: Uma tabela para Premissas com [ID, Premissa, Responsável] e uma tabela para Restrições com [ID, Restrição, Impacto funcional]).
   10. Critérios de Aceite
   11. Anexos funcionais (Apenas citar necessidade de mockups/regras).
   12. Glossário (OBRIGATÓRIO: Tabela com [Termo/sigla, Definição]).

2. INFORMAÇÕES AUSENTES: Se os "Requisitos do Usuário" não fornecerem informações suficientes para preencher um determinado tópico do template (dos 12 acima), você DEVE gerar o título do tópico normalmente (Ex: "# 10. Critérios de Aceite") e inserir como conteúdo exatamente este texto: "[PENDENTE: Informação ausente no requisito original]".
3. RETENÇÃO TOTAL (PROIBIDO RESUMIR): É terminantemente PROIBIDO resumir, abreviar ou parafrasear. Se o usuário forneceu textos densos, cenários BDD, regras de negócio ou Critérios de Aceite, você DEVE preservar as sentenças originais (copiar e colar o texto base) e APENAS EXPANDIR adicionando novos cenários ou detalhes que faltaram. Nunca condense listas.
4. DIAGRAMAS E VISUAL: É OBRIGATÓRIO gerar e preservar diagramas visuais (Mermaid) para fluxos de sistema, sequência, estados ou casos de uso pertinentes aos requisitos.
5. AUTO-CORREÇÃO DE SINTAXE (CRÍTICO): A renderização aceita APENAS sintaxe padrão do Mermaid.js. Não suportamos "usecaseDiagram", "actor" ou PlantUML. Caso haja diagramas de uso na origem, converta-os OBRIGATORIAMENTE para um Diagrama de Fluxo (flowchart TD/LR) em sintaxe Mermaid válida.
6. ENROBUSTECIMENTO: Transforme anotações em uma especificação de nível Sênior/Especialista. Expanda os conceitos com casos de borda (sad paths), tratamentos de erro, regras de validação e requisitos não-funcionais (performance, segurança).
7. Não adicione saudações, conclusões verbais ou explicações fora do Markdown.
    `.trim();
  }

  let result;
  
  // Função auxiliar para tentar gerar com um modelo específico
  const tryGenerateWithModel = async (modelName) => {
    const model = genAI.getGenerativeModel({ model: modelName });
    if (attachments.filter(a => a.mimeType === 'application/pdf').length === 0) {
      return await model.generateContent(finalPrompt);
    } else {
      const promptParts = [ finalPrompt ];
      attachments.forEach(att => {
        if (att.mimeType === 'application/pdf' && att.data) {
          promptParts.push({
            inlineData: {
              data: att.data,
              mimeType: att.mimeType
            }
          });
        }
      });
      return await model.generateContent(promptParts);
    }
  };

  try {
    result = await tryGenerateWithModel("gemini-3.1-pro-preview");
  } catch (err0) {
    console.warn("Falha com gemini-3.1-pro-preview, tentando gemini-2.5-pro...", err0);
    try {
      result = await tryGenerateWithModel("gemini-2.5-pro");
    } catch (err) {
      console.warn("Falha com gemini-2.5-pro, tentando gemini-1.5-pro-latest...", err);
      try {
        result = await tryGenerateWithModel("gemini-1.5-pro-latest");
      } catch (err2) {
        throw err2;
      }
    }
  }

  try {
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Erro ao processar resposta da especificação:", error);
    throw error;
  }
};
