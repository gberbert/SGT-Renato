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
2. RETENÇÃO TOTAL: NUNCA resuma, abrevie ou simplifique. Mantenha 100% da complexidade, fluxos e regras de negócio.
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
1. ESTRUTURA RIGOROSA: A sua resposta deve ser APENAS o conteúdo da Especificação em formato Markdown, seguindo RIGOROSAMENTE o TEMPLATE E A ESTRUTURA fornecidos nas suas instruções iniciais.
2. RETENÇÃO TOTAL: NUNCA resuma, abrevie ou simplifique os requisitos e contextos fornecidos. Você deve absorver, refletir e organizar 100% da complexidade original.
3. DIAGRAMAS E VISUAL: É OBRIGATÓRIO gerar e preservar diagramas visuais (Mermaid) para fluxos de sistema, sequência, estados ou casos de uso pertinentes aos requisitos.
4. AUTO-CORREÇÃO DE SINTAXE (CRÍTICO): A renderização aceita APENAS sintaxe padrão do Mermaid.js. Não suportamos "usecaseDiagram", "actor" ou PlantUML. Caso haja diagramas de uso na origem, converta-os OBRIGATORIAMENTE para um Diagrama de Fluxo (flowchart TD/LR) em sintaxe Mermaid válida.
5. ENROBUSTECIMENTO: Transforme anotações em uma especificação de nível Sênior/Especialista. Expanda os conceitos com casos de borda (sad paths), tratamentos de erro, regras de validação e requisitos não-funcionais (performance, segurança).
6. Não adicione saudações, conclusões verbais ou explicações fora do Markdown.
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
    result = await tryGenerateWithModel("gemini-3.1-flash-lite");
  } catch (err0) {
    console.warn("Falha com gemini-3.1-flash-lite, tentando gemini-3.1-flash...", err0);
    try {
      result = await tryGenerateWithModel("gemini-3.1-flash");
    } catch (err) {
      console.warn("Falha com gemini-3.1-flash, tentando gemini-1.5-flash-latest...", err);
      try {
        result = await tryGenerateWithModel("gemini-1.5-flash-latest");
      } catch (err2) {
        console.warn("Falha com gemini-1.5-flash-latest, tentando gemini-1.5-pro-latest...", err2);
        try {
          result = await tryGenerateWithModel("gemini-1.5-pro-latest");
        } catch (err3) {
          throw err3;
        }
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
