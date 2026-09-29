# Análise do Erro: Preview de Carga Operação Retorna 0

## Problema Identificado

O erro no anexo mostra: **"Jira retornou 410"** ao tentar fazer preview da carga de tickets.

```
Jira retornou 410: {"errorMessages":["API solicita foi removida. Migre para a API /rest/api/3/search/jql. Uma diretriz de migração completa está disponível em https://developer.atlassian.com/changelog/#CHANGE-2046"]}
```

## Root Cause

A API do Jira `/rest/api/2/search` foi descontinuada. O código **já foi parcialmente migrado** para `/rest/api/3/search/jql`, mas há um problema crítico no parâmetro `expand`:

### Problema 1: Parâmetro `expand` inválido
No arquivo `functions/jiraGlobalSync.js`, linha ~650, o endpoint POST tenta usar:
```javascript
expand: "changelog"  // ❌ NÃO é válido na API v3
```

**Solução**: Na API v3, não use `expand`. O changelog vem naturalmente nos resultados de search.

### Problema 2: Credenciais não configuradas
O preview tenta autenticar com Jira, mas as credenciais não estão definidas:
- `JIRA_API_TOKEN` 
- `JIRA_USER_EMAIL`

## Solução Completa

### 1. Remover `expand: "changelog"` do POST da API v3

**Arquivo**: `functions/jiraGlobalSync.js`

Localizar a função `searchIssuesPageGet()` (~linha 650) e remover o parâmetro `expand`:

```javascript
// ANTES (❌ ERRADO):
expand: "changelog",

// DEPOIS (✅ CORRETO):
// Remover a linha expand - não é suportado na API v3
```

### 2. Configurar credenciais do Jira

Para local development, adicionar ao `.env.local` ou configurar as variáveis:
```bash
export JIRA_API_TOKEN="seu_token_aqui"
export JIRA_USER_EMAIL="seu_email@example.com"
export JIRA_DOMAIN="jiracpfl.atlassian.net"
```

Para Firebase Cloud Functions (production), usar:
```bash
firebase functions:config:set jira.api_token="token" jira.user_email="email" jira.domain="domain"
```

## Arquivos Afetados

1. **functions/jiraGlobalSync.js** - Remove `expand: "changelog"` da função `searchIssuesPageGet()`
2. **functions/jqlCarga.js** - JQLs padrão estão corretos
3. **functions/index.js** - Validação de credenciais está OK

## Status

- ✅ Migração para API v3 já foi iniciada
- ✅ JQLs padrão estão configurados
- ❌ Parâmetro `expand` precisa ser removido
- ❌ Credenciais Jira precisam ser configuradas
