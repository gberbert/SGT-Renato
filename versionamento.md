# Versionamento do Projeto

## [0.1.219] - 2026-08-24
- **Feature (Team & Permissões):** Novo módulo `Team` (visão de equipe consolidada com dados de CSR/Ratecard) e sistema de perfis de permissão (`PermissionsManager.jsx`, `permissionService.js`, `permissionKeys.js`) controlando visibilidade de itens de menu na Sidebar via `allowedFunctions` por perfil.
- **Backend (Cloud Functions):** Nova função `getOperacaoRadarBootstrap` (Admin SDK) que monta o bootstrap do Radar Operação (stats, squads, grupos, filtros) no servidor, evitando varredura pesada de `tickets_global` no browser. Nova função HTTP `enrichUsersFromTeamHttp` para enriquecer usuários a partir da coleção `team` (protegida por checagem de admin via Bearer token).
- **Fix (Cloud Functions):** Removido `require("firebase/firestore")` morto/inexistente dentro de `getOperacaoRadarBootstrap` (a função já usa exclusivamente o Admin SDK via `getFirestore`).
- **Deploy:** Build de produção + deploy de `hosting` e `functions` no projeto `sgt-renato`.

## [0.1.218] - 2026-08-19
- **Perf (Radar Operação):** painel montado a partir de `operacao_stats/summary` (1 read); drill-down por escopo sob demanda; subtotais por issue type persistidos na carga (`byIssueTypeByEscopo` + `radarByEscopo`).
- **Fix (Carga):** reset de stats não apaga mais agregados; gravação única de stats no fim da carga; fallback com count queries quando escopos ausentes.

## [0.1.217] - 2026-08-17
- **Perf (Firestore):** carga de tickets só ao abrir o Radar; removidos writes extras em pais; fingerprint de cache usa apenas `lastSyncAt` final.

## [0.1.216] - 2026-08-17
- **Fix (Radar Operação):** coluna TICKETS_VINCULADOS usa Linked work items do Jira (parent, issuelinks, subtasks) e filhos via parentKey.

## [0.1.215] - 2026-08-17
- **Radar Operação:** campo `agingDays` em `tickets_global` (data atual − created_at); colunas AGING e TICKETS_VINCULADOS na tabela drill-down.

## [0.1.214] - 2026-08-17
- **Perf (Radar Operação):** carga de tickets em background persiste ao navegar no app; cache local por usuário (IndexedDB + sessionStorage) evita recarga completa na mesma máquina/sessão.

## [0.1.213] - 2026-08-17
- **Fix (Radar Operação):** badge de carregamento ao lado do total geral; corrige reset prematuro de `ticketsLoading` na carga em background.

## [0.1.212] - 2026-08-17
- **UX (Radar Operação):** badge de carregamento ao lado dos totais; subtotais por issue type nas caixas de escopo; removida meta redundante nas raias.

## [0.1.211] - 2026-08-17
- **UX (Radar Operação):** tabela drill-down com hierarquia pai/filho via `parentKey` e expansão por ticket pai.

## [0.1.210] - 2026-08-17
- **UX (Radar Operação):** coluna ISSUETYPE e filtro por ISSUE_KEY na tabela drill-down.

## [0.1.209] - 2026-08-17
- **Fix (Radar Operação):** restaura totais por escopo — leitura correta de `byEscopo` no Firestore e preservação dos KPIs durante carga em background.

## [0.1.208] - 2026-08-17
- **Nav:** Radar Operação como tela inicial (`/`); menu Dashboard removido.

## [0.1.207] - 2026-08-17
- **Perf (Radar Operação):** totais por escopo carregam via `operacao_stats/summary`; detalhes dos tickets em background para filtros e drill-down.
- **Fix:** import `doc` em `operacaoRadarService.js` (tela em branco no dev local).

## [0.1.206] - 2026-08-17
- **Refactor (módulo único):** removido portal pós-login; Radar Operação no menu principal; Configuração/Carga Jira na aba Jira Operação em Configurações.

## [0.1.205] - 2026-08-15
- **UX (Radar Operação):** busca textual nos combobox de filtros, botão limpar filtros, rodapé com usuário autenticado e rotas Config/Carga restritas a Admin.

