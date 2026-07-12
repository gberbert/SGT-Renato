# Versionamento do Projeto

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
