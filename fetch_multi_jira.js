process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import fs from 'fs';

const envVars = fs.readFileSync('./functions/.env', 'utf-8').split('\n').reduce((acc, line) => {
    const [key, ...value] = line.split('=');
    if (key && value.length > 0) acc[key.trim()] = value.join('=').trim();
    return acc;
}, {});
const authHeader = `Basic ${Buffer.from(`${envVars.JIRA_USER_EMAIL}:${envVars.JIRA_API_TOKEN}`).toString('base64')}`;
const domain = envVars.JIRA_DOMAIN || 'jiracpfl.atlassian.net';

const jql = 'issue IN (TI-21465, TI-22093, TI-22518, TI-22530, TI-22822, TI-22875, TI-23957, TI-27191, TI-32457, TI-35149, TI-37022)';
const jiraUrl = `https://${domain}/rest/api/3/search/jql?expand=names`;

async function fetchJira() {
    try {
        const response = await fetch(jiraUrl, {
            method: 'POST',
            headers: { 'Authorization': authHeader, 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ jql, maxResults: 50, fields: ["*all"] })
        });
        const data = await response.json();
        
        // Encontrar campo de Fila e Sistema
        let filaField = null;
        let sistemaField = 'customfield_10414'; // Padrão
        
        if (data.names) {
            for (const [key, name] of Object.entries(data.names)) {
                const lowerName = name.toLowerCase();
                if (lowerName.includes('fila') && !filaField) filaField = key;
            }
        }
        
        console.log("Ticket | Título | Sistema Impactado | Fila | Tipo");
        console.log("--------------------------------------------------");
        
        for (const issue of (data.issues || [])) {
            const f = issue.fields;
            const ticket = issue.key;
            const titulo = f.summary || '';
            const tipo = f.issuetype ? f.issuetype.name : '';
            
            let sistema = 'N/A';
            if (f[sistemaField]) {
                sistema = typeof f[sistemaField] === 'string' ? f[sistemaField] : (f[sistemaField].value || f[sistemaField].name || String(f[sistemaField]));
            } else if (f.components && f.components.length > 0) {
                sistema = f.components.map(c => c.name).join(', ');
            }
            
            let fila = 'N/A';
            if (f.customfield_10083) {
                fila = f.customfield_10083.name || (typeof f.customfield_10083 === 'string' ? f.customfield_10083 : String(f.customfield_10083));
            }
            
            console.log(`${ticket} | ${titulo} | ${sistema} | ${fila} | ${tipo}`);
        }
        
        console.log("\n(Campos detectados: Fila=customfield_10083(Grupo de Suporte), Sistema=" + sistemaField + ")");
    } catch (e) {
        console.error(e);
    }
}
fetchJira();
