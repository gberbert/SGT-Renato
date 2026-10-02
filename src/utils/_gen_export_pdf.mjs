import { writeFileSync } from 'fs';

const lines = [];

const push = (...args) => args.forEach(l => lines.push(l));

push(
  '/* eslint-disable */',
  'const SL=["Análise e T-Shirt","Aguardando Análise Técnica","Aguardando Aprovação T-Shirt","Planejamento","Aprovação de Planejamento","Aguardando Planejamento","Em Execução","Em Teste","Em homologação","Revisão de homologação","Etapa de KT","Aguardando Mudança","Concluída"];',
  'const SF=["NTT Data","CPFL","CPFL","NTT Data","CPFL","CPFL Prevista","NTT Data","CPFL","CPFL","NTT Data","NTT Data","NTT Data","CPFL"];',
  'function fc(f){if(f==="NTT Data")return{bg:"#0c1a2e",border:"#2563eb",text:"#93c5fd",badge:"#1d4ed8",bt:"#bfdbfe"};if(f==="CPFL Prevista")return{bg:"#1c1408",border:"#d97706",text:"#fcd34d",badge:"#92400e",bt:"#fde68a"};return{bg:"#1a0c00",border:"#ea580c",text:"#fdba74",badge:"#7c2d12",bt:"#fed7aa"};}',
  'function sb(s){var l=(s||"").toLowerCase();if(l.includes("conclu")||l.includes("fechad")||l.includes("resolvid"))return"background:#14532d;color:#86efac;border:1px solid #166534";if(l.includes("em execu"))return"background:#1e3a5f;color:#93c5fd;border:1px solid #1d4ed8";if(l.includes("homolog")||l.includes("revis"))return"background:#2e1065;color:#c4b5fd;border:1px solid #6d28d9";if(l.includes("aguard")||l.includes("mudan"))return"background:#451a03;color:#fcd34d;border:1px solid #d97706";if(l.includes("teste"))return"background:#0c2a3a;color:#67e8f9;border:1px solid #0891b2";if(l.includes("anali")||l.includes("t-shirt"))return"background:#431407;color:#fdba74;border:1px solid #ea580c";if(l.includes("planej")||l.includes("aprova"))return"background:#0f172a;color:#a5b4fc;border:1px solid #4f46e5";return"background:#1f2937;color:#d1d5db;border:1px solid #374151";}',
  'function esc(s){if(!s)return"";return String(s).replace(/&/g,"&").replace(/</g,"<").replace(/>/g,">").replace(/"/g,""");}',
  'function gp(t){var v=t.percentualConclusao;if(v==null||v==="")return null;return Math.min(100,Math.max(0,Number(v)));}',
  'function pb(p){if(p==null)return"";var color=p===100?"#22c55e":p>=70?"#3b82f6":p>=30?"#f59e0b":"#ef4444";return\'<div style="display:flex;align-items:center;gap:4px"><div style="width:50px;height:6px;border-radius:3px;background:#374151;overflow:hidden"><div style="height:100%;width:\'+p+\'%;background:\'+color+\';border-radius:3px"></div></div><span style="font-size:10px;font-weight:700;color:\'+color+\'">\'+p+\'%</span></div>\';}',
  'function st(t){var sq=t._resolvedSquad||t.squadPrincipal||t.squad||null;if(!sq)return"";var pal=["#6366f1","#22d3ee","#f59e0b","#22c55e","#ec4899","#f97316","#a78bfa","#84cc16"];var h=0;for(var i=0;i<sq.length;i++)h=(h*31+sq.charCodeAt(i))%pal.length;var c=pal[h];return\'<span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:8px;background:\'+c+\'22;color:\'+c+\';border:1px solid \'+c+\'55;white-space:nowrap">\'+esc(sq)+\'</span>\';}',
  'function itt(t){var tp=t.issueType||t.issuetype||"";if(!tp)return"";return\'<span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:5px;background:#1f2937;color:#9ca3af;border:1px solid #374151">\'+esc(tp)+\'</span>\';}',
  'function tr2(tks){if(!tks.length)return\'<tr><td colspan="5" style="padding:10px;text-align:center;color:#6b7280;font-style:italic">Nenhum ticket</td></tr>\';var r="";for(var i=0;i<tks.length;i++){var t=tks[i];var p=gp(t);var imp=t.impedimento?\'<span style="font-size:9px;font-weight:800;padding:1px 5px;border-radius:5px;background:#7f1d1d;color:#fca5a5;border:1px solid #991b1b;margin-right:4px">IMP</span>\':"";r+=\'<tr style="border-bottom:1px solid #1f2937"><td style="padding:5px 8px;font-family:monospace;font-size:11px;font-weight:700;color:#818cf8;white-space:nowrap">\'+esc(t.issueKey||t.id||"—")+\'</td><td style="padding:5px 8px;font-size:11px;color:#e5e7eb"><div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">\'+imp+itt(t)+\'<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px">\'+esc(t.summary||"(sem título)")+\'</span></div></td><td style="padding:5px 8px;white-space:nowrap"><span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:8px;\'+sb(t.status)+\'">\'+esc(t.status||"—")+\'</span></td><td style="padding:5px 8px">\'+st(t)+\'</td><td style="padding:5px 8px">\'+pb(p)+\'</td></tr>\';}return r;}',
  'function fd(str){if(!str)return"";var d=new Date(str+"T00:00:00");if(isNaN(d.getTime()))return str;return d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"});}',
  'function csc(s){if(!s)return"#6b7280";var l=s.toLowerCase();if(l==="ativo"||l==="active")return"#22c55e";if(l.includes("conclu"))return"#6366f1";if(l==="planejamento")return"#3b82f6";return"#6b7280";}',
);

