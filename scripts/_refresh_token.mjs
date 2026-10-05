/**
 * Refresh the Firebase OAuth2 access token using the stored refresh_token.
 * Writes the new access_token back to firebase-tools.json.
 */
import { readFileSync, writeFileSync } from 'fs';
import { request } from 'https';

const CFG_PATH = '/Users/rhonorin/.config/configstore/firebase-tools.json';
const cfg = JSON.parse(readFileSync(CFG_PATH, 'utf8'));

const refreshToken = cfg?.tokens?.refresh_token;
if (!refreshToken) {
  console.error('No refresh_token found in firebase-tools.json');
  process.exit(1);
}

// Google OAuth2 token endpoint
const CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

const body = new URLSearchParams({
  grant_type: 'refresh_token',
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
  refresh_token: refreshToken,
}).toString();

function post(hostname, path, body) {
  return new Promise((resolve, reject) => {
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    };
    const req = request({ hostname, path, method: 'POST', headers }, res => {
      let buf = '';
      res.on('data', d => (buf += d));
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('Refreshing access token...');
  const res = await post('oauth2.googleapis.com', '/token', body);
  
  if (res.status !== 200) {
    console.error('Failed to refresh token:', res.status, res.body);
    process.exit(1);
  }
  
  const data = JSON.parse(res.body);
  const newAccessToken = data.access_token;
  
  if (!newAccessToken) {
    console.error('No access_token in response:', res.body);
    process.exit(1);
  }
  
  // Update the access_token in firebase-tools.json
  cfg.tokens.access_token = newAccessToken;
  writeFileSync(CFG_PATH, JSON.stringify(cfg, null, 2));
  
  console.log('✅ access_token refreshed and saved to firebase-tools.json');
  console.log('Token preview:', newAccessToken.substring(0, 40) + '...');
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
