import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

/**
 * Gera uma Especificação Funcional chamando a Firebase Cloud Function.
 * @param {string} apiKey A chave de API do Gemini configurada pelo admin.
 * @param {string} initialPrompt As instruções comportamentais para a IA.
 * @param {string} userRequirements Os requisitos em linguagem natural escritos pelo usuário.
 * @param {string} previousMarkdown (Opcional) A versão atual do markdown, para ajustes.
 * @param {string} userAdjustments (Opcional) Sugestões de ajuste do usuário.
 * @param {Array} attachments (Opcional) Array de anexos { name, mimeType, data, text }.
 * @param {string} specType (Opcional) Tipo de especificação ('EF' ou 'ET').
 * @returns {Promise<string>} O markdown gerado pela IA.
 */
export const generateFunctionalSpecification = async (apiKey, initialPrompt, userRequirements, previousMarkdown = null, userAdjustments = null, attachments = [], specType = 'EF') => {
  if (!apiKey) {
    throw new Error("API Key do Gemini não está configurada.");
  }

  const generateFunctionalSpec = httpsCallable(functions, 'generateFunctionalSpec');

  try {
    const result = await generateFunctionalSpec({
      apiKey,
      initialPrompt,
      userRequirements,
      previousMarkdown,
      userAdjustments,
      attachments,
      specType
    });

    if (result && result.data && result.data.text) {
      return result.data.text;
    } else {
      throw new Error("Resposta inválida da Cloud Function");
    }
  } catch (error) {
    console.error("Erro ao chamar a Cloud Function generateFunctionalSpec:", error);
    throw error;
  }
};