push(
  'function mkTable(tks,bc){',
  '  return \'<table style="width:100%;border-collapse:collapse;background:#0d1117;border-radius:0 0 8px 8px;border:1px solid \'+(bc||"#1f2937")+\'"><thead><tr style="border-bottom:1px solid #374151"><th style="padding:6px 8px;font-size:10px;font-weight:700;color:#6b7280;text-align:left;white-space:nowrap">CHAVE</th><th style="padding:6px 8px;font-size:10px;font-weight:700;color:#6b7280;text-align:left">RESUMO</th><th style="padding:6px 8px;font-size:10px;font-weight:700;color:#6b7280;text-align:left;white-space:nowrap">STATUS</th><th style="padding:6px 8px;font-size:10px;font-weight:700;color:#6b7280;text-align:left">SQUAD</th><th style="padding:6px 8px;font-size:10px;font-weight:700;color:#6b7280;text-align:left;white-space:nowrap">%</th></tr></thead><tbody>\'+tr2(tks)+\'</tbody></table>\';',
  '}',
);

push(
  'export function exportCicloPdf(opts){',
  '  var allTickets=opts.allTickets||[];',
  '  var ciclos=opts.ciclos||[];',
  '  var getCicloTickets=opts.getCicloTickets||function(){return[];};',
  '  var backlogTickets=opts.backlogTickets||[];',
  '  var lastSyncLabel=opts.lastSyncLabel||"";',
  '  var cm={};',
  '  for(var i=0;i<allTickets.length;i++){var s=allTickets[i].status||"";cm[s]=(cm[s]||0)+1;}',
  '  var geradoEm=new Date().toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});',
  '  var totalAll=allTickets.length;',
  '  var cardsHtml="";',
  '  for(var ci=0;ci<SL.length;ci++){',
  '    var status=SL[ci];var fila=SF[ci];var cnt=cm[status]||0;var c=fc(fila);var active=cnt>0;',
  '    cardsHtml+=\'<div style="flex:1 1 0;min-width:0;background:\'+(active?c.bg:"#111827")+\';border:2px solid \'+(active?c.border:"#1f2937")+\';border-radius:10px;padding:10px 10px 8px;display:flex;flex-direction:column;gap:3px;opacity:\'+(active?"1":"0.45")+\'"><div style="font-size:32px;font-weight:900;line-height:1;color:\'+(active?c.text:"#4b5563")+\'">\'+cnt+\'</div><div style="font-size:10px;font-weight:700;color:\'+(active?c.text:"#6b7280")+\';line-height:1.3">\'+esc(status)+\'</div><div style="margin-top:3px"><span style="font-size:9px;font-weight:800;padding:2px 6px;border-radius:20px;background:\'+(active?c.badge:"#374151")+\';color:\'+(active?c.bt:"#6b7280")+\'">\'+esc(fila)+\'</span></div></div>\';',
  '  }',
  '  var sectionsHtml="";',
  '  for(var ci2=0;ci2<ciclos.length;ci2++){',
  '    var ciclo=ciclos[ci2];var tks=getCicloTickets(ciclo);',
  '    var sc=csc(ciclo.status);',
  '    var dates=[ciclo.dataInicio,ciclo.dataFim].filter(Boolean).map(fd).join(" – ");',
  '    sectionsHtml+=\'<div style="margin-bottom:20px;page-break-inside:avoid"><div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#111827;border-radius:8px 8px 0 0;border:1px solid #1f2937;border-bottom:none"><span style="font-size:14px;font-weight:800;color:#f9fafb">\'+esc(ciclo.nome)+\'</span>\'+(dates?\'<span style="font-size:11px;color:#6b7280">\'+esc(dates)+\'</span>\':"")+\' \'+(ciclo.status?\'<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:\'+sc+\'22;color:\'+sc+\';border:1px solid \'+sc+\'55">\'+esc(ciclo.status)+\'</span>\':"")+\'<span style="margin-left:auto;font-size:11px;color:#6b7280">\'+tks.length+\' ticket\'+(tks.length!==1?"s":"")+\'</span></div>\'+mkTable(tks)+\'</div>\';',
  '  }',
  '  var backlogHtml="";',
  '  if(backlogTickets&&backlogTickets.length>0){',
  '    backlogHtml=\'<div style="margin-bottom:20px;page-break-inside:avoid"><div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#111827;border-radius:8px 8px 0 0;border:1px solid #374151;border-bottom:none"><span style="font-size:14px;font-weight:800;color:#9ca3af">Backlog / Sem Ciclo</span><span style="margin-left:auto;font-size:11px;color:#6b7280">\'+backlogTickets.length+\' ticket\'+(backlogTickets.length!==1?"s":"")+\'</span></div>\'+mkTable(backlogTickets,"#374151")+\'</div>\';',
  '  }',
);

const htmlTemplate = `
  var html='<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Planejamento de Ciclos</title><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#030712;color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:12px;padding:20px}@page{size:A4 portrait;margin:15mm}@media print{body{padding:0}}</style></head><body>';
  html+='<div style="background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%);border-radius:12px;padding:18px 20px 14px;margin-bottom:20px;border:1px solid #312e81">';
  html+='
