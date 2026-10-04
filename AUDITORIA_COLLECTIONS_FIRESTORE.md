# Auditoria: Rotas × Collections Firestore
**Data:** 03/10/2026 | **Status:** CRÍTICO — rules bloqueando a maioria das collections

---

## 🔴 CAUSA RAIZ
O arquivo `firestore.rules` possui uma regra catch-all no final:
```
match /{document=**} {
  allow read, write: if false;
}
```
Qualquer collection não listada explicitamente é **BLOQUEADA**. A maioria das collections usadas pelo app **não está listada nas rules**.

---

## Mapa: Rota → Componente → Collections Firestore

| Rota | Componente Principal | Collections Usadas | Status Rules |
|------|---------------------|--------------------|-------------|
| `/` (index) | `OperacaoHome` | `squads`, `systems`, `tickets_global`, `grupo_atendimento`, `escopo`, `operacao_stats` | ⚠️ tickets_global, grupo_atendimento, escopo, operacao_stats **BLOQUEADAS** |
| `/radar/:tabParam` | `OperacaoHome` | idem | ⚠️ idem |
| `/roadmap-geral` | `RoadmapGeral` | `roadmap_geral_views` | ✅ Permitida |
| `/demandas` | `KanbanBoard` | `tickets`, `squads`, `systems` | ⚠️ `systems` BLOQUEADA |
| `/atividades` | `KanbanBoard` | `tickets`, `squads`, `systems` | ⚠️ `systems` BLOQUEADA |
| `/roadmap` | `Roadmap` | `holidays` | ❌ `holidays` BLOQUEADA (typo: deveria ser `holydays`) |
| `/projetos` | `Projects` | `projects` | ✅ Permitida |
| `/projetos/:projectId` | `ProjectDetails` | `projects`, `tickets` | ✅ Permitidas |
| `/especificacoes` | `Specifications` | `specifications` | ❌ `specifications` BLOQUEADA |
| `/espec-tecnica` | `TechSpecs` | `tech_specifications` | ❌ `tech_specifications` BLOQUEADA |
| `/t-shirt` | `TShirts` | `t_shirts` | ❌ `t_shirts` BLOQUEADA |
| `/estimativas` | `Estimations` | `estimations`, `estimationRules`, `systems`, `tickets` | ❌ `estimations`, `estimationRules`, `systems` BLOQUEADAS |
| `/migracao` | `RunMigration` | `estimationRules` | ❌ BLOQUEADA |
| `/ajuda` | `HelpFlow` | — (sem Firestore direto) | ✅ OK |
| `/configuracoes` | `Settings` | `systems`, `components`, `workflows`, `ticketTypes`, `automations`, `customFields`, `squadroles`, `permissionProfiles`, `users` | ⚠️ Maioria BLOQUEADA |
| `/planejamento` | `PlanejamentoLayout` → `PlanejamentoCiclo` | `ciclos_planejamento`, `ciclo_views`, `squads`, `systems` | ❌ `ciclos_planejamento`, `ciclo_views`, `systems` BLOQUEADAS |
| `/team` | `Team` | `squads` | ✅ Permitida |
| `/organograma` | `Organograma` | `squads` | ✅ Permitida |
| `/minhas-atividades` | `MyActivities` | `tickets`, `users` | ✅ Permitidas |
| `/secops/permissions` | `PermissionsManager` | `users`, `permissionProfiles` | ❌ `permissionProfiles` BLOQUEADA |
| `(global)` | `DemandasLayout` → `auditService` | `system_access_logs` | ❌ BLOQUEADA — falha silenciosa em TODA navegação |
| `(global)` | `Topbar` / `notificationService` | `notifications` | ❌ BLOQUEADA |
| `(modal)` | `TicketDetailsModal` | `tickets`, `estimations` | ⚠️ `estimations` BLOQUEADA |
| `(modal)` | `EstimationEditorModal` | `estimations`, `tickets`, `workflows` | ❌ `estimations`, `workflows` BLOQUEADAS |
| `(modal)` | `UserDetailsModal` | `users`, `vacations` | ✅ Permitidas |
| `(modal)` | `TeamCapacityModal` | `municipios`, `allocations` | ⚠️ `allocations` BLOQUEADA |
| `(calendar)` | `CalendarBase` | `holydays`, `vacations` | ✅ Permitidas |

