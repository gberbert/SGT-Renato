import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const getOperacaoPreviewWithTicketsFn = httpsCallable(
  functions,
  'getOperacaoPreviewWithTickets'
);

/**
 * Obtém prévia de tickets com amostras reais de cada escopo/batch
 * Retorna:
 * {
 *   total: número,
 *   totalRaw: número,
 *   approximate: true,
 *   batches: [
 *     {
 *       label: string,
 *       escopo: string,
 *       escopoId: string,
 *       jql: string,
 *       total: número,
 *       approximate: true,
 *       samples: [{ key, summary, status, issueType }, ...],
 *       error?: string
 *     }
 *   ],
 *   changelogSample: { sampleSize, statusChangesFound, avgPerTicket },
 *   mitigation: {...}
 * }
 */
export async function getOperacaoPreviewWithTickets() {
  const result = await getOperacaoPreviewWithTicketsFn({});
  return result.data;
}