## [0.1.204] - 2026-08-15
- **Feature (Radar Operação):** Visão Geral com filtros (grupo, squad, status), total consolidado, KPIs por escopo clicáveis e tabela drill-down de tickets.

## [0.1.203] - 2026-08-15
- **UI (Operação Carga):** Painel de progresso com barra, percentual grande, lote atual e mini-barras por escopo.

## [0.1.202] - 2026-08-15
- **Bugfix (Operação JQL):** Corrigido parêntese faltante na consulta PROBLEMAS (`fixProblemasJql`) que causava erro 400 do Jira na prévia/carga.

## [0.1.201] - 2026-08-15
- **Refactor (Operação AMS):** Carga Jira orquestrada pelo frontend (padrão Kanban): lê Jira via `searchJiraTickets` estendida e grava em `tickets_global`, `escopo`, `grupo_atendimento` e `operacao_stats/summary` direto no Firestore.
- **Cloud Functions:** `searchJiraTickets` agora aceita `approximateCount` e `operacao` (sem depender das functions novas dedicadas).
- **UI:** Visão Geral lê stats direto do Firestore; Carga exibe aviso de deploy único de functions.

## [0.1.200] - 2026-08-15
- **Feature (Operação AMS — Fase 0 + Fase 1):** Carga Jira amplificada com 6 JQLs (`jqls_carga.txt`), preview com contagem aproximada, sync chunked para Firestore (`tickets_global`, `escopo`, `grupo_atendimento`, `jira_sync_runs`, `operacao_stats/summary`).
- **Cloud Functions:** `getJiraGlobalJqlConfig`, `previewJiraGlobalCarga`, `startJiraGlobalSync`, `processJiraGlobalSyncStep`, `getJiraGlobalSyncStatus`, `getOperacaoStats`.
- **UI Operação:** Menu Configuração Jira (JQLs read-only), tela Carga com prévia e progresso, Visão Geral com stats agregados.
- **Mitigação ~31k tickets:** documentos enxutos (sem `raw_fields`), batch writes, sync por escopo com `pageToken`, agregados em 1 doc para evitar leituras massivas no painel.

## [0.1.199] - 2026-08-13
- **Feature (Module Portal):** Added a post-login module selector so users can choose between **Gestão de Demandas** (existing SGT workflow) and **Operação AMS** (new operational shell prepared for future imports).
- **Architecture:** Introduced `ModulePortal`, `ModuleGuard`, `DemandasLayout`, and `OperacaoLayout` with session-based module routing (`sgt_active_module`).
- **Navigation:** Added "Trocar módulo" action in both module sidebars; logout now clears the selected module.

## [0.1.197] - 2026-07-28
- **Feature (Capacity Planning):** Added a new filter by Activity Type (T-Shirt, Estimativa, EF, ET, Desenvolvimento) in the Capacity Planning screen. The filter defaults to "T-Shirt" to streamline initial planning. The pending activities badge now displays the count of filtered items versus total pending items (e.g., "Pendentes (2/10)").

- **Bugfix (Capacity Planning):** Fixed an issue where Estimativas and other activities were not being removed from the "Pending Activities" list after being allocated to a user's calendar cell, allowing duplicate allocations. Unified the pending filter check and ensured all activity types properly inherit their assigned user state in the planning context.

- **Bugfix (Mermaid Decoder):** Added robust sanitation to `CodeRenderer.jsx` to decode HTML entities (like `&quot;`) injected by ReactMarkdown, replace invisible non-breaking spaces generated by LLMs with normal spaces, and strictly convert ambiguous `subgraph "Title"` definitions into universally supported `subgraph sg_X ["Title"]` structures to prevent silent syntax errors in the Mermaid parser.

- **Bugfix (Mermaid):** Removed the experimental Regex Sanitizer from `CodeRenderer.jsx` as it was corrupting correctly quoted Mermaid nodes by nesting quotes around parentheses. The solution relies strictly on the updated AI prompt which forces proper quotes on generation.

## [0.1.193] - 2026-07-28
- **Bugfix (PDF Print Margins):** Fixed the right margin cutoff issue entirely by enforcing `table-layout: fixed` and `max-width: 100%` on the outermost `.print-content-table` and adjusting `.pdf-page` padding to `0 5mm !important` during print.

