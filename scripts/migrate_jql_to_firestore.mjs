/**
 * Script de migração: lê as 6 JQLs do arquivo functions/data/jqls_carga.txt
 * e grava cada uma como documento na collection `jql_overrides` do Firestore.
 *
 * Uso:
 *   node scripts/migrate_jql_to_firestore.mjs
 *
 * Requer variáveis de ambiente do Firebase Admin (GOOGLE_APPLICATION_CREDENTIALS
 * ou emulador local configurado).
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIREBASE_RC = join(__dirname, '..', '.firebaserc');
const JQL_FILE = join(__dirname, '..', 'functions', 'data', 'jqls_carga.txt');

// ─── Firebase init ───────────────────────────────────────────────────────────
if (!getApps().length) {
  const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (serviceAccount && existsSync(serviceAccount)) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(serviceAccount, 'utf8'))) });
  } else {
    // Usa credenciais padrão (gcloud auth / emulador)
    initializeApp();
  }
}
const db = getFirestore();

// ─── Helpers do parser (replicados de functions/jqlCarga.js) ─────────────────
function normalizeEscopo(name) {
  const n = name.trim().replace(/\s+/g, ' ').toUpperCase();
  if (n.includes('PROBLEMA')) return 'PROBLEMAS';
  if (/DEMANDAS?\s+FAST/.test(n)) return 'DEMANDA FAST';
  if (/CAT.*LOGO/.test(n)) return 'CATALOGO';
  if (n.includes('INCIDENTE')) return 'INCIDENTE';
  if (n.includes('SOLICITA')) return 'SOLICITACAO';
  if (n.includes('DEMANDA')) return 'DEMANDA';
  return name.trim().toUpperCase();
}

function escopoNomeToId(nome) {
  const map = {
    PROBLEMAS: 'problemas',
    'DEMANDA FAST': 'demanda-fast',
    DEMANDA: 'demanda',
    INCIDENTE: 'incidente',
    SOLICITACAO: 'solicitacao',
    CATALOGO: 'catalogo',
  };
  return map[nome] || nome.toLowerCase().replace(/\s+/g, '-');
}

function formatJqlLines(lines) {
  return lines.map(l => l.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function readJqls(filePath) {
  if (!existsSync(filePath)) throw new Error(`Arquivo não encontrado: ${filePath}`);
  const batches = [];
  let currentName = null;
  let currentLines = [];

  const flush = () => {
    if (!currentName) return;
    const jql = formatJqlLines(currentLines);
    if (!jql) return;
    const escopo = normalizeEscopo(currentName);
    batches.push({
      escopoId: escopoNomeToId(escopo),
      escopo,
      label: escopo,
      jql,
    });
    currentName = null;
    currentLines = [];
  };

  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*CONSULTA\s+\d+\s+(.+)\s*$/i);
    if (match) { flush(); currentName = match[1].trim(); currentLines = []; continue; }
    if (currentName !== null) currentLines.push(line);
  }
  flush();
  return batches;
}

// ─── Migração ─────────────────────────────────────────────────────────────────
async function main() {
  const batches = readJqls(JQL_FILE);
  console.log(`\n📋 ${batches.length} JQL(s) encontrada(s) em ${JQL_FILE}\n`);

  for (const batch of batches) {
    const ref = db.collection('jql_overrides').doc(batch.escopoId);
    const existing = await ref.get();

    if (existing.exists) {
      console.log(`⚠  jql_overrides/${batch.escopoId} já existe — pulando (use --force para sobrescrever)`);
      continue;
    }

    await ref.set({
      escopoId: batch.escopoId,
      escopo: batch.escopo,
      label: batch.label,
      jql: batch.jql,
      originalJql: batch.jql,
      ativo: true,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: 'migration-script',
      description: `JQL migrada automaticamente do arquivo jqls_carga.txt`,
    });

    console.log(`✅ jql_overrides/${batch.escopoId} (${batch.escopo}) gravado`);
    console.log(`   JQL: ${batch.jql.slice(0, 100)}…\n`);
  }

  console.log('\n🎉 Migração concluída.');
}

main().catch(err => { console.error('Erro:', err); process.exit(1); });
