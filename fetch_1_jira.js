process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import fs from 'fs';

const envContent = fs.readFileSync('./functions/.env', 'utf-8');
const envVars = envContent.split('\n').reduce((acc, line) => {
    const [key, ...value] = line.split('=');
    if (key && value.length > 0) {
        acc[key.trim()] = value.join('=').trim();
    }
    return acc;
}, {});

const token = envVars.JIRA_API_TOKEN;
const email = envVars.JIRA_USER_EMAIL;
const domain = envVars.JIRA_DOMAIN || 'jiracpfl.atlassian.net';

const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;

const jql = 'issue = TI-22822';
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
                fields: ["*all"]
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
