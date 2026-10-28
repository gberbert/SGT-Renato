import React, { useMemo, useState } from 'react';
import { Box, Flex, Text, Select } from '@radix-ui/themes';
import { ShieldCheck, BarChart2, X, Info } from 'lucide-react';
import { computeObservabilidadeIndicators } from '../../utils/observabilidadeRules';
import { normalizeEscopoKey, ESCOPO_RADAR_ORDER } from '../../services/operacaoRadarService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer } from 'recharts';

const EF = [{ value:'ALL', label:'Todos os escopos' }, ...ESCOPO_RADAR_ORDER.map(e=>({ value:e.key, label:e.label }))];
const DF = [
  { value:'createdAt', label:'Data de Criação' },
  { value:'dataConclusao', label:'Data de Conclusão' },
  { value:'dataFimDesenvolvimento', label:'Fim Desenvolvimento' },
  { value:'dataFimTesteInterno', label:'Fim Teste Interno' },
  { value:'dataFimTesteQa', label:'Fim Teste QA' },
  { value:'dataFimHomologacao', label:'Fim Homologação' },
  { value:'dataInicioAtendimento', label:'Início Atendimento' },
  { value:'dataAprovacaoEfsr', label:'Aprovação EF/SR' },
  { value:'updatedAt', label:'Data Atualização' },
];
const GR = [
  { value:'day', label:'Dia' }, { value:'week', label:'Semana' },
  { value:'month', label:'Mês' }, { value:'quarter', label:'Trimestre' },
  { value:'semester', label:'Semestre' }, { value:'year', label:'Ano' },
];

