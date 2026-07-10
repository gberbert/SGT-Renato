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
  // Usa o modelo gemini-2.5-flash como padrão (rápido e barato) ou gemini-1.5-pro se preferir, mas 1.5-flash é recomendado pela documentação atual (ou 1.5-pro).
  // Vamos usar gemini-1.5-flash que é excelente e rápido.
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

Atenção: A sua resposta deve ser APENAS a Especificação Funcional COMPLETA revisada em formato Markdown. Aplique os ajustes solicitados na versão atual. Não adicione saudações ou explicações fora do Markdown.
    `.trim();
  } else {
    finalPrompt = `
${initialPrompt}

--- REQUISITOS DO USUÁRIO E CONTEXTO ---
${finalRequirements}

Atenção: A sua resposta deve ser APENAS o conteúdo da Especificação Funcional em formato Markdown, seguindo a estrutura fornecida nas suas instruções, preenchida com os Requisitos do Usuário. Não adicione saudações ou explicações fora do Markdown.
    `.trim();
  }

  try {
    let result;
    if (attachments.filter(a => a.mimeType === 'application/pdf').length === 0) {
      // Se não tem PDF (apenas texto), manda como string simples para evitar erros do SDK com arrays
      result = await model.generateContent(finalPrompt);
    } else {
      // Prepara o payload multimodal apenas se tiver PDF
      const promptParts = [ finalPrompt ];

      attachments.forEach(att => {
        if (att.mimeType === 'application/pdf' && att.data) {
          promptParts.push({
            inlineData: {
              data: att.data, // base64 puro
              mimeType: att.mimeType
            }
          });
        }
      });
      result = await model.generateContent(promptParts);
    }
    
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Erro ao gerar especificação:", error);
    throw error;
  }
};
