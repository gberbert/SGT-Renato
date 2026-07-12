
| Tipo | Categoria | Componente | Muito Baixa | Baixa | Média | Alta | Muito Alta |
| ---- | --------- | ---------- | ----------- | ----- | ----- | ---- | ---------- |
  
# Especificação de Requisitos Funcionais e Testes  
## Projeto: Customer Perception (Conta Fácil 2.0 & Automação de Mensageria)  
  
> [!NOTE]  
> Este documento consolida todos os Requisitos Funcionais, Fluxos UML, Cenários de Teste (em padrão Gherkin/BDD para uso no SpiraTeam) e Critérios de Aceite para o escopo fechado do Objetivo 2, considerando a evolução sobre o CMS Acquia (Drupal) e integrações via Databricks e Salesforce.  
  
---  
  
## 1. Requisitos Funcionais (RF)  
  
### Módulo 1: Frontend (Dashboard Conta Fácil 2.0 - CMS Acquia)  
* **RF01 - Visualização Interativa da Fatura:** O sistema deve apresentar um dashboard interativo contendo os dados macro da fatura (Valor, Vencimento, Status), substituindo a visualização estática atual.  
* **RF02 - Explicação Didática de Encargos (Tradução SAP):** Se a fatura contiver códigos de cobrança não recorrentes oriundos do SAP CCS (ex: multas, refaturamento), o sistema deve exibir blocos didáticos traduzindo a base legal e a memória de cálculo.  
* **RF03 - Histórico Gráfico Comparativo:** O sistema deve renderizar um gráfico comparativo destacando o consumo dos últimos 12 meses e evidenciando a variação anômala que gerou o refaturamento, se aplicável.  
* **RF04 - Gestão de Preferências (Opt-In/Out):** O sistema deve permitir que o usuário logado acesse seu perfil no portal e habilite/desabilite os canais de recebimento de notificações proativas (E-mail, SMS, Push, WhatsApp).  
  
### Módulo 2 & 3: Integração de Dados, Mensageria e Fallback  
* **RF05 - Consumo de Dados via API Freeze (Databricks):** O backend do Drupal deve consultar as tabelas Gold do Databricks para recuperar as composições detalhadas de faturamento de forma síncrona.  
* **RF06 - Auditoria Básica:** O sistema deve registrar logs de acesso (visualização detalhada da fatura) para fins de auditoria interna.  
* **RF07 - Disparo de Mensageria Proativa:** O sistema deve identificar eventos de faturamento anômalo (via Databricks) e acionar a API do Salesforce Marketing Cloud / Genesys Cloud para disparo proativo ao cliente nos canais habilitados.  
* **RF08 - Mecanismo de Fallback:** Caso a API do Salesforce/Genesys não responda (timeout de 2 segundos) ou ocorra erro, o backend (via fila cron do Drupal) deverá realizar o disparo de fallback via e-mail e SMS utilizando a infraestrutura genérica de contingência.  
  
---  
  
## 2. Diagramas UML (Arquitetura e Comportamento)  
  
### 2.1. Diagrama de Casos de Uso  
  
```mermaid  
usecaseDiagram  
    actor Cliente  
    actor SistemaDatabricks as "Databricks (Dados)"  
    actor SistemaSFMC as "Salesforce (Mensageria)"  
  
    package "Agência Virtual (Acquia / Drupal)" {  
        usecase "Visualizar Fatura (Dashboard)" as UC1  
        usecase "Ler Explicação de Refaturamento" as UC2  
        usecase "Analisar Gráfico Histórico" as UC3  
        usecase "Configurar Opt-in de Mensageria" as UC4  
          
        UC1 ..> UC2 : <<extend>> (se houver encargo extra)  
        UC1 ..> UC3 : <<include>>  
    }  
  
    package "Motor de Mensageria (Backend PHP)" {  
        usecase "Consultar Dados de Faturamento" as UC5  
        usecase "Disparar Aviso Proativo" as UC6  
        usecase "Executar Disparo de Fallback" as UC7  
          
        UC6 ..> UC7 : <<extend>> (se timeout Salesforce)  
    }  
  
    Cliente --> UC1  
    Cliente --> UC4  
    UC5 --> SistemaDatabricks  
    UC6 --> SistemaSFMC  
    UC1 --> UC5  
```  
  
### 2.2. Diagrama de Sequência: Consulta do Conta Fácil 2.0  
  
```mermaid  
sequenceDiagram  
    autonumber  
    actor C as Cliente  
    participant FE as Frontend Drupal (UI)  
    participant BE as Backend Drupal (PHP/API)  
    participant DB as Databricks (Tabelas Gold)  
      
    C->>FE: Acessa aba "Conta Fácil 2.0"  
    FE->>BE: GET /faturas/{id}/detalhe-explicado  
    activate BE  
    BE->>DB: Requisita composição detalhada da UC  
    activate DB  
    DB-->>BE: Retorna JSON (Códigos SAP, Consumo, Histórico)  
    deactivate DB  
      
    alt Códigos Não Recorrentes Encontrados?  
        BE->>BE: "Traduz" códigos SAP para textos didáticos CMS  
    end  
      
    BE->>BE: Registra Log de Auditoria  
    BE-->>FE: Retorna Dados Formatados  
    deactivate BE  
    FE->>C: Renderiza Dashboard (Gráficos + Texto Didático)  
```  
  
### 2.3. Diagrama de Sequência: Mensageria Proativa com Fallback  
  