function pd(v) {
  if (!v) return null;
  if (typeof v==='object'&&typeof v.toDate==='function') return v.toDate();
  if (typeof v==='object'&&v._seconds!=null) return new Date(v._seconds*1000);
  const d=new Date(v); return isNaN(d)?null:d;
}
function isoW(d) {
  const j4=new Date(d.getFullYear(),0,4),s=new Date(j4);
  s.setDate(j4.getDate()-((j4.getDay()+6)%7));
  return Math.max(1,Math.min(Math.floor((d-s)/86400000/7)+1,53));
}
function bk(date,g) {
  const y=date.getFullYear(),m=date.getMonth(),day=date.getDate();
  if(g==='day') return y+'-'+String(m+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
  if(g==='week') return y+'-W'+String(isoW(date)).padStart(2,'0');
  if(g==='month') return y+'-'+String(m+1).padStart(2,'0');
  if(g==='quarter') return y+'-Q'+(Math.floor(m/3)+1);
  if(g==='semester') return y+'-S'+(m<6?1:2);
  return String(y);
}
const MO=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
function fl(k,g) {
  if(!k) return k;
  if(g==='day'){const p=k.split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:k;}
  if(g==='week') return k.replace('-W',' W');
  if(g==='month'){const p=k.split('-');return p.length===2?MO[+p[1]-1]+'/'+p[0]:k;}
  return k;
}
function mkData(tix,field,g) {
  const c={};
  for(const t of tix){const d=pd(t[field]);if(!d)continue;const k=bk(d,g);c[k]=(c[k]||0)+1;}
  return Object.entries(c).sort(([a],[b])=>a.localeCompare(b)).map(([k,n])=>({key:k,label:fl(k,g),count:n}));
}
const fN=v=>Number(v||0).toLocaleString('pt-BR');
function Tip({active,payload,label}){if(!active||!payload?.length)return null;return(
  <div style={{background:'rgba(10,10,15,.95)',border:'1px solid rgba(255,255,255,.12)',borderRadius:8,padding:'8px 14px',fontSize:13}}>
    <div style={{color:'var(--gray-10)',marginBottom:4,fontWeight:600}}>{label}</div>
    <div style={{color:'#22d3ee',fontWeight:700}}>{payload[0].value} ticket(s)</div>
  </div>
);}
function SB({label,active,color,onClick}){return(
  <button type="button" onClick={onClick} style={{textAlign:'left',padding:'6px 10px',borderRadius:8,cursor:'pointer',fontSize:12,border:active?'1px solid '+color:'1px solid transparent',background:active?color+'22':'transparent',color:active?color:'var(--gray-10)',fontWeight:active?700:400,transition:'all .12s'}}>{label}</button>
);}

export default function OperacaoObservabilidade({tickets=[],onDrillTickets}){
  const [ef,setEf]=useState('ALL');
  const [se,setSe]=useState(null);
  const [df,setDf]=useState('createdAt');
  const [gr,setGr]=useState('month');
  const [rangeStart,setRangeStart]=useState('');
  const [rangeEnd,setRangeEnd]=useState('');
  const filtered=useMemo(()=>ef==='ALL'?tickets:tickets.filter(t=>normalizeEscopoKey(t.escopo)===ef),[tickets,ef]);
  const indicators=useMemo(()=>computeObservabilidadeIndicators(filtered),[filtered]);
  const totals=useMemo(()=>{const c={};for(const t of tickets){const k=normalizeEscopoKey(t.escopo);if(k)c[k]=(c[k]||0)+1;}return ESCOPO_RADAR_ORDER.map(e=>({...e,count:c[e.key]||0})).filter(e=>e.count>0);},[tickets]);
  const ctix=useMemo(()=>{
    if(!se) return [];
    let base=tickets.filter(t=>normalizeEscopoKey(t.escopo)===se);
    if(rangeStart||rangeEnd) {
      base=base.filter(t=>{
        const d=pd(t[df]);
        if(!d) return false;
        const iso=d.toISOString().slice(0,10);
        if(rangeStart && iso<rangeStart) return false;
        if(rangeEnd && iso>rangeEnd) return false;
        return true;
      });
    }
    return base;
  },[tickets,se,df,rangeStart,rangeEnd]);
  const cdata=useMemo(()=>mkData(ctix,df,gr),[ctix,df,gr]);
  const sm=ESCOPO_RADAR_ORDER.find(e=>e.key===se);
  const dfl=DF.find(f=>f.value===df)?.label||df;
  const nd=ctix.filter(t=>!pd(t[df])).length;
  return(
    <Box>
      <Flex align="center" justify="between" wrap="wrap" gap="3" mb="4">
        <Flex align="center" gap="2">
          <ShieldCheck size={20} color="#22d3ee"/>
          <Box><Text size="4" weight="bold">Observabilidade</Text><Text as="p" size="2" color="gray" style={{margin:0}}>Indicadores de saúde e distribuição temporal dos tickets.</Text></Box>
        </Flex>
        <Flex align="center" gap="2">
          <Text size="1" color="gray" style={{letterSpacing:'0.05em'}}>ESCOPO</Text>
          <Select.Root value={ef} onValueChange={setEf}>
            <Select.Trigger style={{minWidth:180}}/>
            <Select.Content>{EF.map(o=><Select.Item key={o.value} value={o.value}>{o.label}</Select.Item>)}</Select.Content>
          </Select.Root>
        </Flex>
      </Flex>
      <Box mb="5">
        <Text size="1" weight="bold" color="gray" style={{textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:10}}>Totais por Escopo — clique para distribuição temporal</Text>
        <Flex gap="3" wrap="wrap">
          {totals.length===0&&<Text size="2" color="gray">Nenhum ticket carregado.</Text>}
          {totals.map(e=>{const s=se===e.key;return(
            <button key={e.key} type="button" onClick={()=>setSe(s?null:e.key)} style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:4,padding:'12px 18px',borderRadius:12,minWidth:130,outline:'none',cursor:'pointer',border:s?'2px solid '+e.color:'1px solid rgba(255,255,255,.08)',background:s?e.color+'22':'rgba(255,255,255,.02)',transition:'all .15s'}}>
              <Flex align="center" gap="1"><BarChart2 size={13} color={e.color}/><Text size="1" style={{color:e.color,fontWeight:700,letterSpacing:'0.05em',textTransform:'uppercase'}}>{e.label}</Text></Flex>
              <Text size="6" weight="bold" style={{color:s?e.color:'var(--gray-12)',lineHeight:1}}>{fN(e.count)}</Text>
              {s&&<Text size="1" color="gray" style={{marginTop:2}}>clique para fechar</Text>}
            </button>
          );})}
        </Flex>
      </Box>
      {se&&sm&&(
        <Box mb="5" style={{border:'1px solid '+sm.color+'44',borderRadius:16,background:'rgba(255,255,255,.02)',overflow:'hidden'}}>
          <Flex align="center" justify="between" wrap="wrap" gap="3" style={{padding:'12px 18px',borderBottom:'1px solid rgba(255,255,255,.06)',background:sm.color+'12'}}>
            <Flex align="center" gap="2">
              <div style={{width:10,height:10,borderRadius:'50%',background:sm.color}}/>
              <Text size="3" weight="bold" style={{color:sm.color}}>{sm.label}</Text>
              <Text size="2" color="gray">— {fN(ctix.length)} ticket(s) · por {dfl}{nd>0?' · '+nd+' sem data':''}</Text>
            </Flex>
            <button type="button" onClick={()=>setSe(null)} style={{background:'none',border:'none',cursor:'pointer',padding:4,color:'var(--gray-9)'}}><X size={16}/></button>
          </Flex>
          <div style={{display:'flex',minHeight:360}}>
            <div style={{width:210,flexShrink:0,padding:'16px 12px',borderRight:'1px solid rgba(255,255,255,.06)',display:'flex',flexDirection:'column',gap:20,overflowY:'auto'}}>
              <div>
                <Text size="1" weight="bold" color="gray" style={{textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:8}}>Campo de Data</Text>
                <div style={{display:'flex',flexDirection:'column',gap:3}}>{DF.map(f=><SB key={f.value} label={f.label} active={df===f.value} color={sm.color} onClick={()=>setDf(f.value)}/>)}</div>
              </div>
              <div>
                <Text size="1" weight="bold" color="gray" style={{textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:8}}>Agrupamento</Text>
                <div style={{display:'flex',flexDirection:'column',gap:3}}>{GR.map(g=><SB key={g.value} label={g.label} active={gr===g.value} color={sm.color} onClick={()=>setGr(g.value)}/>)}</div>
              </div>
              <div>
                <Text size="1" weight="bold" color="gray" style={{textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:8}}>Período</Text>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  <div>
                    <Text size="1" color="gray" style={{display:'block',marginBottom:3}}>De</Text>
                    <input type="date" value={rangeStart} onChange={e=>setRangeStart(e.target.value)}
                      style={{width:'100%',background:'var(--gray-3)',border:'1px solid var(--gray-6)',borderRadius:6,padding:'4px 8px',fontSize:12,color:'var(--gray-12)',outline:'none'}}/>
                  </div>
                  <div>
                    <Text size="1" color="gray" style={{display:'block',marginBottom:3}}>Até</Text>
                    <input type="date" value={rangeEnd} onChange={e=>setRangeEnd(e.target.value)}
                      style={{width:'100%',background:'var(--gray-3)',border:'1px solid var(--gray-6)',borderRadius:6,padding:'4px 8px',fontSize:12,color:'var(--gray-12)',outline:'none'}}/>
                  </div>
                  {(rangeStart||rangeEnd)&&(
                    <button type="button" onClick={()=>{setRangeStart('');setRangeEnd('');}}
                      style={{fontSize:11,padding:'3px 8px',background:'none',border:'1px solid rgba(255,255,255,.12)',borderRadius:6,cursor:'pointer',color:'var(--gray-9)',textAlign:'center'}}>
                      × Limpar período
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div style={{flex:1,padding:'20px 16px',display:'flex',flexDirection:'column',justifyContent:'center'}}>
              {cdata.length===0?(
                <Flex direction="column" align="center" justify="center" style={{height:280,gap:8}}>
                  <BarChart2 size={36} color="var(--gray-6)"/>
                  <Text size="2" color="gray">Nenhum ticket com {dfl} preenchida.</Text>
                </Flex>
              ):(
                <>
                  <Text size="1" color="gray" mb="2" style={{display:'block'}}>{cdata.length} período(s) · {fN(cdata.reduce((s,d)=>s+d.count,0))} tickets com data</Text>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={cdata} margin={{top:8,right:16,left:0,bottom:cdata.length>12?40:16}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)"/>
                      <XAxis dataKey="label" tick={{fill:'var(--gray-9)',fontSize:11}} angle={cdata.length>8?-35:0} textAnchor={cdata.length>8?'end':'middle'} interval={0}/>
                      <YAxis tick={{fill:'var(--gray-9)',fontSize:11}} allowDecimals={false}/>
                      <RTooltip content={<Tip/>}/>
                      <Bar dataKey="count" fill={sm.color} radius={[4,4,0,0]} maxBarSize={48}/>
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
          </div>
        </Box>
      )}
      <Box>
        <Text size="1" weight="bold" color="gray" style={{textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:12}}>
          Indicadores de Saúde Operacional
        </Text>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:14}}>
          {indicators.map(ind=>(
            <div key={ind.key} style={{border:'1px solid rgba(255,255,255,.08)',borderRadius:14,background:'rgba(255,255,255,.02)',padding:16,display:'flex',flexDirection:'column',gap:8}}>
              <Flex align="center" justify="between">
                <Text size="2" color="gray" style={{textTransform:'uppercase',letterSpacing:'0.04em'}}>{ind.label}</Text>
                <span title={ind.rule} style={{cursor:'help',color:'var(--gray-8)',display:'flex'}}>
                  <Info size={15}/>
                </span>
              </Flex>
              {onDrillTickets&&ind.total>0?(
                <button type="button" onClick={()=>onDrillTickets(ind.tickets,'Observabilidade · '+ind.label)} style={{background:'none',border:'none',padding:0,cursor:'pointer',textAlign:'left'}}>
                  <Text size="8" weight="bold" style={{color:'#f87171',textDecoration:'underline dotted'}}>{fN(ind.total)}</Text>
                </button>
              ):(
                <Text size="8" weight="bold" style={{color:ind.total>0?'#f87171':'#4ade80'}}>{fN(ind.total)}</Text>
              )}
            </div>
          ))}
        </div>
        {indicators.every(i=>i.total===0)&&(
          <Text size="2" color="gray" mt="3">Nenhum indicador acusou pendências. Operação saudável.</Text>
        )}
      </Box>
    </Box>
  );
}
