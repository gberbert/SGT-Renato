const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require('firebase-admin');
admin.initializeApp();

exports.onCreateNotification = onDocumentCreated({
    document: 'notifications/{notificationId}',
    database: 'default'
}, async (event) => {
    const snap = event.data;
    if (!snap) {
      return null;
    }
    const notification = snap.data();

    // Verifique se a notificação possui o ID do usuário de destino
    if (!notification.userId) {
      console.log('Sem userId na notificação.');
      return null;
    }

    // Use a instância do Firestore do próprio documento que acionou o trigger
    const db = event.data.ref.firestore;
    
    // Busque o perfil do usuário no Firestore para pegar o FCM Token
    const userDoc = await db.collection('users').doc(notification.userId).get();
    
    if (!userDoc.exists) {
      console.log('Usuário não encontrado.');
      return null;
    }

    const userData = userDoc.data();
    const fcmToken = userData.fcmToken;

    if (!fcmToken) {
      console.log(`Usuário ${notification.userId} não possui um token FCM registrado.`);
      return null;
    }

    const title = notification.senderName || notification.title?.split(':')[0] || 'SGT - Nova Notificação';
    const bodyText = notification.ticketTitle 
          ? `[${notification.ticketTitle}]\n${notification.textSnippet || notification.message}`
          : (notification.textSnippet || notification.message);

    const payload = {
      token: fcmToken,
      notification: {
        title: title,
        body: bodyText,
      },
      webpush: {
        fcmOptions: {
          link: notification.link ? `https://sgt-renato.web.app/?ticket=${notification.link}` : "https://sgt-renato.web.app"
        },
        notification: {
          icon: '/vite.svg',
          badge: '/vite.svg'
        }
      }
    };

    try {
      const response = await admin.messaging().send(payload);
      console.log('Notificação push enviada com sucesso:', response);
    } catch (error) {
      console.error('Erro ao enviar push notification:', error);
      
      // Se o token for inválido, podemos querer removê-lo do banco
      if (error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered') {
        console.log('Removendo token inválido do usuário.');
        await db.collection('users').doc(notification.userId).update({
          fcmToken: admin.firestore.FieldValue.delete()
        });
      }
    }
  });

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.generateFunctionalSpec = onCall({
    maxInstances: 10,
    timeoutSeconds: 540,
    memory: "512MiB"
}, async (request) => {
    const { apiKey, initialPrompt, userRequirements, previousMarkdown, userAdjustments, attachments } = request.data;

    if (!apiKey) {
        throw new HttpsError("invalid-argument", "API Key do Gemini não está configurada.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    let finalPrompt = '';

    // Adicionar textos extraídos dos arquivos (.txt, .md) aos requisitos
    let finalRequirements = userRequirements || '';
    const validAttachments = attachments || [];
    validAttachments.forEach(att => {
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
   1. Plano de comunicação (Momento [Pré-deploy, deploy, pós-deploy], Público, Canal, Conteúdo)
   2. Objetivo
   3. Contexto e Justificativa de Negócio
   4. Escopo Funcional
   5. Requisitos Funcionais (RF-001 - Descrição, Atores, Resultado. OBRIGATÓRIO: Tabela de "Alterações funcionais em tela, relatório ou processo" com as colunas: Campo/elemento, Descrição funcional, Tipo/formato, Obrigatório, Regra/domínio, Exemplo).
   6. Requisitos Não Funcionais (Listar explicitamente itens que não serão tratados nesta demanda para evitar interpretações divergentes).
   7. Diagramas e Fluxos Visuais (Mermaid) (Desenhar fluxos de sistema, sequência, estados ou casos de uso pertinentes aos requisitos).
   8. Regras de Negócio (RN-001 - Fluxo Principal, Alternativos, Exceção, Validações obrigatórias, Permissões funcionais, Cálculos).
   9. Premissas, restrições, riscos e dependências (OBRIGATÓRIO: Uma tabela para Premissas com [ID, Premissa, Responsável] e uma tabela para Restrições com [ID, Restrição, Impacto funcional]).
   10. Critérios de Aceite
   11. Anexos funcionais (Apenas citar necessidade de mockups/regras).
   12. Glossário (OBRIGATÓRIO: Tabela com [Termo/sigla, Definição]).

2. INFORMAÇÕES AUSENTES: Se os "Requisitos do Usuário" não fornecerem informações suficientes para preencher um determinado tópico do template (dos 12 acima), você DEVE gerar o título do tópico normalmente (Ex: "# 10. Critérios de Aceite") e inserir como conteúdo exatamente este texto: "[PENDENTE: Informação ausente no requisito original]".
3. RETENÇÃO TOTAL (PROIBIDO RESUMIR): É terminantemente PROIBIDO resumir, abreviar ou parafrasear. Se o usuário forneceu textos densos, cenários BDD, regras de negócio ou Critérios de Aceite, você DEVE preservar as sentenças originais (copiar e colar o texto base) e APENAS EXPANDIR adicionando novos cenários ou detalhes que faltaram. Nunca condense listas.
4. DIAGRAMAS E VISUAL: Use a sessão 7 para gerar e preservar diagramas visuais (Mermaid). A renderização aceita APENAS sintaxe padrão do Mermaid.js. Não suportamos "usecaseDiagram", "actor" ou PlantUML. Caso haja diagramas de uso na origem, converta-os OBRIGATORIAMENTE para um Diagrama de Fluxo (flowchart TD/LR) em sintaxe Mermaid válida.
5. ENROBUSTECIMENTO: Transforme anotações em uma especificação de nível Sênior/Especialista. Expanda os conceitos com casos de borda (sad paths), tratamentos de erro, regras de validação e requisitos não-funcionais (performance, segurança).
6. Não adicione saudações, conclusões verbais ou explicações fora do Markdown. Não crie um tópico de Sumário, pois o sistema já gera índices automaticamente.
        `.trim();
    }

    const tryGenerateWithModel = async (modelName) => {
        const model = genAI.getGenerativeModel({ model: modelName });
        
        const pdfAttachments = validAttachments.filter(a => a.mimeType === 'application/pdf');
        
        if (pdfAttachments.length === 0) {
            return await model.generateContent(finalPrompt);
        } else {
            const promptParts = [ finalPrompt ];
            pdfAttachments.forEach(att => {
                if (att.data) {
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

    let result;
    try {
        result = await tryGenerateWithModel("gemini-3.1-pro");
    } catch (err0) {
        console.warn("Falha com gemini-3.1-pro, tentando fallback gemini-3.5-flash...", err0);
        try {
            result = await tryGenerateWithModel("gemini-3.5-flash");
        } catch (err) {
            console.error("Falha com os modelos.", err);
            throw new HttpsError("internal", "Falha na comunicação com a API do Gemini: " + err.message);
        }
    }

    try {
        const response = await result.response;
        return { text: response.text() };
    } catch (error) {
        console.error("Erro ao processar resposta da especificação:", error);
        throw new HttpsError("internal", "Erro ao processar a resposta do Gemini: " + error.message);
    }
});