```mermaid  
sequenceDiagram  
    autonumber  
    participant Evento as Event Listener (Cron/Queue)  
    participant Backend as Serviço Mensageria Drupal  
    participant Perfil as BD Drupal (Preferências)  
    participant SFMC as Salesforce / Genesys  
    participant Fallback as Motor Contingência (SMTP/SMS)  
      
    Evento->>Backend: Detecta nova fatura com Refaturamento  
    activate Backend  
    Backend->>Perfil: Consulta opt-in do Usuário X  
    Perfil-->>Backend: Retorna (WhatsApp=ON, SMS=OFF)  
      
    Backend->>SFMC: POST /send (Canal: WhatsApp)  
    activate SFMC  
      
    alt Timeout ou Erro 500  
        SFMC-->>Backend: Retorna Timeout (2000ms)  
        deactivate SFMC  
        Backend->>Backend: Enfileira na Tabela de Contingência  
        Backend->>Fallback: Dispara SMS/Email Genérico  
        Fallback-->>Backend: Status: Enviado  
    else Sucesso  
        SFMC-->>Backend: Status: 200 OK (Enviado)  
    end  
      
    Backend->>Backend: Grava Log Final do Disparo  
    deactivate Backend  
```  
  
---  
  
## 3. Cenários de Teste (BDD / Gherkin)  
  
Visando aderência aos padrões de Qualidade da CPFL, todos os testes deverão ser mapeados na ferramenta **SpiraTeam** utilizando sintaxe Gherkin.  
  
### Cenário 01: Exibição de Fatura Simples (Sem Encargos Extras)  
```gherkin  
Funcionalidade: Conta Fácil 2.0 - Visualização de Fatura  
  
Cenario: Cliente consulta uma fatura comum, sem refaturamentos  
  Dado que o cliente está autenticado na Agência Virtual  
  E acessa a seção "Conta Fácil 2.0"  
  Quando o backend consome os dados do Databricks  
  E não identifica códigos regulatórios não-recorrentes (Multas/Refaturamento)  
  Então o sistema deve ocultar o "Bloco Didático"  
  E renderizar apenas o valor total, vencimento e gráfico de histórico base  
```  
  
### Cenário 02: Exibição de Fatura com Refaturamento  
```gherkin  
Cenario: Cliente consulta uma fatura impactada por refaturamento  
  Dado que o cliente possui uma fatura com código SAP de Refaturamento (ex: Cód 89)  
  Quando acessar a fatura detalhada no "Conta Fácil 2.0"  
  Então o sistema deve consultar o "De/Para" no CMS  
  E apresentar o card "Entenda sua Fatura" com a base legal da ANEEL explicada de forma didática  
  E o gráfico deve destacar em cor secundária (ex: laranja) o volume que originou o refaturamento  
```  
  
### Cenário 03: Tratamento de Fallback na Mensageria  
```gherkin  
Funcionalidade: Comunicação Proativa e Resiliência  
  
Cenario: Timeout na comunicação com o Salesforce e acionamento do Fallback  
  Dado que o evento de Refaturamento disparou o gatilho de notificação  
  E as preferências de contato do cliente indicam "WhatsApp" habilitado  
  Quando o Drupal realizar o POST para o Salesforce Marketing Cloud  
  E o serviço externo exceder o limite de resposta de 2 segundos (Timeout)  
  Então o sistema deve interceptar a falha automaticamente  
  E enfileirar a notificação para o serviço de Fallback  
  E disparar um E-mail e SMS padrão de contingência  
  E registrar no log de auditoria que o Fallback foi acionado  
```  
  
---  
  
## 4. Critérios de Aceite (Termos de Aceite)  
  
Para considerar o projeto tecnicamente homologado e pronto para *Go-Live*, os seguintes termos deverão ser atendidos e assinados conjuntamente entre CPFL e NTT DATA:  
  
1. **Testes e Homologação (UAT):**  
   - 100% dos cenários BDD cadastrados e aprovados no SpiraTeam, sem defeitos (Bugs) de severidade Alta ou Crítica (Showstoppers).  
   - Aprovação nos Testes de Carga e Stress: A aplicação Drupal deve suportar a baseline de RPS (Requisições por Segundo) acordada na fase de *Blueprint* sem degradação de performance superior a 2 segundos na renderização do dashboard.  
2. **Integração Backend (API Freeze):**  
   - As consultas realizadas via `Guzzle` contra a API do Databricks devem validar a correta tradução dos JSONs de entrada para as visualizações Twig. Nenhuma conversão de dados sujos deve ser feita pelo Drupal (o dado de entrada deve ser tratado como "Single Source of Truth").  
3. **Mecanismo de Fallback Validado:**  
   - Evidência (via simulação de falha controlada - *Chaos Engineering*) de que 100% dos timeouts gerados na chamada ao Salesforce/Genesys resultam no envio bem-sucedido das mensagens pela fila de contingência interna.  
4. **Segurança e Opt-in:**  
   - Evidência formal de que nenhuma mensagem foi disparada proativamente para clientes que marcaram as opções de *Opt-Out* (Termos LGPD no perfil do usuário).  
5. **Aprovação de Layout e Interface:**  
   - As interfaces finais devem seguir o guia de estilos (*Design System*) da marca CPFL, sem discrepâncias com a maquete 2D aprovada, garantindo total responsividade nos formatos Mobile e Desktop.  
