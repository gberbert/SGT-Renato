import { readFileSync } from 'fs';
const cfg = JSON.parse(readFileSync('/Users/rhonorin/.config/configstore/firebase-tools.json', 'utf8'));
const t = cfg?.tokens || {};
console.log('token keys:', Object.keys(t).join(', '));
console.log('has access_token:', !!t.access_token);
console.log('has refresh_token:', !!t.refresh_token);
console.log('has id_token:', !!t.id_token);
// Try to find client_id/secret used by firebase-tools
const u = cfg?.user || cfg?.authScopes || {};
console.log('user keys:', Object.keys(u).join(', ') || '(none)');
// Check for any _projects or config keys
console.log('top-level keys:', Object.keys(cfg).join(', '));
