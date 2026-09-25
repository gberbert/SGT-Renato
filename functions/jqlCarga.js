"use strict";

const ESCOPOS_VALIDOS = [
  "PROBLEMAS",
  "DEMANDA FAST",
  "DEMANDA",
  "CATALOGO",
  "INCIDENTE",
  "SOLICITACAO",
];

const TICKET_FIELD_DEFINITIONS = {
  empresa: ["Empresa"],
  fornecedor: ["Fornecedor"],
  grupo_suporte: ["Grupo de Suporte", "grupo de suporte"],
  grupo_solucionador: ["Grupo Solucionador", "grupo solucionador"],
  fornecedor_ti: ["Fornecedor TI", "fornecedor ti"],
  demanda_fast: ["Demanda Fast", "demanda fast", "Demanda Fast[Dropdown]"],
  torre_atuacao: [
    "Torre de Atuação da Demanda",
    "torre de atuação da demanda",
    "Torre de Atuação",
  ],
  fornecedores_dropdown: ["Fornecedores", "fornecedores"],
  quantidade_reaberturas: [
    "Quantidade de Reaberturas",
    "quantidade de reaberturas",
    "Quantidade de Reaberturas[Number]",
  ],
  data_aprovacao_efsr: ["Data de Aprovação EF/SR", "data de aprovação ef/sr"],
  data_inicio_atendimento_planejada: [
    "Data Início do Atendimento Planejada",
    "data início do atendimento planejada",
  ],
  data_inicio_atendimento: ["Data Início do Atendimento", "data início do atendimento"],
  data_aprovacao_qa_planejada: [
    "Data Aprovação QA Planejada",
    "data aprovação qa planejada",
  ],
  data_inicio_homologacao_planejada: [
    "Data Início Homologação Planejada",
    "data início homologação planejada",
  ],
  data_inicio_homologacao_efetiva: [
    "Data Início Homologação Efetiva",
    "data início homologação efetiva",
  ],
  data_fim_homologacao_planejada: [
    "Data Fim Homologação Planejada",
    "data fim homologação planejada",
  ],
  data_fim_homologacao_efetiva: [
    "Data Fim Homologação Efetiva",
    "data fim homologação efetiva",
  ],
  data_entrega_producao_prevista: [
    "Data Entrega em Produção Prevista",
    "data entrega em produção prevista",
  ],
  estimativa_horas: ["Estimativa de horas", "estimativa de horas"],
  data_fim_planejado: ["Data Fim Planejado", "data fim planejado"],
  natureza_iniciativa: [
    "Natureza da Iniciativa",
    "natureza da iniciativa",
    "Natureza de Iniciativa",
    "natureza de iniciativa",
  ],
};

const ESCOPO_SEED = [
  { id: "problemas",    nome: "PROBLEMAS",    ordem: 1 },
  { id: "demanda-fast", nome: "DEMANDA FAST", ordem: 2 },
  { id: "demanda",      nome: "DEMANDA",      ordem: 3 },
  { id: "incidente",    nome: "INCIDENTE",    ordem: 4 },
  { id: "solicitacao",  nome: "SOLICITACAO",  ordem: 5 },
  { id: "catalogo",     nome: "CATALOGO",     ordem: 6 },
];

function escopoNomeToId(nome) {
  const map = {
    "PROBLEMAS":    "problemas",
    "DEMANDA FAST": "demanda-fast",
    "DEMANDA":      "demanda",
    "INCIDENTE":    "incidente",
    "SOLICITACAO":  "solicitacao",
    "CATALOGO":     "catalogo",
  };
  return map[nome] || nome.toLowerCase().replace(/\s+/g, "-");
}

/**
 * JQLs padrão de cada escopo — fonte de verdade quando a collection
 * jql_configs ainda não foi populada no Firestore.
 * Estes valores são usados no auto-seed e no script seed_jql_configs.mjs.
 * Nunca são lidos diretamente durante a carga; após o seed inicial o Firestore
 * é a única fonte utilizada.
 */