---

## Lista Completa de Collections por Status

### ✅ Permitidas nas Rules (funcionando)
| Collection | Rule |
|-----------|------|
| `squads` | read/write authenticated |
| `users` | read authenticated, write admin/owner |
| `squadRoles` | read/write authenticated (camelCase — legacy) |
| `squadrole` | read/write authenticated |
| `squadroles` | read/write authenticated |
| `tickets` + subcollections | read/write authenticated |
| `projects` | read/write authenticated |
| `permissions` | read authenticated, write admin |
| `jqlConfigs` | read/write authenticated |
| `operacao` | read/write authenticated |
| `municipios` | read/write authenticated |
| `holydays` | read/write authenticated |
| `vacations` | read/write authenticated |
| `roadmap_geral_views` | read/write owner only |

### ❌ BLOQUEADAS — Ausentes nas Rules
| Collection | Usado por | Impacto |
|-----------|-----------|---------|
| `allocations` | `CapacityPlanning.jsx`, `allocationService.js` | Planejamento de Capacidade quebrado |
| `automations` | `settingsService.js` | Aba "Automações" em Settings quebrada |
| `ciclo_views` | `cicloViewsService.js` | Planejamento de Ciclo (views salvas) quebrado |
| `ciclos_planejamento` | `cicloService.js` | Planejamento de Ciclo completamente quebrado |
| `components` | `settingsService.js` | Aba "Componentes (Tags)" em Settings quebrada |
| `customFields` | `settingsService.js` | Aba "Campos Custom" em Settings quebrada |
| `escopo` | `operacaoFirestoreService.js` | Radar Operação (escopos) quebrado |
| `estimationRules` | `EstimationRulesAdmin.jsx`, `Estimations.jsx` | Estimativas e regras quebradas |
| `estimations` | `Estimations.jsx`, `specService.js`, `ticketService.js` | Estimativas quebradas |
| `grupo_atendimento` | `operacaoFirestoreService.js`, `operacaoRadarService.js` | Radar Operação quebrado |
| `holidays` | `Roadmap.jsx` | Roadmap sem feriados (BUG: deveria ser `holydays`) |
| `jira_sync_audit` | `auditService.js` | Auditoria Jira silenciosa |
| `notifications` | `notificationService.js` | Notificações quebradas |
| `operacao_stats` | `operacaoFirestoreService.js`, `operacaoRadarService.js` | Stats do Radar quebradas |
| `permissionProfiles` | `permissionService.js`, `Settings.jsx` | Perfis de Permissão quebrados |
| `specifications` | `Specifications.jsx`, `specService.js` | Especificações quebradas |
| `system_access_logs` | `auditService.js` | Logs de acesso falham em TODA navegação |
| `systems` | `settingsService.js`, `KanbanBoard.jsx`, `Estimations.jsx`, `PlanejamentoCiclo.jsx` | Sistemas ausentes em Kanban, Estimativas e Ciclos |
| `t_shirts` | `TShirts.jsx`, `tshirtService.js`, `ticketService.js` | T-Shirts completamente quebrado |
| `tech_specifications` | `TechSpecs.jsx`, `techSpecService.js` | Espec. Técnicas quebradas |
| `ticketTypes` | `settingsService.js` | Tipos de Ticket em Settings quebrados |
| `tickets_global` | `operacaoFirestoreService.js`, `operacaoRadarService.js` | Radar Operação principal quebrado |
| `workflows` | `settingsService.js`, `EstimationEditorModal.jsx` | Workflows em Settings quebrados |

---

## 🛠️ Correção Aplicada
Arquivo `firestore.rules` atualizado com todas as collections faltantes.

### Subcollections de `tickets` (cobertas pelo wildcard `{document=**}`)
- `tickets/{id}/comments`
- `tickets/{id}/attachments`
- `tickets/{id}/history`
- `
