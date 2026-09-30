/**
 * Lista todos os escopos presentes em operacao_stats/summary
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createSign } from 'crypto';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = resolve(__dirname, '../Arquivos_Gerais');
const files = readdirSync(dir).filter(f => f.endsWith('.json') && f.includes('firebase-adminsdk'));
const sa = JSON.parse(readFileSync(join(dir, files[0]), 'utf8'));
const PROJECT_ID = sa.project_id;

function base64url(buf) { return buf.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,''); }
function makeJwt() {
  const now = Math.floor(Date.now()/1000);
  const h = base64url(Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT'})));
  const p = base64url(Buffer.from(JSON.stringify({iss:sa.client_email,scope:'https://www.googleapis.com/auth/datastore',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})));
  const s = createSign('RSA-SHA256'); s.update(h+'.'+p);
  return h+'.'+p+'.'+base64url(s.sign(sa.private_key));
}
function httpReq(method,host,path,body,headers) {
  return new Promise((res,rej) => {
    const d = body?(typeof body==='string'?body:JSON.stringify(body)):null;
    const hh = Object.assign({},headers);
    if(d){if(!hh['Content-Type'])hh['Content-Type']='application/json';hh['Content-Length']=Buffer.byteLength(d);}
    const r = https.request({hostname:host,path,method,headers:hh},resp=>{let raw='';resp.on('data',c=>{raw+=c;});resp.on('end',()=>{try{res({s:resp.statusCode,b:JSON.parse(raw)});}catch(e){res({s:resp.statusCode,b:raw});}});});
    r.on('error',rej);if(d)r.write(d);r.end();
  });
}
async function getToken() {
  const r = await httpReq('POST','oauth2.googleapis.com','/token','grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion='+makeJwt(),{'Content-Type':'application/x-www-form-urlencoded'});
  return r.b.access_token;
}
function fromV(v) {
  if(!v) return null;
  if('nullValue' in v) return null;
  if('integerValue' in v) return Number(v.integerValue);
  if('doubleValue' in v) return v.doubleValue;
  if('stringValue' in v) return v.stringValue;
  if('booleanValue' in v) return v.booleanValue;
  if('arrayValue' in v) return (v.arrayValue.values||[]).map(fromV);
  if('mapValue' in v) { const o={}; for(const k of Object.keys(v.mapValue.fields||{})) o[k]=fromV(v.mapValue.fields[k]); return o; }
  return null;
}

const token = await getToken();
const docPath = 'projects/'+PROJECT_ID+'/databases/default/documents/operacao_stats/summary';
const r = await httpReq('GET','firestore.googleapis.com','/v1/'+docPath,null,{Authorization:'Bearer '+token});
const fields = r.b.fields||{};
const data = {};
for(const k of Object.keys(fields)) data[k] = fromV(fields[k]);

console.log('\n=== byEscopo keys ===');
if(data.byEscopo && typeof data.byEscopo==='object' && !Array.isArray(data.byEscopo)) {
  for(const [k,v] of Object.entries(data.byEscopo)) console.log('  '+JSON.stringify(k)+': '+v);
} else { console.log('  (não encontrado)'); }

console.log('\n=== radarByEscopo ===');
if(Array.isArray(data.radarByEscopo)) {
  for(const item of data.radarByEscopo) console.log('  key:'+JSON.stringify(item.key||item.label||'?')+'  total:'+item.total);
} else { console.log('  (não é array ou não encontrado)'); }

console.log('\n=== byIssueTypeByEscopo keys ===');
if(data.byIssueTypeByEscopo && typeof data.byIssueTypeByEscopo==='object') {
  for(const k of Object.keys(data.byIssueTypeByEscopo)) console.log('  '+JSON.stringify(k));
} else { console.log('  (não encontrado)'); }

console.log('\n=== Top-level fields ===');
for(const k of Object.keys(data)) {
  const v = data[k];
  if(typeof v !== 'object' || v===null) console.log('  '+k+': '+v);
  else console.log('  '+k+': ['+typeof v+']');
}
