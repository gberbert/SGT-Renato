import React, { useState, useMemo } from 'react';
import { Box, Flex, Text } from '@radix-ui/themes';
import { Loader2, Eye, Pencil, ChevronRight, ChevronDown, LineChart as LCIcon } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend } from 'recharts';
import { stripNumericPrefix } from '../../utils/stripNumericPrefix';

function lastKnownVal(dateMap, targetDate) {
  let last = null;
  for (const [d, v] of dateMap) { if (d <= targetDate) last = v; else break; }
  return last;
}
function avancoColor(pct) {
  if (pct >= 75) return '#4ade80';
  if (pct >= 40) return '#fbbf24';
  return '#f87171';
}
const fD = (iso) => { const [y,m,d]=iso.split('-'); return `${d}/${m}/${y.slice(2)}`; };
const LINE_COLORS = ['#22d3ee','#4ade80','#fbbf24','#f87171','#a78bfa','#fb923c','#38bdf8','#34d399','#f472b6','#818cf8','#10b981','#ef4444','#0ea5e9','#84cc16','#d946ef'];

function ChartTip({active,payload,label}){
  if(!active||!payload?.length) return null;
  return(
    <div style={{background:'rgba(10,10,15,.95)',border:'1px solid rgba(255,255,255,.12)',borderRadius:8,padding:'8px 14px',fontSize:12}}>
      <div style={{color:'var(--gray-9)',marginBottom:6,fontWeight:700}}>{label}</div>
      {payload.map(p=>(
        <div key={p.dataKey} style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
          <div style={{width:8,height:8,borderRadius:'50%',background:p.color,flexShrink:0}}/>
          <span style={{color:'var(--gray-11)',fontSize:11}}>{p.dataKey}</span>
          <span style={{color:p.color,fontWeight:700,marginLeft:'auto',paddingLeft:10}}>{p.value}%</span>
        </div>
      ))}
    </div>
  );
}

