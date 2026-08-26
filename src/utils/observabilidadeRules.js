/**
 * Regras de monitoramento de "Problemas" para a aba Observabilidade do Radar Operação.
 *
 * Cada indicador possui:
 *  - key: identificador único
 *  - label: título exibido no card
 *  - rule: descrição textual da regra (exibida no tooltip do ícone de informação)
 *  - compute(tickets): recebe a lista de tickets já filtrada por escopo/período e retorna
 *    a lista de tickets que atendem à condição (o card exibe o total = length).
 */

function isToday(dateStr) {
  return false; // placeholder — não usado diretamente aqui
}

function toDateOnly(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isOnOrBeforeToday(value) {
  const d = toDateOnly(value);
  if (!d) return false;
  const today = toDateOnly(new Date());
  return d.getTime() <= today.getTime();
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function statusIs(ticket, expected) {
  return normalizeText(ticket.status) === normalizeText(expected);
}

function issueTypeIs(ticket, expected) {
  return normalizeText(ticket.issueType) === normalizeText(expected);
}

function isEscopoProblemas(ticket) {
  return normalizeText(ticket.escopo).startsWith('problema');
}

/**
 * Verifica se o ticket possui, entre seus vínculos (issueLinksDetailed), algum ticket
 * do issueType "Mudança" cujo status seja o esperado.
 */
function hasLinkedMudancaWithStatus(ticket, expectedStatus) {
  const links = Array.isArray(ticket.issueLinksDetailed) ? ticket.issueLinksDetailed : [];
  return links.some(
    (link) => normalizeText(link.issueType) === 'mudanca' && normalizeText(link.status) === normalizeText(expectedStatus)
  );
}

/**
 * Verifica se o ticket possui algum vínculo cuja chave comece com "DEMANDA" ou "SERVICE"
 * (aproximação de "chave DEMANDA ou chave SERVICE"). O campo "demanda fast" só é avaliável
 * no próprio ticket vinculado se ele estiver na base local (tickets_global) — como
 * issueLinksDetailed não traz esse campo customizado, consideramos vínculo por chave.
 */
function hasLinkedDemandaOrService(ticket) {
  const links = Array.isArray(ticket.issueLinksDetailed) ? ticket.issueLinksDetailed : [];
  return links.some((link) => {
    const key = String(link.key || '').toUpperCase();
    return key.startsWith('DEMANDA') || key.startsWith('SERVICE');
  });
}

export const OBSERVABILIDADE_RULES = [
  {
    key: 'planejamento_a_revisar',
    label: 'Planejamento a revisar',
    rule:
      'Total de tickets de escopo PROBLEMA, issue_type PLANEJAMENTO, no status "Em Planejamento", com o campo Estimativa de Horas maior que 0 e Data Fim Planejada menor ou igual à data atual.',
    compute(tickets) {
      return tickets.filter(
        (t) =>
          isEscopoProblemas(t) &&
          issueTypeIs(t, 'Planejamento') &&
          statusIs(t, 'Em Planejamento') &&
          Number(t.estimativaHoras) > 0 &&
          isOnOrBeforeToday(t.dataFimPlanejado)
      );
    },
  },
  {
    key: 'planejamento_a_aprovar_revisar',
    label: 'Planejamento a aprovar / revisar',
    rule:
      'Total de tickets de escopo PROBLEMA, issue_type PLANEJAMENTO, no status "Aguardando Aprovação Técnica", com Data Fim Planejada menor ou igual à data atual.',
    compute(tickets) {
      return tickets.filter(
        (t) =>
          isEscopoProblemas(t) &&
          issueTypeIs(t, 'Planejamento') &&
          statusIs(t, 'Aguardando Aprovação Técnica') &&
          isOnOrBeforeToday(t.dataFimPlanejado)
      );
    },
  },
  {
    key: 'execucao_aguardando_cliente',
    label: 'Execução aguardando cliente',
    rule:
      'Total de tickets de escopo PROBLEMA, issue_type EXECUÇÃO, no status "Aguardando Aprovação", que possuem um ticket de issue_type Mudança vinculado no status "Fechada - Responsável CPFL".',
    compute(tickets) {
      return tickets.filter(
        (t) =>
          isEscopoProblemas(t) &&
          issueTypeIs(t, 'Execução') &&
          statusIs(t, 'Aguardando Aprovação') &&
          hasLinkedMudancaWithStatus(t, 'Fechada - Responsável CPFL')
      );
    },
  },
  {
    key: 'execucao_aguardando_mudanca_ntt',
    label: 'Execução aguardando mudança (NTT)',
    rule:
      'Total de tickets de escopo PROBLEMA, issue_type EXECUÇÃO, no status "Aguardando Mudança", que possuem um ticket de issue_type Mudança vinculado - Responsável NTT.',
    compute(tickets) {
      return tickets.filter(
        (t) =>
          isEscopoProblemas(t) &&
          issueTypeIs(t, 'Execução') &&
          statusIs(t, 'Aguardando Mudança') &&
          hasLinkedMudancaWithStatus(t, 'Responsável NTT')
      );
    },
  },
  {
    key: 'falta_vinculo_demanda',
    label: 'Falta vínculo de demanda',
    rule:
      'Total de tickets de escopo PROBLEMA, issue_type PROBLEMA, no status "Aguardando Demanda", sem ticket vinculado de chave DEMANDA ou chave SERVICE (com o campo "Demanda Fast" = Sim).',
    compute(tickets) {
      return tickets.filter(
        (t) =>
          isEscopoProblemas(t) &&
          issueTypeIs(t, 'Problema') &&
          statusIs(t, 'Aguardando Demanda') &&
          !hasLinkedDemandaOrService(t)
      );
    },
  },
];

export function computeObservabilidadeIndicators(tickets) {
  return OBSERVABILIDADE_RULES.map((rule) => {
    const matched = rule.compute(tickets);
    return {
      key: rule.key,
      label: rule.label,
      rule: rule.rule,
      total: matched.length,
      tickets: matched,
    };
  });
}
