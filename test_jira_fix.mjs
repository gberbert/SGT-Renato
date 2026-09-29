/**
 * Teste local das correções de API Jira (HTTP 410 → POST /rest/api/3/search/jql)
 * Lê credenciais de functions/.env — não requer deploy.
 */
import fs from "fs";

const envContent = fs.readFileSync("./functions/.env", "utf-8");
const envVars = envContent.split("\n").reduce((acc, line) => {
  const [key, ...value] = line.split("=");
  if (key && value.length > 0) acc[key.trim()] = value.join("=").trim();
  return acc;
}, {});

const token = envVars.JIRA_API_TOKEN;
const email = envVars.JIRA_USER_EMAIL;
const domain = envVars.JIRA_DOMAIN || "jiracpfl.atlassian.net";
const baseUrl = `https://${domain}`;
const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;

const JQL = `(project = TI AND type = Problem AND "fornecedores[dropdown]" = "NTT Data") or (type = Problem AND project = PROB AND cf[10382] = "ari:cloud:cmdb::object/4fc8c668-3c28-445a-921f-4cd66d1f865e/432192") or (type != Problem AND project = PROB AND cf[10382] = "ari:cloud:cmdb::object/4fc8c668-3c28-445a-921f-4cd66d1f865e/432192")`;

async function jiraGet(path) {
  const url = `${baseUrl}${path}`;
  console.log(`\nGET ${url}`);
  const res = await fetch(url, { headers: { Authorization: authHeader, Accept: "application/json" } });
  const text = await res.text();
  console.log(`→ HTTP ${res.status}`);
  if (!res.ok) { console.error("ERRO:", text); return null; }
  return JSON.parse(text);
}

async function jiraPost(path, body) {
  const url = `${baseUrl}${path}`;
  console.log(`\nPOST ${url}`);
  console.log("Body:", JSON.stringify(body, null, 2));

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  console.log(`→ HTTP ${res.status}`);

  if (!res.ok) {
    console.error("ERRO:", text);
    return null;
  }

  return JSON.parse(text);
}

