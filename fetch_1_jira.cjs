require('dotenv').config({ path: './functions/.env' });

const token = process.env.JIRA_API_TOKEN;
const email = process.env.JIRA_USER_EMAIL;
const domain = process.env.JIRA_DOMAIN || 'jiracpfl.atlassian.net';

const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;

// JQL sem os filtros do app
const jql = 'project = DEMANDA ORDER BY created DESC';
const jiraUrl = `https://${domain}/rest/api/3/search/jql`;

async function fetchJira() {
    try {
        const response = await fetch(jiraUrl, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jql: jql,
                maxResults: 1,
                fields: ["summary", "description", "priority", "status", "creator", "reporter", "assignee", "issuetype", "duedate", "environment", "labels", "created"]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Jira retornou ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log(JSON.stringify(data.issues, null, 2));
    } catch (e) {
        console.error(e);
    }
}

fetchJira();