## [0.1.192] - 2026-07-28
- **Bugfix (PDF Print CSS):** Fixed `min-width: 800px` causing print dialogs to overflow the A4 boundaries on the right margin. Implemented global `box-sizing: border-box` and `min-width: auto` on `@media print` query in `CpflPdfTemplate.css`.

## [0.1.191] - 2026-07-28
- **Bugfix (PDF & UI):** Fixed PDF right margin overflow in `CpflPdfTemplate.css` by forcing `max-width`, `table-layout: fixed`, and `word-break` on Markdown tables.
- **Bugfix (Mermaid Parser):** Implemented a Regex Sanitizer in `CodeRenderer.jsx` to automatically enclose unquoted node labels with double quotes, preventing fatal Mermaid parse errors when special characters (like parentheses) are generated by AI.

## [0.1.190] - 2026-07-28
- **Features:** Added a dynamic search field to the User Management screen in the Admin area, allowing filtering by display name, email, and short name.

## [0.1.117] - 2026-07-12
- **Bugfix (Capacity Planning):** Corrigido bug de mapeamento visual no Kanban de planejamento onde Especificações Técnicas (ET) e Funcionais (EF) recém-criadas pelo sistema não apareciam na lista de pendentes caso o usuário de destino fosse "Não Atribuído" em vez de nulo ou "Sem responsável". O filtro de mapeamento agora considera `assignee` e o fallback para `authorName`.

## [0.1.116] - 2026-07-12
- **Documentation:** Updated the UML Sequence diagrams in the Help Flow (`HelpFlow.jsx`) to separate the T-Shirt step and explicitly show the automated generation of Development cards for Estimations per system/functionality.

## [0.1.55] - 2026-07-09
- **Cascade Updates (Real-time):** Alterações no Squad da Demanda Pai agora são instantaneamente sincronizadas para todas as Atividades filhas no Firestore, dispensando a necessidade de re-salvar a Estimativa original.
- **UI Bugfix:** Corrigido o `Select` component do Radix UI que exibia uma caixa vazia ao invés de "Sem Squad" ou "Sem responsável" quando os valores originais eram vazios.
- **Access Control:** Removido o mock que forçava acesso de 'Admin' no frontend e substituído por uma busca segura e direta do nível de acesso na base de usuários.

## [0.1.45 a 0.1.54] - 2026-07-09
- **Módulo de Estimativas de Esforço:** Lançamento do novo motor de Estimativas. Criação e gestão de linhas detalhadas de escopo com cálculo automático de horas baseadas nas Regras de Negócio e complexidade cadastradas no Admin.
- **Kanban Segregado:** Demandas e Atividades agora vivem em pranchas visuais separadas (`board: 'demandas'` vs `board: 'atividades'`), limpando a visão gerencial.
- **Autogeração de Atividades:** O fluxo de "Salvar" de uma estimativa agora sincroniza e converte automaticamente linhas de escopo em cards de Atividades atrelados nativamente à Demanda Pai, sem duplicidade de IDs, realizando limpeza orfã dinâmica.
- **UI Enhancements:** Atualização do Kanban Card e Ticket Details Modal para exibir títulos contextualizados em badgets (ex: "DEM-777") no lugar de IDs internos de atividades geradas (ex: "SGT-4062") para maior clareza hierárquica.

## [0.1.44] - 2026-07-08
- **Background Push Notifications:** Migrated push system to FCM (Firebase Cloud Messaging) and Firebase Cloud Functions. Implemented `firebase-messaging-sw.js` and server-side APNs/FCM dispatch to support true background notifications when iOS/Android apps are minimized or devices are locked.


## [0.1.43] - 2026-07-08
- **Web Push Notifications:** Restored and fully implemented native OS notifications for incoming messages in real-time. Added a snapshot differential checker to fire `new Notification()` only for newly added database records, fixing the silent behavior on iOS PWAs.


## [0.1.42] - 2026-07-08
- **Bugfix (Chat Mentions):** Fixed a bug where marking a user in the chat would no longer trigger a notification. The HTML parsing logic was brittle and failed when TipTap changed the order of HTML attributes. Replaced Regex with a robust `DOMParser`.


## [0.1.41] - 2026-07-08
- **UI Adjustments:** Fixed the flexbox wrapping issue inside the iOS installation instruction modal, ensuring the text flows naturally and the Share icon aligns properly with the text.


