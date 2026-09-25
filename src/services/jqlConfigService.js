import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

/**
 * Service para gerenciar configurações de JQL no Firebase
 * Comunica com Cloud Functions HTTP
 */

const API_BASE = 'https://us-central1-sgt-renato.cloudfunctions.net';

/**
 * Obter token de autenticação do usuário atual
 */
async function getAuthToken() {
  const auth = (await import('../firebase')).auth;
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Usuário não autenticado');
  }
  return await user.getIdToken();
}

/**
 * Listar todas as configurações de JQL
 * @returns {Promise<Array>} Lista de configurações JQL
 */
export async function listJqlConfigs() {
  try {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE}/listJqlConfigsHttp`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.configs || [];
  } catch (error) {
    console.error('Erro ao listar JQL configs:', error);
    throw error;
  }
}

/**
 * Salvar ou atualizar uma configuração de JQL
 * @param {Object} config - Configuração { escopoId, jql, description? }
 * @returns {Promise<Object>}
 */
export async function saveJqlConfig(config) {
  try {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE}/saveJqlConfigHttp`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao salvar JQL config:', error);
    throw error;
  }
}

/**
 * Deletar uma configuração de JQL
 * @param {string} escopoId - ID do escopo
 * @returns {Promise<Object>}
 */
export async function deleteJqlConfig(escopoId) {
  try {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE}/deleteJqlConfigHttp`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ escopoId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao deletar JQL config:', error);
    throw error;
  }
}

/**
 * Testar preview de uma JQL antes de salvar
 * @param {string} jql - JQL query a testar
 * @returns {Promise<Object>} Preview dos dados
 */
export async function previewJql(jql) {
  try {
    // Usar a Cloud Function existente com o JQL customizado
    const previewJiraGlobalCarga = httpsCallable(functions, 'previewJiraGlobalCarga');
    // Nota: a função atual não aceita parâmetros, então retorna preview do config atual
    // Se precisar de preview customizado, seria necessário modificar a Cloud Function
    const result = await previewJiraGlobalCarga({});
    return result.data;
  } catch (error) {
    console.error('Erro ao fazer preview de JQL:', error);
    throw error;
  }
}
