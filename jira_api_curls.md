# Jira API — Curls para Teste (Postman / Terminal)

> **Preencha as variáveis antes de usar:**
> - `SEU_EMAIL` → e-mail da conta Atlassian (ex: usuario@empresa.com)
> - `SEU_API_TOKEN` → token gerado em https://id.atlassian.com/manage-profile/security/api-tokens
> - O domínio já está fixo: `jiracpfl.atlassian.net`

---

## 🔑 Como gerar o header Authorization

```bash
# Base64 de "email:token"
echo -n "SEU_EMAIL:SEU_API_TOKEN" | base64
# Resultado ex: dXN1YXJpb0BleGVtcGxvLmNvbTpBQkNERUY...
```

O header fica: `Authorization: Basic dXN1YXJpb0BleGVtcGxvLmNvbTpBQkNERUY...`

---

## 1. ✅ Teste de Autenticação (GET /myself)

Confirma se as credenciais estão válidas.

```bash
curl -s \
  --request GET \
  --url "https://jiracpfl.atlassian.net/rest/api/3/myself" \
  --user "SEU_EMAIL:SEU_API_TOKEN" \
  --header "Accept: application/json" | python3 -m json.tool
```

**Resposta esperada:** `200 OK` com dados do usuário (`displayName`, `emailAddress`, etc.)

---

## 2. 🔍 Busca JQL — novo endpoint (POST /rest/api/3/search/jql)

**Este é o endpoint que o SGT usa em `jiraGlobalSync.js` e `searchJiraTickets`.**

```bash
curl -s \
  --request POST \
  --url "https://jiracpfl.atlassian.net/rest/api/3/search/jql" \
  --user "SEU_EMAIL:SEU_API_TOKEN" \
  --header "Accept: application/json" \
  --header "Content-Type: application/json" \
  --data '{
    "jql": "project = TI AND type = Problem AND \"fornecedores[dropdown]\" = \"NTT Data\" ORDER BY created DESC",
    "startAt": 0,
    "maxResults": 5,
    "fields": [
      "summary",
      "status",
      "issuetype",
      "priority",
      "assignee",
      "creator",
      "created",
      "labels"
    ]
  }' | python3 -m json.tool
```

**Resposta esperada:** `200 OK` com `{ "issues": [...], "total": N }`

---

## 3. 📊 Contagem aproximada (maxResults=0) — usado pelo "Atualizar Prévia"

O botão **"Atualizar prévia"** chama `getApproxCount()`, que usa este padrão:

```bash
curl -s \
  --request POST \
  --url "https://jiracpfl.atlassian.net/rest/api/3/search/jql" \
  --user "SEU_EMAIL:SEU_API_TOKEN" \
  --header "Accept: application/json" \
  --header "Content-Type: application/json" \
  --data '{
    "jql": "project = TI AND type = Problem AND \"fornecedores[dropdown]\" = \"NTT Data\"",
    "maxResults": 0,
    "fields": []
  }' | python3 -m json.tool
```

**Resposta esperada:** `{ "total": N, "issues": [] }` — só o total, sem carregar issues.

---

## 4. 📋 Busca por issue específica (GET /rest/api/3/issue/{key})

Usado por `importJiraTicket` no Cloud Function:

```bash
curl -s \
  --request GET \
  --url "https://jiracpfl.atlassian.net/rest/api/3/issue/TI-22822?expand=changelog" \
  --user "SEU_EMAIL:SEU_API_TOKEN" \
  --header "Accept: application/json" | python3 -m json.tool
```

---

## 5. 🔄 Paginação com nextPageToken (usado em carga operação)

O `searchOperacaoIssues` usa `nextPageToken` para paginar:

```bash
# Primeira página
curl -s \
  --request POST \
  --url "https://jiracpfl.atlassian.net/rest/api/3/search/jql" \
  --user "SEU_EMAIL:SEU_API_TOKEN" \
  --header "Accept: application/json" \
  --header "Content-Type: application/json" \
  --data '{
    "jql": "project = TI AND type = Problem AND \"fornecedores[dropdown]\" = \"NTT Data\" ORDER BY created DESC",
    "maxResults": 50,
    "fields": ["summary", "status", "issuetype", "assignee", "created"]
  }' | python3 -m json.tool

# Próxima página (usar nextPageToken retornado na resposta anterior)
curl -s \
  --request POST \
  --url "https://jiracpfl.atlassian.net/rest/api/3/search/jql" \
  --user "SEU_EMAIL:SEU_API_TOKEN" \
  --header "Accept: application/json" \
  --header "Content-Type: application/json" \
  --data '{
    "jql": "project = TI AND type = Problem AND \"fornecedores[dropdown]\" = \"NTT Data\" ORDER BY created DESC",
    "maxResults": 50,
    "nextPageToken": "TOKEN_DA_RESPOSTA_ANTERIOR",
    "fields": ["summary", "status", "issuetype", "assignee", "created"]
  }' | python3 -m json.tool
```

---

## 6. ☁️ Chamar o Cloud Function searchJiraTickets diretamente

Requer um **ID Token** do Firebase (obtenha no SGT via DevTools → Network → qualquer request autenticado → header `Authorization`).

```bash
curl -s \
  --request POST \
  --url "https://us-central1-sgt-renato.cloudfunctions.net/searchJiraTickets" \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer SEU_FIREBASE_ID_TOKEN" \
  --data '{
    "data": {
      "approximateCount": true,
      "jql": "project = TI AND type = Problem AND \"fornecedores[dropdown]\" = \"NTT Data\""
    }
  }' | python3 -m json.tool
```

---

## 7. ☁️ Chamar previewJiraGlobalCarga (admin only)

```bash
curl -s \
  --request POST \
  --url "https://us-central1-sgt-renato.cloudfunctions.net/previewJiraGlobalCarga" \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer SEU_FIREBASE_ID_TOKEN" \
  --data '{ "data": {} }' | python3 -m json.tool
```

---

## JQLs de Carga do SGT (extraídas de `functions/data/jqls_carga.txt`)

| Escopo | JQL (resumida) |
|---|---|
| PROBLEMAS | `(project = TI AND type = Problem AND "fornecedores[dropdown]" = "NTT Data") OR (type = Problem AND project = PROB AND cf[10382] = "...")` |
| DEMANDA FAST | `project = SERVICE ...` |

> Para JQL completa, consulte o arquivo `functions/data/jqls_carga.txt`

---

## ⚠️ Onde estão as credenciais em produção?

As variáveis `JIRA_API_TOKEN`, `JIRA_USER_EMAIL` e `JIRA_DOMAIN` **não estão em arquivo local** — foram configuradas diretamente no **Google Cloud Run** via console:

```
https://console.cloud.google.com/run/detail/us-central1/searchjiratickets/edit_and_deploy_new_revision?project=sgt-renato
```

Para recuperar ou atualizar:
1. Acesse o link acima
2. Aba **"Variables & Secrets"**
3. Os valores aparecem como variáveis de ambiente da revisão ativa