async function main() {
  // ────────────────────────────────────────────────────────────
  // DIAGNÓSTICO: variáveis de ambiente
  // ────────────────────────────────────────────────────────────
  console.log("=== DIAGNÓSTICO: variáveis carregadas de functions/.env ===");
  console.log(`JIRA_USER_EMAIL: "${email}"`);
  console.log(`JIRA_API_TOKEN: ${token ? `"${token.slice(0,4)}...${token.slice(-4)}" (${token.length} chars)` : "NÃO DEFINIDO"}`);
  console.log(`JIRA_DOMAIN: "${domain}"`);
  const authPreview = authHeader.replace(/Basic /, "Basic ");
  console.log(`Authorization header: Basic ${Buffer.from(`${email}:${token}`).toString("base64").slice(0, 12)}...`);

  // ────────────────────────────────────────────────────────────
  // DIAGNÓSTICO: identidade do token
  // ────────────────────────────────────────────────────────────
  console.log("\n=== DIAGNÓSTICO: /rest/api/3/myself ===");
  const myself = await jiraGet("/rest/api/3/myself");
  if (myself) console.log(`Usuário: ${myself.emailAddress}  |  displayName: ${myself.displayName}`);

  console.log("\n=== DIAGNÓSTICO: JQL sem filtro de projeto ===");
  const anyIssue = await jiraPost("/rest/api/3/search/jql", { jql: "ORDER BY created DESC", maxResults: 1 });
  if (anyIssue) {
    console.log(`issues: ${(anyIssue.issues||[]).length}  |  isLast: ${anyIssue.isLast}`);
    if ((anyIssue.issues||[]).length > 0) console.log(`  Projeto visível: ${anyIssue.issues[0].key}`);
  }

  const JQL_SIMPLES = "project = TI ORDER BY created DESC";

  // ────────────────────────────────────────────────────────────
  // TESTE 0a: SEM fields — verifica se a ausência de fields resolve
  // ────────────────────────────────────────────────────────────
  console.log("\n=== TESTE 0a: JQL simples SEM campos (fields omitido) ===");
  const semFields = await jiraPost("/rest/api/3/search/jql", {
    jql: JQL_SIMPLES,
    maxResults: 2,
  });
  if (semFields) {
    const issues = semFields.issues || [];
    console.log(`Estrutura: ${Object.keys(semFields).join(", ")}`);
    console.log(`issues: ${issues.length}  |  isLast: ${semFields.isLast}  |  nextPageToken: ${semFields.nextPageToken ?? "ausente"}`);
    if (issues.length > 0) {
      console.log("Campos do primeiro issue:", Object.keys(issues[0].fields || {}).slice(0, 10).join(", "));
      console.log(`  - ${issues[0].key}: "${issues[0].fields?.summary?.slice(0, 60)}"`);
    }
  }

  // ────────────────────────────────────────────────────────────
  // TESTE 0b: fields como string (comma-separated) em vez de array
  // ────────────────────────────────────────────────────────────
  console.log("\n=== TESTE 0b: fields como string CSV ===");
  const csvFields = await jiraPost("/rest/api/3/search/jql", {
    jql: JQL_SIMPLES,
    maxResults: 2,
    fields: "summary,status",
  });
  if (csvFields) {
    const issues = csvFields.issues || [];
    console.log(`Estrutura: ${Object.keys(csvFields).join(", ")}`);
    console.log(`issues: ${issues.length}  |  isLast: ${csvFields.isLast}`);
    for (const issue of issues) {
      console.log(`  - ${issue.key}: "${issue.fields?.summary?.slice(0, 60)}"`);
    }
  }

  // ────────────────────────────────────────────────────────────
  // TESTE 1: maxResults=1 (0 não é permitido no novo endpoint)
  // ────────────────────────────────────────────────────────────
  console.log("\n=== TESTE 1: maxResults=1 para obter total ===");
  const countData = await jiraPost("/rest/api/3/search/jql", {
    jql: JQL,
    maxResults: 1,
  });
  if (countData) {
    console.log("Campos da resposta:", Object.keys(countData).join(", "));
    console.log(`total: ${countData.total}  |  isLast: ${countData.isLast}  |  nextPageToken: ${countData.nextPageToken ?? "ausente"}`);
    console.log(`issues retornados: ${(countData.issues || []).length}`);
  }

  // ────────────────────────────────────────────────────────────
  // TESTE 2: JQL ORIGINAL, maxResults=3, sem expand
  // ────────────────────────────────────────────────────────────
  console.log("\n=== TESTE 2: JQL original, sem expand, maxResults=3 ===");
  const pageData = await jiraPost("/rest/api/3/search/jql", {
    jql: JQL,
    maxResults: 3,
    fields: ["summary", "status", "created"],
  });
  if (pageData) {
    const issues = pageData.issues || [];
    console.log(`Campos da resposta: ${Object.keys(pageData).join(", ")}`);
    console.log(`issues: ${issues.length}  |  total: ${pageData.total ?? "ausente"}  |  isLast: ${pageData.isLast}  |  nextPageToken: ${pageData.nextPageToken ?? "ausente"}`);
    for (const issue of issues) {
      console.log(`  - ${issue.key}: "${issue.fields?.summary?.slice(0, 60)}"`);
    }
  }

  // ────────────────────────────────────────────────────────────
  // TESTE 3: sem expand — apenas fields básicos
  // ────────────────────────────────────────────────────────────
  console.log("\n=== TESTE 3: sem expand, fields básicos ===");
  const pageDataExpand = await jiraPost("/rest/api/3/search/jql", {
    jql: JQL_SIMPLES,
    maxResults: 2,
    fields: ["summary", "status"],
  });
  if (pageDataExpand) {
    const issues = pageDataExpand.issues || [];
    console.log(`Campos da resposta: ${Object.keys(pageDataExpand).join(", ")}`);
    console.log(`issues: ${issues.length}  |  isLast: ${pageDataExpand.isLast}  |  nextPageToken: ${pageDataExpand.nextPageToken ?? "ausente"}`);
    for (const issue of issues) {
      console.log(`  - ${issue.key}: "${issue.fields?.summary?.slice(0, 60)}"`);
    }
  }

  // ────────────────────────────────────────────────────────────
  // TESTE 4: maxResults=0 — causa "Invalid request payload"?
  // ────────────────────────────────────────────────────────────
  console.log("\n=== TESTE 4: maxResults=0 (getApproxCount pattern) ===");
  const maxZero = await jiraPost("/rest/api/3/search/jql", {
    jql: JQL_SIMPLES,
    maxResults: 0,
  });
  if (maxZero) {
    console.log("Campos da resposta:", Object.keys(maxZero).join(", "));
    console.log(`total: ${maxZero.total ?? "ausente"}  |  isLast: ${maxZero.isLast}  |  issues: ${(maxZero.issues||[]).length}`);
  }

  // ────────────────────────────────────────────────────────────
  // TESTE 5: JQL exato do searchJiraTickets regular path
  // ────────────────────────────────────────────────────────────
  const JQL_DEMANDA = `project = DEMANDA AND type = Solicitação AND "empresa[dropdown]" IN ("NTT Ltda", "NTT DATA", "GLOBAL NTT") AND ("torre de atuação da demanda[dropdown]" IN ("ADM & LEGADOS", "BI", "CANAIS DIGITAIS", "SISTEMAS CORPORATIVOS", "SISTEMAS WEB") OR "torre de atuação da demanda[dropdown]" IS EMPTY) ORDER BY created DESC`;

  console.log("\n=== TESTE 5: JQL exato do searchJiraTickets + fields array ===");
  const demandaTest = await jiraPost("/rest/api/3/search/jql", {
    jql: JQL_DEMANDA,
    maxResults: 5,
    fields: ["summary", "description", "priority", "status", "creator", "reporter", "assignee", "issuetype", "duedate", "environment", "labels", "created"],
  });
  if (demandaTest) {
    const issues = demandaTest.issues || [];
    console.log(`issues: ${issues.length}  |  isLast: ${demandaTest.isLast}  |  nextPageToken: ${demandaTest.nextPageToken ?? "ausente"}`);
    if (issues.length > 0) console.log(`  Primeiro: ${issues[0].key}: "${issues[0].fields?.summary?.slice(0, 60)}"`);
  }

  // ────────────────────────────────────────────────────────────
  // TESTE 6: getApproxCount via callable endpoint (HTTP POST Firebase)
  // ────────────────────────────────────────────────────────────
  console.log("\n=== TESTE 6: searchJiraTickets via Cloud Function (approximateCount=true) ===");
  const cfRes = await fetch("https://us-central1-sgt-renato.cloudfunctions.net/searchJiraTickets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: { approximateCount: true, jql: JQL_DEMANDA } }),
  });
  const cfText = await cfRes.text();
  console.log(`→ HTTP ${cfRes.status}`);
  try { console.log(JSON.stringify(JSON.parse(cfText), null, 2)); } catch { console.log(cfText); }

  // ────────────────────────────────────────────────────────────
  // TESTE 7: Exatamente como o Postman — fields do screenshot
  // ────────────────────────────────────────────────────────────
  console.log("\n=== TESTE 7: Postman mirror — mesmos fields do screenshot ===");
  const postmanMirror = await jiraPost("/rest/api/3/search/jql", {
    jql: JQL_DEMANDA,
    maxResults: 20,
    fields: ["summary", "status", "assignee", "priority", "created", "updated"],
  });
  if (postmanMirror) {
    const issues = postmanMirror.issues || [];
    console.log(`issues: ${issues.length}  |  isLast: ${postmanMirror.isLast}  |  nextPageToken: ${postmanMirror.nextPageToken ?? "ausente"}`);
    for (const issue of issues.slice(0, 3)) {
      console.log(`  - ${issue.key}: "${(issue.fields?.summary || '').slice(0, 70)}"`);
      console.log(`    status: ${issue.fields?.status?.name}  |  priority: ${issue.fields?.priority?.name}  |  assignee: ${issue.fields?.assignee?.displayName ?? "nenhum"}`);
    }
  }

  // ────────────────────────────────────────────────────────────
  // TESTE 8: Cloud Function regular path com JQL real
  // ────────────────────────────────────────────────────────────
  console.log("\n=== TESTE 8: searchJiraTickets regular path via Cloud Function (com JQL) ===");
  const cfRes2 = await fetch("https://us-central1-sgt-renato.cloudfunctions.net/searchJiraTickets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: {
        jql: JQL_DEMANDA,
        maxResults: 5,
      },
    }),
  });
  const cfText2 = await cfRes2.text();
  console.log(`→ HTTP ${cfRes2.status}`);
  try {
    const parsed = JSON.parse(cfText2);
    const result = parsed.result || parsed;
    const issues = result.issues || [];
    console.log(`issues: ${issues.length}  |  isLast: ${result.isLast}  |  nextPageToken: ${result.nextPageToken ?? "ausente"}`);
    for (const issue of issues.slice(0, 3)) {
      console.log(`  - ${issue.code}: "${(issue.title || '').slice(0, 70)}"`);
      console.log(`    status: ${issue.status}  |  priority: ${issue.priority}  |  assignee: ${issue.jiraAssignee || "nenhum"}`);
    }
  } catch { console.log(cfText2); }
}

main().catch((e) => {
  console.error("Erro inesperado:", e);
  process.exit(1);
});
