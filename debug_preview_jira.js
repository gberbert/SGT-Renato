#!/usr/bin/env node
/**
 * Script de debug: Testa a requisição de preview de tickets do Jira
 * Executa: node debug_preview_jira.js
 * 
 * Este script simula exatamente o que acontece em getOperacaoPreviewWithTickets()
 */

const functions = require("firebase-functions");
require('dotenv').config();

// Simula as credenciais
function getJiraCredentials() {
  const config = functions.config();
  const token = config.jira?.api_token || process.env.JIRA_API_TOKEN;
  const email = config.jira?.user_email || process.env.JIRA_USER_EMAIL;
  const domain = config.jira?.domain || process.env.JIRA_DOMAIN || "jiracpfl.atlassian.net";
  
  if (!token || !email) {
    throw new Error("❌ Credenciais do Jira não configuradas! Configure JIRA_API_TOKEN e JIRA_USER_EMAIL");
  }
  
  const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
  const baseUrl = `https://${domain}`;
  
  return { token, email, domain, authHeader, baseUrl };
}

async function jiraFetch(path, { method = "GET", body } = {}) {
  const { authHeader, baseUrl, domain, email } = getJiraCredentials();
  const fullUrl = `${baseUrl}${path}`;
  
  console.log(`\n📡 [jiraFetch] ${method} ${fullUrl}`);
  console.log(`👤 Auth user: ${email}`);
  
  const response = await fetch(fullUrl, {
    method,
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  
  console.log(`📊 Status: ${response.status} ${response.statusText}`);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Erro HTTP ${response.status}:`);
    console.error(errorText);
    throw new Error(`Jira retornou ${response.status}: ${errorText}`);
  }
  
  const data = await response.json();
  console.log(`✅ Resposta OK`);
  return data;
}

async function getApproxCount(jql) {
  console.log(`\n🔢 [getApproxCount] Contando tickets com JQL:`);
  console.log(`   ${jql.substring(0, 150)}...`);
  
  try {
    const data = await jiraFetch("/rest/api/3/search/jql", {
      method: "POST",
      body: {
        jql: jql || "",
        maxResults: 1,
        fields: ["summary"],
      },
    });
    
    const count = Number(data.total) || 0;
    console.log(`✅ Total encontrado: ${count} tickets`);
    return count;
  } catch (error) {
    console.error(`❌ Erro ao contar:`, error.message);
    throw error;
  }
}

async function fetchSampleTickets(jql, maxResults = 5) {
  console.log(`\n🎫 [fetchSampleTickets] Buscando ${maxResults} amostras:`);
  
  try {
    const data = await jiraFetch("/rest/api/3/search/jql", {
      method: "POST",
      body: {
        jql: jql || "",
        startAt: 0,
        maxResults: maxResults,
        fields: ["summary", "status", "issuetype"],
      },
    });
    
    const issues = data.issues || [];
    console.log(`✅ Encontrados ${issues.length} tickets`);
    
    return issues.map((issue) => ({
      key: issue.key,
      summary: (issue.fields || {}).summary || "Sem título",
      status: ((issue.fields || {}).status || {}).name || "Desconhecido",
      issueType: ((issue.fields || {}).issuetype || {}).name || "Desconhecido",
    }));
  } catch (error) {
    console.error(`❌ Erro ao buscar amostras:`, error.message);
    return [];
  }
}

async function testPreviewCarga() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("🧪 TEST: Debug de Preview de Carga Jira");
  console.log("═══════════════════════════════════════════════════════════");
  
  try {
    // Verifica credenciais
    console.log("\n📋 [Step 1] Verificando credenciais...");
    const creds = getJiraCredentials();
    console.log(`✅ Domain: ${creds.domain}`);
    console.log(`✅ Email: ${creds.email}`);
    console.log(`✅ Token: ${creds.token.substring(0, 10)}...`);
    
    // JQL de teste simples (primeiro batch)
    const testJql = "((project = TI AND type = Problem AND \"fornecedores[dropdown]\" = \"NTT Data\") OR (type = Problem AND project = PROB))";
    
    console.log("\n📋 [Step 2] Testando contagem simples...");
    const count1 = await getApproxCount(testJql);
    
    console.log("\n📋 [Step 3] Buscando amostras de tickets...");
    const samples = await fetchSampleTickets(testJql, 5);
    
    if (samples.length > 0) {
      console.log("\n📋 Amostras encontradas:");
      samples.forEach((s, i) => {
        console.log(`   ${i + 1}. ${s.key}: ${s.summary}`);
        console.log(`      Status: ${s.status}, Tipo: ${s.issueType}`);
      });
    } else {
      console.log("⚠️  Nenhuma amostra encontrada!");
    }
    
    console.log("\n📋 [Step 4] Testando com JQL mais simples...");
    const simpleJql = "project = TI AND type = Problem LIMIT 10";
    const count2 = await getApproxCount(simpleJql);
    
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("✅ DEBUG CONCLUÍDO COM SUCESSO!");
    console.log("═══════════════════════════════════════════════════════════");
    
    console.log("\n📊 Resumo:");
    console.log(`   ✅ Conexão com Jira: OK`);
    console.log(`   ✅ Contagem JQL complexo: ${count1} tickets`);
    console.log(`   ✅ Contagem JQL simples: ${count2} tickets`);
    console.log(`   ✅ Amostras: ${samples.length} tickets recuperados`);
    
  } catch (error) {
    console.error("\n═══════════════════════════════════════════════════════════");
    console.error("❌ ERRO DURANTE O DEBUG!");
    console.error("═══════════════════════════════════════════════════════════");
    console.error(`\n${error.message}`);
    console.error("\n📝 Passos para resolver:");
    console.error("   1. Verifique se JIRA_API_TOKEN está configurado");
    console.error("   2. Verifique se JIRA_USER_EMAIL está configurado");
    console.error("   3. Verifique se JIRA_DOMAIN está correto (default: jiracpfl.atlassian.net)");
    console.error("   4. Teste manualmente com curl:");
    console.error(`      curl -u ${process.env.JIRA_USER_EMAIL}:<token> \\`);
    console.error(`        -X POST https://jiracpfl.atlassian.net/rest/api/3/search/jql \\`);
    console.error(`        -H "Content-Type: application/json" \\`);
    console.error(`        -d '{"jql":"project = TI","maxResults":1}'`);
    process.exit(1);
  }
}

// Executa
testPreviewCarga().catch(console.error);
