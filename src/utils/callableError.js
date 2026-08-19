export function formatCallableError(err) {
  const code = err?.code || '';
  const message = err?.message || '';
  const details = err?.details;

  if (code === 'functions/unauthenticated') {
    return 'Faça login novamente para continuar.';
  }
  if (code === 'functions/permission-denied') {
    return message || 'Sem permissão para esta ação.';
  }
  if (code === 'functions/invalid-argument') {
    return message || 'Parâmetros inválidos na chamada ao servidor.';
  }
  if (code === 'functions/failed-precondition') {
    return message || 'Pré-requisito não atendido (credenciais Jira ou configuração).';
  }
  if (code === 'functions/not-found') {
    return (
      'Function searchJiraTickets não encontrada ou desatualizada. ' +
      'Execute: firebase deploy --only functions --project sgt-renato'
    );
  }
  if (code === 'functions/internal' || message === 'internal') {
    return (
      'Erro interno em searchJiraTickets. Confira os logs no Firebase Console ' +
      '(Functions → searchJiraTickets → Logs) e rode: firebase deploy --only functions'
    );
  }
  if (details) return String(details);
  if (message && message !== 'internal') return message;
  return code || 'Erro desconhecido ao chamar o servidor.';
}
