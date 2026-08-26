"use strict";

const fs = require("fs");
const path = require("path");

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
};

const ESCOPO_SEED = [
  { id: "problemas", nome: "PROBLEMAS", ordem: 1 },
  { id: "demanda-fast", nome: "DEMANDA FAST", ordem: 2 },
  { id: "demanda", nome: "DEMANDA", ordem: 3 },
  { id: "incidente", nome: "INCIDENTE", ordem: 4 },
  { id: "solicitacao", nome: "SOLICITACAO", ordem: 5 },
  { id: "catalogo", nome: "CATALOGO", ordem: 6 },
];

function escopoNomeToId(nome) {
  const map = {
    PROBLEMAS: "problemas",
    "DEMANDA FAST": "demanda-fast",
    DEMANDA: "demanda",
    INCIDENTE: "incidente",
    SOLICITACAO: "solicitacao",
    CATALOGO: "catalogo",
  };
  return map[nome] || nome.toLowerCase().replace(/\s+/g, "-");
}

function getJqlCargaFilePath() {
  return path.join(__dirname, "data", "jqls_carga.txt");
}

function normalizeEscopo(consultaName) {
  const name = consultaName.trim().replace(/\s+/g, " ").toUpperCase();
  if (name.includes("PROBLEMA")) return "PROBLEMAS";
  if (/DEMANDAS?\s+FAST/.test(name)) return "DEMANDA FAST";
  if (/CAT.*LOGO/.test(name)) return "CATALOGO";
  if (name.includes("INCIDENTE")) return "INCIDENTE";
  if (name.includes("SOLICITA")) return "SOLICITACAO";
  if (name.includes("DEMANDA")) return "DEMANDA";
  return consultaName.trim().toUpperCase();
}

function formatJqlLines(lines) {
  const text = lines
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ");
  return text.replace(/\s+/g, " ").trim();
}

function wrapJqlClause(expr) {
  const trimmed = expr.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
    let depth = 0;
    let wrapsWhole = true;
    for (let i = 0; i < trimmed.length; i += 1) {
      if (trimmed[i] === "(") depth += 1;
      if (trimmed[i] === ")") depth -= 1;
      if (depth === 0 && i < trimmed.length - 1) {
        wrapsWhole = false;
        break;
      }
    }
    if (wrapsWhole && depth === 0) return trimmed;
  }
  return `(${trimmed})`;
}

function fixProblemasJql(jql) {
  const match = jql.match(/\sOR\s*\(/i);
  if (!match) return jql;
  const left = jql.slice(0, match.index).trim();
  const right = jql.slice(match.index).replace(/^\s*OR\s*/i, "").trim();
  return `${wrapJqlClause(left)} OR ${wrapJqlClause(right)}`;
}

function fixDemandasJql(jql) {
  if (jql.startsWith("((")) return jql;
  const match = jql.match(/\)\s*OR\s*\(/i);
  if (match) {
    let left = jql.slice(0, match.index + 1).trim();
    let right = jql.slice(match.index + 1).replace(/^\s*OR\s*/i, "").trim();
    if (left.startsWith("(")) left = left.slice(1).trim();
    if (right.startsWith("(") && right.endsWith(")")) right = right.slice(1, -1).trim();
    return `((${left}) OR (${right}))`;
  }
  if (!jql.startsWith("(")) return `(${jql})`;
  return jql;
}

function readJqlCargaFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo de JQL não encontrado: ${filePath}`);
  }
  const batches = [];
  let currentName = null;
  let currentLines = [];

  const flush = () => {
    if (!currentName) return;
    let jql = formatJqlLines(currentLines);
    if (!jql) return;
    const escopo = normalizeEscopo(currentName);
    if (escopo === "PROBLEMAS") {
      jql = fixProblemasJql(jql);
    } else if (escopo === "DEMANDA") {
      jql = fixDemandasJql(jql);
    }
    batches.push({
      label: escopo,
      escopo,
      escopoId: escopoNomeToId(escopo),
      field: "escopo",
      jql,
    });
    currentName = null;
    currentLines = [];
  };

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*CONSULTA\s+\d+\s+(.+)\s*$/i);
    if (match) {
      flush();
      currentName = match[1].trim();
      currentLines = [];
      continue;
    }
    if (currentName !== null) currentLines.push(line);
  }
  flush();

  if (!batches.length) {
    throw new Error(`Nenhuma consulta encontrada em ${filePath}`);
  }
  return batches;
}

function loadJqlBatches() {
  return readJqlCargaFile(getJqlCargaFilePath());
}

module.exports = {
  ESCOPOS_VALIDOS,
  TICKET_FIELD_DEFINITIONS,
  ESCOPO_SEED,
  escopoNomeToId,
  getJqlCargaFilePath,
  loadJqlBatches,
};