export function OperacaoProgressHistoryTable({historyMap,rows,squadMap,modalLoadingKey,onView,onEdit}){
  const [showDev,setShowDev]=useState(false);
  const [showTeste,setShowTeste]=useState(false);
  const [filterStart,setFilterStart]=useState('');
  const [filterEnd,setFilterEnd]=useState('');
  const [showChart,setShowChart]=useState(false);

  if(!historyMap||!rows.length) return null;

  const allV=[...historyMap.values()];
  const devDs=[...new Set(allV.flatMap(h=>h.dev.map(e=>e.date.toISOString().slice(0,10))))].sort();
  const tstDs=[...new Set(allV.flatMap(h=>h.teste.map(e=>e.date.toISOString().slice(0,10))))].sort();
  const allDates=[...new Set([...devDs,...tstDs])].sort();

  if(!allDates.length) return(
    <Box mt="2" style={{padding:'14px',background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:8}}>
      <Text size="2" color="gray">Nenhuma alteração de % Conclusão registrada no statusChangeLog.</Text>
    </Box>
  );

  const devByKey=new Map();
  const tstByKey=new Map();
  for(const [key,hist] of historyMap){
    const dm=new Map(); for(const e of hist.dev) dm.set(e.date.toISOString().slice(0,10),e.value); devByKey.set(key,dm);
    const tm=new Map(); for(const e of hist.teste) tm.set(e.date.toISOString().slice(0,10),e.value); tstByKey.set(key,tm);
  }

  // Apply date range filter to allDates
  const filteredDates=allDates.filter(d=>(!filterStart||d>=filterStart)&&(!filterEnd||d<=filterEnd));

  // Build chart data: for each filtered date, compute running avanço for each ticket
  const chartData=filteredDates.map(d=>{
    const pt={label:fD(d),date:d};
    for(const ticket of rows){
      const dm=devByKey.get(ticket.issueKey)||new Map();
      const tm=tstByKey.get(ticket.issueKey)||new Map();
      const isBase=d==='2026-10-10';
      const devV=lastKnownVal(dm,d);
      const testeV=lastKnownVal(tm,d);
      const curDev=ticket.percentualConclusao!=null?Number(ticket.percentualConclusao):null;
      const curTeste=ticket.percentualConclusaoTesteInterno!=null?Number(ticket.percentualConclusaoTesteInterno):null;
      if(devV!=null||testeV!=null||curDev!=null||curTeste!=null){
        const devEff=(devV!=null&&(devV>0||!isBase))?devV:(curDev??0);
        const testeEff=(testeV!=null&&(testeV>0||!isBase))?testeV:(curTeste??0);
        pt[ticket.issueKey]=Math.round(((devEff+testeEff)/2)*10)/10;
      }
    }
    return pt;
  });

  return(
    <Box mt="2" className="operacao-radar-tickets-panel">
      {/* Header */}
      <Flex align="center" justify="between" mb="2" wrap="wrap" gap="2">
        <Box>
          <Text size="3" weight="bold">Histórico de % Conclusão — Linha do Tempo</Text>
          <Text size="1" color="gray">Cada coluna = data de uma alteração registrada no statusChangeLog</Text>
        </Box>
        <Flex gap="2" wrap="wrap" align="center">
          {/* Date range filter */}
          <Flex align="center" gap="2" style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.08)',borderRadius:8,padding:'4px 10px'}}>
            <Text size="1" color="gray" style={{whiteSpace:'nowrap'}}>Período</Text>
            <input type="date" value={filterStart} onChange={e=>setFilterStart(e.target.value)}
              style={{background:'transparent',border:'none',color:'var(--gray-11)',fontSize:11,outline:'none',cursor:'pointer'}}/>
            <Text size="1" color="gray">–</Text>
            <input type="date" value={filterEnd} onChange={e=>setFilterEnd(e.target.value)}
              style={{background:'transparent',border:'none',color:'var(--gray-11)',fontSize:11,outline:'none',cursor:'pointer'}}/>
            {(filterStart||filterEnd)&&(
              <button type="button" onClick={()=>{setFilterStart('');setFilterEnd('');}}
                style={{background:'none',border:'none',cursor:'pointer',color:'var(--gray-8)',fontSize:13,lineHeight:1,padding:0}}>×</button>
            )}
          </Flex>
          {/* Chart toggle */}
          <button type="button" onClick={()=>setShowChart(v=>!v)}
            style={{display:'flex',alignItems:'center',gap:5,fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:6,cursor:'pointer',border:showChart?'1px solid rgba(74,222,128,0.6)':'1px solid rgba(74,222,128,0.3)',background:showChart?'rgba(74,222,128,0.15)':'rgba(74,222,128,0.05)',color:'#4ade80'}}>
            <LCIcon size={13}/>
            {showChart?'Fechar Gráfico':'Ver Gráfico'}
          </button>
          {/* Detail toggles */}
          <button type="button" onClick={()=>setShowDev(v=>!v)}
            style={{display:'flex',alignItems:'center',gap:5,fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:6,cursor:'pointer',border:'1px solid rgba(129,140,248,0.4)',background:showDev?'rgba(129,140,248,0.15)':'rgba(129,140,248,0.06)',color:'#818cf8'}}>
            {showDev?<ChevronDown size={13}/>:<ChevronRight size={13}/>}% Conclusão ({devDs.length})
          </button>
          <button type="button" onClick={()=>setShowTeste(v=>!v)}
            style={{display:'flex',alignItems:'center',gap:5,fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:6,cursor:'pointer',border:'1px solid rgba(245,158,11,0.4)',background:showTeste?'rgba(245,158,11,0.15)':'rgba(245,158,11,0.06)',color:'#f59e0b'}}>
            {showTeste?<ChevronDown size={13}/>:<ChevronRight size={13}/>}% Conclusão Teste ({tstDs.length})
          </button>
        </Flex>
      </Flex>

      {/* Table */}
      <Box className="operacao-radar-tickets-table-wrap">
        <table className="operacao-radar-tickets-table">
          <colgroup>
            <col className="col-num"/><col className="col-acoes"/><col className="col-key"/>
            <col className="col-status"/><col className="col-squad"/>
            {filteredDates.map(d=><col key={`ac-${d}`} style={{minWidth:68}}/>)}
            {showDev&&devDs.map(d=><col key={`dc-${d}`} style={{minWidth:64}}/>)}
            {showTeste&&tstDs.map(d=><col key={`tc-${d}`} style={{minWidth:64}}/>)}
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2}>#</th><th rowSpan={2}>AÇÕES</th><th rowSpan={2}>ISSUE_KEY</th>
              <th rowSpan={2}>STATUS</th><th rowSpan={2}>SQUAD</th>
              {filteredDates.length>0&&<th colSpan={filteredDates.length} style={{color:'#4ade80',textAlign:'center',background:'rgba(74,222,128,0.06)',borderBottom:'2px solid rgba(74,222,128,0.3)'}}>AVANÇO</th>}
              {showDev&&devDs.length>0&&<th colSpan={devDs.length} style={{color:'#818cf8',textAlign:'center',background:'rgba(129,140,248,0.06)',borderBottom:'2px solid rgba(129,140,248,0.3)'}}>% CONCLUSÃO</th>}
              {showTeste&&tstDs.length>0&&<th colSpan={tstDs.length} style={{color:'#f59e0b',textAlign:'center',background:'rgba(245,158,11,0.06)',borderBottom:'2px solid rgba(245,158,11,0.3)'}}>% CONCLUSÃO TESTE</th>}
            </tr>
            <tr>
              {filteredDates.map(d=>{const isBase=d==='2026-10-10';return(
                <th key={`ah-${d}`} style={{color:isBase?'rgba(74,222,128,0.55)':'#4ade80',fontSize:11,fontWeight:700,textAlign:'center',padding:'4px 6px',background:isBase?'rgba(74,222,128,0.02)':'rgba(74,222,128,0.04)',whiteSpace:'nowrap',borderRight:isBase?'2px dashed rgba(74,222,128,0.3)':undefined}}>
                  {isBase?`📌 ${fD(d)}`:fD(d)}
                </th>
              );})}
              {showDev&&devDs.map(d=>{const isBase=d==='2026-10-10';return <th key={`dh-${d}`} style={{color:isBase?'rgba(129,140,248,0.55)':'#818cf8',fontSize:11,fontWeight:700,textAlign:'center',padding:'4px 6px',background:isBase?'rgba(129,140,248,0.02)':'rgba(129,140,248,0.04)',whiteSpace:'nowrap',borderRight:isBase?'2px dashed rgba(129,140,248,0.3)':undefined}}>{isBase?`📌 ${fD(d)}`:fD(d)}</th>;})}
              {showTeste&&tstDs.map(d=>{const isBase=d==='2026-10-10';return <th key={`th-${d}`} style={{color:isBase?'rgba(245,158,11,0.55)':'#f59e0b',fontSize:11,fontWeight:700,textAlign:'center',padding:'4px 6px',background:isBase?'rgba(245,158,11,0.02)':'rgba(245,158,11,0.04)',whiteSpace:'nowrap',borderRight:isBase?'2px dashed rgba(245,158,11,0.3)':undefined}}>{isBase?`📌 ${fD(d)}`:fD(d)}</th>;})}
            </tr>
          </thead>
          <tbody>
            {rows.map((ticket,idx)=>{
              const dm=devByKey.get(ticket.issueKey)||new Map();
              const tm=tstByKey.get(ticket.issueKey)||new Map();
              const sq=squadMap.get(ticket.issueKey);
              const curDev=ticket.percentualConclusao!=null?Number(ticket.percentualConclusao):null;
              const curTeste=ticket.percentualConclusaoTesteInterno!=null?Number(ticket.percentualConclusaoTesteInterno):null;
              return(
                <tr key={ticket.issueKey}>
                  <td className="operacao-radar-tickets-num">{idx+1}</td>
                  <td className="operacao-radar-tickets-acoes">
                    <button type="button" className="operacao-radar-tickets-action-btn action-view" title="Ver" disabled={modalLoadingKey===ticket.issueKey} onClick={()=>onView(ticket)}>
                      {modalLoadingKey===ticket.issueKey?<Loader2 size={14} className="spin"/>:<Eye size={14}/>}
                    </button>
                    <button type="button" className="operacao-radar-tickets-action-btn action-edit" title="Editar" disabled={modalLoadingKey===ticket.issueKey} onClick={()=>onEdit(ticket)}>
                      <Pencil size={14}/>
                    </button>
                  </td>
                  <td className="operacao-radar-tickets-key-cell">
                    <div className="operacao-radar-tickets-key-inner">
                      <span className="operacao-radar-tickets-expand placeholder" aria-hidden="true"/>
                      {ticket.issueUrl?<a className="operacao-radar-tickets-key" href={ticket.issueUrl} target="_blank" rel="noopener noreferrer">{ticket.issueKey}</a>:ticket.issueKey}
                    </div>
                  </td>
                  <td>{ticket.status||'—'}</td>
                  <td>{sq?<span style={{fontSize:12,fontWeight:600,padding:'2px 8px',borderRadius:5,background:'rgba(16,185,129,0.13)',border:'1px solid rgba(16,185,129,0.35)',color:'#6ee7b7',whiteSpace:'nowrap'}}>{sq}</span>:(stripNumericPrefix(ticket.grupoSuporte)||'—')}</td>
                  {filteredDates.map(d=>{
                    const hasChange=dm.has(d)||tm.has(d);
                    if(!hasChange) return <td key={`av-${d}`} style={{textAlign:'center',padding:'4px 6px'}}><span style={{color:'rgba(255,255,255,0.12)',fontSize:11}}>—</span></td>;
                    const devV=lastKnownVal(dm,d); const testeV=lastKnownVal(tm,d);
                    const isBase=d==='2026-10-10';
                    const devEff=(devV!=null&&(devV>0||!isBase))?devV:(curDev??0);
                    const testeEff=(testeV!=null&&(testeV>0||!isBase))?testeV:(curTeste??0);
                    const rounded=Math.round(((devEff+testeEff)/2)*10)/10;
                    return(
                      <td key={`av-${d}`} style={{textAlign:'center',padding:'4px 6px',background:'rgba(74,222,128,0.06)',borderRight:isBase?'2px dashed rgba(74,222,128,0.2)':undefined}}>
                        <span style={{fontWeight:800,fontSize:12,color:avancoColor(rounded)}} title={`Dev: ${devEff}% | Teste: ${testeEff}%`}>{rounded}%</span>
                      </td>
                    );
                  })}
                  {showDev&&devDs.map(d=>{const isBase=d==='2026-10-10';return(
                    <td key={`dv-${d}`} style={{textAlign:'center',padding:'4px 6px',background:dm.has(d)?(isBase?'rgba(129,140,248,0.04)':'rgba(129,140,248,0.08)'):undefined,borderRight:isBase?'2px dashed rgba(129,140,248,0.2)':undefined}}>
                      {dm.has(d)?<span style={{fontWeight:700,fontSize:12,color:isBase?'rgba(129,140,248,0.6)':'#818cf8'}}>{dm.get(d)}%</span>:<span style={{color:'rgba(255,255,255,0.15)',fontSize:11}}>—</span>}
                    </td>
                  );})}
                  {showTeste&&tstDs.map(d=>{const isBase=d==='2026-10-10';return(
                    <td key={`tv-${d}`} style={{textAlign:'center',padding:'4px 6px',background:tm.has(d)?(isBase?'rgba(245,158,11,0.04)':'rgba(245,158,11,0.08)'):undefined,borderRight:isBase?'2px dashed rgba(245,158,11,0.2)':undefined}}>
                      {tm.has(d)?<span style={{fontWeight:700,fontSize:12,color:isBase?'rgba(245,158,11,0.6)':'#f59e0b'}}>{tm.get(d)}%</span>:<span style={{color:'rgba(255,255,255,0.15)',fontSize:11}}>—</span>}
                    </td>
                  );})}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Box>

      {/* Timeline Chart */}
      {showChart && chartData.length > 0 && (
        <Box mt="4" style={{border:'1px solid rgba(74,222,128,0.2)',borderRadius:12,background:'rgba(255,255,255,0.01)',padding:'16px 8px 8px'}}>
          <Text size="2" weight="bold" color="gray" style={{display:'block',marginBottom:10,paddingLeft:8}}>
            Evolução do Avanço por Ticket
          </Text>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{top:4,right:24,left:0,bottom:filteredDates.length>10?30:8}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
              <XAxis dataKey="label" tick={{fill:'var(--gray-9)',fontSize:10}} angle={filteredDates.length>8?-35:0} textAnchor={filteredDates.length>8?'end':'middle'} interval={0}/>
              <YAxis domain={[0,100]} tick={{fill:'var(--gray-9)',fontSize:10}} tickFormatter={v=>`${v}%`}/>
              <RTooltip content={<ChartTip/>}/>
              <Legend wrapperStyle={{fontSize:10,color:'var(--gray-9)',paddingTop:4}}/>
              {rows.map((ticket,idx)=>(
                <Line
                  key={ticket.issueKey}
                  type="monotone"
                  dataKey={ticket.issueKey}
                  stroke={LINE_COLORS[idx%LINE_COLORS.length]}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{r:4}}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Box>
  );
}

export default OperacaoProgressHistoryTable;