const JQLS_DEFAULT = [
  {
    escopoId: "problemas",
    escopo:   "PROBLEMAS",
    label:    "PROBLEMAS",
    jql: "((project = TI AND type = Problem AND \"fornecedores[dropdown]\" = \"NTT Data\") OR (type = Problem AND project = PROB AND cf[10382] = \"ari:cloud:cmdb::object/4fc8c668-3c28-445a-921f-4cd66d1f865e/432192\") OR (type != Problem AND project = PROB AND cf[10382] = \"ari:cloud:cmdb::object/4fc8c668-3c28-445a-921f-4cd66d1f865e/432192\"))",
  },
  {
    escopoId: "demanda-fast",
    escopo:   "DEMANDA FAST",
    label:    "DEMANDA FAST",
    jql: "project = SERVICE AND \"grupo solucionador[group picker (single group)]\" IN (TI_GED_Perfil, TI_Perfil_Ariba, TI_Perfil_CanaisAtendimento, TI_Perfil_CRM, TI_PERFIL_CWS, TI_PERFIL_CWSi_LEC, TI_PERFIL_CWSi_OP, TI_Perfil_Espaider, TI_Perfil_GISD, TI_PERFIL_IB, TI_Perfil_MasterSaf, TI_Perfil_Previsao_Atendimento, TI_PERFIL_RDCT, \"TI_PERFIL_PROJETOS PARTICULARES\", TI_Perfil_SEFIC, TI_Perfil_SPAP, TI_PERFIL_SPIR, TI_PERFIL_WEB_LOGRADOUROS, TI_SGDO_PERFIL, TI_PERFIL_SGDO, TI_Perfil_UtilityIQ, TI_Perfil_SGCE, TI_RPA, TI_Solucionador_Mastersaf, TI_BI_ST_Operação, TI_BI_Tableau, TI_BI_EVI, TI_BI_Alteryx, TI_BI_ST_BDGD_SUSTAIN, TI_NEXO, TI_Renováveis_BPMS, Ti_Perfil_WBC, TI_Perfil_RGESUL_SGC, TI_Perfil_Logos_Oracle_PPBG, TI_Solucionador_CRM, TI_Renováveis_SGE, TI_Perfil_Meetime, TI_Perfil_OSGT, TI_SALESFORCE, TI_SANF, TI_SEFIC, TI_SGA, TI_Sharepoint, TI_Siase, TI_SIGA, TI_Solucionador_DCAF, TI_Solucionador_EPM, \"TI_Solucionador_Logos Web\", TI_Solucionador_Projetos_Particulares, TI_SPAP, TI_WEB_Agência_Virtual, TI_WEB_ApontamentoHoras, TI_WEB_Comercial, TI_WEB_ControleGarantias, TI_WEB_Energia, TI_WEB_Clientes_VIP, TI_WEB_CPFLEmpresas, TI_WEB_Corporativo, TI_WEB_GDO, TI_WEB_GISMA, TI_WEB_GMP, \"TI_WEB_Inspeções Rapidas\", TI_WEB_Logos, TI_WebLogradouros, TI_WEB_PID, TI_WEB_RDCT, TI_WEB_SEFIC, TI_WEB_SGA, TI_WEB_SIGA, TI_WEB_SPAP, TI_WEB_WebLogradouros, TI_WEB_VBA_Gestão_de_Energia, TI_WEB_SIGEn, TI_WEB_SANF, TI_WEB_RHAP, TI_WEB_Resoluções, TI_WEB_PortalOperações, TI_WEB_PRVG, TI_WEB_NSGCSR, TI_CWS, TI_GED_FOR, TI_Renováveis_ARQUIVEI, TI_Renováveis_AZIX, TI_Renováveis_INTRANET, TI_Renováveis_PPM, TI_Renováveis_SIS, TI_Renováveis_SOGI, TI_Agência_Virtual, TI_WEB_Lumens, TI_SICLOPE, \"TI - WEB - Novo GED_Suporte\", \"TI - WEB - Novo GED_Suporte_N2\", \"TI _Cadeia_Reversa_Mobilidade\", TI_CDRE_N1, TI_PERFIL_SALESFORCE) AND \"demanda fast[dropdown]\" = Sim",
  },
  {
    escopoId: "demanda",
    escopo:   "DEMANDA",
    label:    "DEMANDA",
    jql: "((issuetype = História AND project = SUST AND \"torre de atuação da demanda[dropdown]\" IN (\"ADM & LEGADOS\", BI, \"SISTEMAS WEB\", \"CANAIS DIGITAIS\") AND \"empresa[dropdown]\" = \"NTT DATA\" AND status NOT IN (Cancelada, Concluída)) OR (project IN (DEMANDA, SUST) AND \"torre de atuação da demanda[dropdown]\" IN (\"CANAIS DIGITAIS\", \"SISTEMAS CORPORATIVOS\") AND \"empresa[dropdown]\" IN (\"GLOBAL NTT\", \"NTT DATA\", \"NTT Ltda\", empty) AND status NOT IN (Cancelada, Concluída, Fechado, \"Não Aplicável\") AND type = Solicitação))",
  },
  {
    escopoId: "incidente",
    escopo:   "INCIDENTE",
    label:    "INCIDENTE",
    jql: "Project = SERVICE AND \"grupo solucionador[group picker (single group)]\" IN (TI_SALESFORCE, TI_SANF, TI_SEFIC, TI_SGA, TI_Sharepoint, TI_Siase, TI_SIGA, TI_Solucionador_DCAF, TI_Solucionador_EPM, \"TI_Solucionador_Logos Web\", TI_Solucionador_Projetos_Particulares, TI_SPAP, TI_WEB_Agência_Virtual, TI_WEB_ApontamentoHoras, TI_WEB_Comercial, TI_WEB_ControleGarantias, TI_WEB_Energia, TI_WEB_Clientes_VIP, TI_WEB_CPFLEmpresas, TI_WEB_Corporativo, TI_WEB_GDO, TI_WEB_GISMA, TI_WEB_GMP, \"TI_WEB_Inspeções Rapidas\", TI_WEB_Logos, TI_WebLogradouros, TI_WEB_PID, TI_WEB_RDCT, TI_WEB_SEFIC, TI_WEB_SGA, TI_WEB_SIGA, TI_WEB_SPAP, TI_WEB_WebLogradouros, TI_WEB_VBA_Gestão_de_Energia, TI_WEB_SIGEn, TI_WEB_SANF, TI_WEB_RHAP, TI_WEB_Resoluções, TI_WEB_PortalOperações, TI_WEB_PRVG, TI_WEB_NSGCSR, TI_CWS, TI_GED_FOR, TI_Renováveis_ARQUIVEI, TI_Renováveis_AZIX, TI_Renováveis_INTRANET, TI_Renováveis_PPM, TI_Renováveis_SIS, TI_Renováveis_SOGI, TI_Agência_Virtual, TI_WEB_Lumens, TI_SICLOPE, \"TI - WEB - Novo GED_Suporte\", \"TI - WEB - Novo GED_Suporte_N2\", \"TI _Cadeia_Reversa_Mobilidade\", \"TI_Hydro 4.0 - Aplicação\", TI_WEB_Operação) AND \"Demanda Fast[Dropdown]\" IN (empty, choiceOption(\"\"), Não) AND Type in (\"[System] Incidente\")",
  },
  {
    escopoId: "solicitacao",
    escopo:   "SOLICITACAO",
    label:    "SOLICITACAO",
    jql: [
      "project = SERVICE",
      "AND \"grupo solucionador[group picker (single group)]\" IN (",
      "TI_SANF, TI_SEFIC, TI_SGA, TI_Sharepoint, TI_Siase, TI_SIGA,",
      "TI_Solucionador_DCAF, TI_Solucionador_EPM, \"TI_Solucionador_Logos Web\",",
      "TI_Solucionador_Projetos_Particulares, TI_SPAP,",
      "TI_WEB_Agência_Virtual, TI_WEB_ApontamentoHoras, TI_WEB_Comercial,",
      "TI_WEB_ControleGarantias, TI_WEB_Energia, TI_WEB_Clientes_VIP,",
      "TI_WEB_CPFLEmpresas, TI_WEB_Corporativo, TI_WEB_GDO, TI_WEB_GISMA, TI_WEB_GMP,",
      "TI_WEB_Logos, TI_WebLogradouros, TI_WEB_PID, TI_WEB_RDCT,",
      "TI_WEB_SEFIC, TI_WEB_SGA, TI_WEB_SIGA, TI_WEB_SPAP, TI_WEB_WebLogradouros,",
      "TI_WEB_VBA_Gestão_de_Energia, TI_WEB_SIGEn, TI_WEB_SANF, TI_WEB_RHAP,",
      "TI_WEB_Resoluções, TI_WEB_PortalOperações, TI_WEB_PRVG, TI_WEB_NSGCSR,",
      "TI_CWS, TI_GED_FOR,",
      "TI_Renováveis_ARQUIVEI, TI_Renováveis_AZIX, TI_Renováveis_INTRANET,",
      "TI_Renováveis_PPM, TI_Renováveis_SIS, TI_Renováveis_SOGI,",
      "TI_Agência_Virtual, TI_CPFLEmpresas, \"TI_Inspeções Rapidas\",",
      "TI_Logos, TI_WEB_Lumens, TI_WEB_Operação, TI_Solucionador_SGCE,",
      "TI_WEB_EVI, TI_Renováveis_VBA_APROVADOR_WORKFLOW,",
      "\"TI - WEB - Novo GED_Suporte\", \"TI - WEB - Novo GED_Suporte_N2\",",
      "\"TI _Cadeia_Reversa_Mobilidade\", TI_Suporte_TOTEM_Sistema,",
      "TI_PERFIL_SALESFORCE, TI_SALESFORCE, TI_CDRE_N1)",
      "AND \"Demanda Fast[Dropdown]\" IN (empty, choiceOption(\"\"), Não)",
      "AND type in (\"[System] Service request\")",
    ].join(" "),
  },
  {
    escopoId: "catalogo",
    escopo:   "CATALOGO",
    label:    "CATALOGO",
    jql: "\"fornecedores[dropdown]\" IN (\"NTT DATA\", \"NTT DATA AMS\") AND project = AHF",
  },
];

module.exports = {
  ESCOPOS_VALIDOS,
  TICKET_FIELD_DEFINITIONS,
  ESCOPO_SEED,
  JQLS_DEFAULT,
  escopoNomeToId,
};