## [0.1.40] - 2026-07-08
- **Notifications UX:** Clicking a notification now fully deletes it from the user's list (instead of merely marking it as read), cleaning up the inbox automatically as they navigate to the mentioned ticket.


## [0.1.39] - 2026-07-08
- **UI Adjustments & Mobile Enhancements:** Multi-component UX optimizations.
  - **Squad Management:** Forced full-screen layout on mobile using the `.ticket-modal` rules, preventing viewport overflow and improving touch interactions.
  - **Settings Menu:** Redesigned mobile navigation by encapsulating the traditional Tab list into a modern Dropdown Select menu, heavily reducing visual clutter on small screens.
  - **Roadmap Filters:** Encapsulated individual select filters into a single "Filtros e Agrupamento" popover, freeing up valuable vertical space for the Gantt timeline view.


## [0.1.38] - 2026-07-08
- **UI Adjustments:** Revised Kanban header layout for mobile devices.
  - Replaced horizontal scroll with a stacked column layout (`flex-direction: column`).
  - Placed Project/Squad dropdown filters on the first row and view toggle buttons on the second row.
  - Forced elements to split available width evenly using `flex: 1` to ensure they fit harmoniously on screen without wrapping or scrolling.


## [0.1.37] - 2026-07-08
- **UI Adjustments:** Refined mobile Kanban header.
  - Reduced font sizes for dropdowns and buttons on narrow screens.
  - Abbreviated button texts on mobile to save horizontal space.
  - Applied horizontal scrolling to the header container avoiding awkward line breaks.


## [0.1.36] - 2026-07-08
- **Hotfix:** Mobile Layout Optimizations for Ticket Modal.
  - Forced `position: fixed` and `inset: 0` for mobile modals to bypass Radix UI's internal overlay padding and translate matrix, fixing horizontal overflow.
  - Applied horizontal scroll (`overflow-x: auto`) and hidden scrollbars to the `Tabs.List` component, ensuring long tab labels do not stretch the viewport on small screens.
  - Hardcoded width constraint to `100vw` with `box-sizing: border-box` to ensure pixel-perfect boundary mapping on iOS Safari.


## [0.1.35] - 2026-07-08
- **Features:** Major UI/UX Overhaul for Ticket Details Modal.
  - Implemented full-screen responsive layout for mobile and fixed dimensions for desktop.
  - Restructured Chat section with WhatsApp-style bottom alignment and fixed Radix UI flex-grow collapses.
  - Redesigned Modal Header adopting Jira/Linear modern layout (Top metadata, bottom title).
  - Enhanced Tiptap mention system: removed '@' prefix in rendered text and styled with WhatsApp blue directly in chat balloons.
  - Added `@Todos` superuser mention for batch Firebase notifications to all squad members.


## [0.1.34] - 2026-07-08
- **Features:** Implementação de Gestão Avançada de Squads.
  - Vinculação de tickets a Squads na criação e edição.
  - Associação de Sistemas a Squads.
  - Definição de Perfis/Papéis (Arquiteto, Developer, Tester, Functional, Scrum Master, GP) por usuário na squad.
  - Filtro de tickets por Squad no Kanban e Tags de indicação visual de squad nos Cards.

## [0.1.33] - 2026-07-07
- **Features:** Improved Roadmap UI contrast and weekend/holiday highlighting logic.

## [0.1.2] - 2026-07-06
- **Features:** Enterprise Evolution Phases 1, 2, and 3 completed (Rich text, Dark mode, RBAC, Automations, Dashboard Analytics, Subtasks).

## [0.1.1] - 2026-07-06
- **Features:** Expose dynamic App Version in Sidebar footer (`__APP_VERSION__`).
## [0.1.0] - 2026-07-06
- **Features:** Implementation of dynamic System and Component settings.
- **Features:** Overhaul of Ticket Creation form (fixed Backlog status, Date inputs, external ticket).
- **Features:** Kanban Board now supports List View toggling.
- **Features:** Roadmap enhanced with advanced multi-filtering and persistent saved views.

## [0.0.0] - Inicial
- **Data:** 2026-07-06
- **Alterações:** Inicialização do arquivo de versionamento e setup base da aplicação.
