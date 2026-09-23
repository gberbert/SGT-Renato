/**
 * Remove numeric prefix from Jira select field values.
 * e.g. "4-Baixa" → "Baixa", "1 - Alta" → "Alta"
 */
export function stripNumericPrefix(str) {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/^\d+\s*-\s*/, '').trim() || str.trim();
}
