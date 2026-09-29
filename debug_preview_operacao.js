#!/usr/bin/env node
/**
 * Debug script para testar a prévia de carga de tickets da Operação
 * Testa cada JQL configurado e mostra contagem de tickets
 */

const admin = require('firebase-admin');
const path = require('path');

// Inicializa Firebase Admin
const serviceAccountPath = path.join(__dirname, 'functions', 'service-account-key.json');
try {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (e) {
  console.error('❌ Falha ao carregar credenciais Firebase:', e.message);
  console.log('Usando credenciais do ambiente...');
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

const { getFirestore } = require('firebase-admin/firestore');
const { JQLS_DEFAULT } = require('./functions/jqlCarga');

async function getJiraCredentials() {
  const token = process.env.JIRA_API_TOKEN;
  const email = process.env.JIRA_USER_EMAIL;
  const domain = process.env.JIRA_DOMAIN || 'jiracpfl.atlassian.net';
  
  if (!token || !email) {
    throw new Error('Credenciais do Jira não configuradas. Use variáveis de ambiente: JIRA_API_TOKEN, JIRA_USER_EMAIL');
  }
  
  const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
  const baseUrl = `https://${domain}`;
  
  return { token, email, domain, authHeader, baseUrl };
}

async function jiraFetch(path, { method = 'GET', body } = {}) {
  const { authHeader, baseUrl, email } = await getJiraCredentials();
  const fullUrl = `${baseUrl}${path}`;
  
  console.log(`  📡 ${method} ${fullUrl}`);
  
  const response = await fetch(fullUrl, {
    method,
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`  ❌ HTTP ${response.status}: ${errorText}`);
    throw new Error(`Jira retornou ${response.status}: ${errorText}`);
  }
  
  const data = await response.json();
  return data;
}

async function getApproxCount(jql) {
  try {
    const data = await jiraFetch('/rest/api/3/search/jql', {
      method: 'POST',
      body: {
        jql: jql || '',
        maxResults: 1,
        fields: ['summary'],
      },
    });
    
    const count = Number(data.total) || 0;
    return count;
  } catch (error) {
    console.error(`  ❌ Erro ao contar: ${error.message}`);
    throw error;
  }
}

async function loadJqlBatchesWithOverrides() {
  try {
    const db = getFirestore();
    const docRef = db.doc('operacao_config/jql_overrides');
    const snap = await docRef.get();
    
    if (!snap.exists) {
      console.log('  ℹ️  operacao_config/jql_overrides não encontrado — usando JQLS_DEFAULT');
      return JQLS_DEFAULT;
    }
    
    const data = snap.data() || {};
    console.log(`  ✅ Encontrados ${Object.keys(data).length} overrides em Firestore`);
    
    return JQLS_DEFAULT.map((batch) => {
      const jqlFromFirestore = data[batch.escopoId];
      if (jqlFromFirestore) {
        return { ...batch, jql: jqlFromFirestore, source: 'firestore' };
      }
      return { ...batch, source: 'default' };
    });
  } catch (e) {
    console.warn(`  ⚠️  Falha ao carregar overrides: ${e.message}`);
    return JQLS_DEFAULT.map((b) => ({ ...b, source: 'default' }));
  }
}

async function testPreviewCarga() {
  console.log('\n🔍 === DEBUG: PRÉVIA DE CARGA OPERAÇÃO === 🔍\n');
  
  try {
    console.log('1️⃣  Carregando batches com overrides...');
    const batches = await loadJqlBatchesWithOverrides();
    
    const validBatches = batches.filter((b) => {
      if (!b.jql || typeof b.jql !== 'string' || !b.jql.trim()) {
        console.log(`  ⚠️  Batch "${b.label}" (${b.escopoId}) tem JQL vazio, pulando...`);
        return false;
      }
      return true;
    });
    
    console.log(`\n✅ Total de ${validBatches.length} batches com JQL válido\n`);
    
    let totalCount = 0;
    const results = [];
    
    for (const batch of validBatches) {
      console.log(`2️⃣  Testando batch: "${batch.label}" (${batch.escopo})`);
      console.log(`   Fonte: ${batch.source}`);
      console.log(`   JQL: ${batch.jql.substring(0, 80)}${batch.jql.length > 80 ? '...' : ''}`);
      
      let count = 0;
      let error = null;
      
      try {
        count = await getApproxCount(batch.jql);
        console.log(`   ✅ Contagem: ${count} tickets\n`);
      } catch (e) {
        error = e.message;
        console.log(`   ❌ Erro: ${error}\n`);
      }
      
      totalCount += count;
      results.push({
        label: batch.label,
        escopo: batch.escopo,
        escopoId: batch.escopoId,
        total: count,
        error,
        jqlLength: batch.jql.length,
      });
    }
    
    console.log('\n3️⃣  === RESUMO FINAL ===');
    console.log(`Total de tickets encontrados: ${totalCount}`);
    console.log('\nDetalhes por batch:');
    for (const r of results) {
      const status = r.error ? '❌' : '✅';
      console.log(`${status} ${r.label.padEnd(25)} | ${r.escopo.padEnd(15)} | Total: ${String(r.total).padStart(6)}`);
      if (r.error) {
        console.log(`   └─ Erro: ${r.error}`);
      }
    }
    
    console.log(`\n🎯 RESULTADO FINAL: ${totalCount} tickets`);
    
  } catch (error) {
    console.error('\n❌ Erro fatal:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
  
  process.exit(0);
}

// Executa o teste
testPreviewCarga();
