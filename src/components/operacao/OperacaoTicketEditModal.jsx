import React, { useState, useEffect } from 'react';
import { Dialog, Flex, Box, Text, Badge, Card, Button, Select } from '@radix-ui/themes';
import { ExternalLink, Link2 } from 'lucide-react';
import { updateTicketRadarFields, PRIORIDADE_INTERNA_OPTIONS } from '../../services/operacaoRadarService';

const fmtDT = (v) => { if (!v) return '—'; const d = new Date(v); return isNaN(d) ? String(v) : d.toLocaleString('pt-BR'); };

const INPUT = { width:'100%', height:34, borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid var(--glass-border)', color:'var(--text)', padding:'0 10px', fontSize:13, boxSizing:'border-box' };
const TEXTAREA = { ...INPUT, height:'auto', minHeight:80, padding:'8px 10px', resize:'vertical', fontFamily:'inherit' };

const EC = { PROBLEMAS:'#f87171','DEMANDA FAST':'#fb923c',DEMANDA:'#facc15',INCIDENTE:'#4ade80',SOLICITACAO:'#22d3ee',CATALOGO:'#a78bfa' };

function FC({ label, children }) {
  return (
    <Card size="1" variant="surface">
      <Flex direction="column" gap="1">
        <Text size="1" color="gray" style={{ textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</Text>
        {children}
      </Flex>
    </Card>
  );
}
function RF({ label, value }) {
  return <FC label={label}><Text size="2" style={{ wordBreak:'break-word', lineHeight:1.5 }}>{value || '—'}</Text></FC>;
}

export default function OperacaoTicketEditModal({ open, onOpenChange, ticket, onSaved }) {
  const [tab, setTab] = useState('OPERAÇÃO');
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!ticket) return;
    setDraft({
      responsavelAtual: ticket.responsavelAtual || '',
      dataPrevisao: ticket.dataPrevisao ? String(ticket.dataPrevisao).slice(0,10) : '',
      observacaoAdicional: ticket.observacaoAdicional || '',
      estimativaMacro: ticket.estimativaMacro ?? '',
      prioridadeInterna: ticket.prioridadeInterna != null ? String(ticket.prioridadeInterna) : '',
      impedimento: ticket.impedimento === true,
    });
    setErr('');
    setTab('OPERAÇÃO');
  }, [ticket, open]);

  if (!ticket) return null;

  const ec = EC[String(ticket.escopo||'').toUpperCase()] || '#22d3ee';
  const prioMeta = PRIORIDADE_INTERNA_OPTIONS.find(p => p.value === Number(ticket.prioridadeInterna));
  const linked = [...new Set([...(ticket.linkedWorkItems||[]),...(ticket.linkedTicketKeys||[])])].filter(Boolean);
  const history = Array.isArray(ticket.statusHistory) ? ticket.statusHistory : [];
  const tabs = ['OPERAÇÃO','JIRA','DATAS','HISTÓRICO'];

  const save = async () => {
    setSaving(true); setErr('');
    try {
      const saved = await updateTicketRadarFields(ticket.issueKey, {
        responsavelAtual: draft.responsavelAtual || null,
        dataPrevisao: draft.dataPrevisao || null,
        observacaoAdicional: draft.observacaoAdicional || null,
        estimativaMacro: draft.estimativaMacro === '' ? null : Number(draft.estimativaMacro),
        prioridadeInterna: draft.prioridadeInterna === '' ? null : Number(draft.prioridadeInterna),
        impedimento: draft.impedimento,
      });
      onSaved?.(ticket.issueKey, saved);
      onOpenChange(false);
    } catch (e) { setErr(e?.message || 'Erro ao salvar.'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content style={{ maxWidth:520 }}
        onPointerDownOutside={e=>e.preventDefault()}
        onInteractOutside={e=>e.preventDefault()}
        onEscapeKeyDown={e=>e.preventDefault()}
      >
        <Dialog.Title>Detalhes do Ticket</Dialog.Title>

        {/* Header */}
        <Flex gap="4" align="start" mb="4" mt="1">
          <Box style={{ width:48, height:48, borderRadius:12, background:`${ec}22`, border:`2px solid ${ec}55`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Text style={{ fontSize:10, fontWeight:900, color:ec, textAlign:'center', lineHeight:1.2 }}>{String(ticket.escopo||'—').slice(0,3)}</Text>
          </Box>
          <Box style={{ flex:1, minWidth:0 }}>
            <Flex align="center" gap="2" wrap="wrap" mb="1">
              {ticket.issueUrl
                ? <a href={ticket.issueUrl} target="_blank" rel="noopener noreferrer" style={{ color:'#38bdf8', fontWeight:700, fontSize:16, display:'flex', alignItems:'center', gap:4, textDecoration:'none' }}>{ticket.issueKey}<ExternalLink size={12}/></a>
                : <Text weight="bold" size="4">{ticket.issueKey}</Text>
              }
              {ticket.escopo && <Badge size="1" style={{ background:`${ec}22`, color:ec, border:`1px solid ${ec}44` }}>{ticket.escopo}</Badge>}
              {ticket.issueType && <Badge color="gray" variant="soft" size="1">{ticket.issueType}</Badge>}
              {ticket.impedimento && <Badge color="yellow" variant="soft" size="1">🚧 Impedimento</Badge>}
              {prioMeta && <Badge size="1" style={{ background:`${prioMeta.color}22`, color:prioMeta.color, border:`1px solid ${prioMeta.color}44` }}>{prioMeta.label} — {prioMeta.description}</Badge>}
            </Flex>
            <Text as="div" size="2" color="gray" style={{ lineHeight:1.5, wordBreak:'break-word' }}>{ticket.summary||'—'}</Text>
            <Flex align="center" gap="2" mt="1" wrap="wrap">
              {ticket.status && <Text size="1" style={{ color:'var(--gray-11)', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:4, padding:'1px 7px' }}>{ticket.status}</Text>}
              {ticket.priority && <Text size="1" color="gray">{ticket.priority}</Text>}
              {ticket.agingDays != null && <Text size="1" color="gray">{ticket.agingDays}d aging</Text>}
            </Flex>
          </Box>
        </Flex>

        {/* Linked */}
        {linked.length > 0 && (
          <>
            <Text as="div" weight="bold" mb="2" size="2"><Flex align="center" gap="1"><Link2 size={13}/>Tickets vinculados</Flex></Text>
            <Flex direction="column" gap="2" mb="4">
              {linked.map(k => <Card key={k} size="1" variant="surface"><Text size="2" weight="bold" style={{ color:'#38bdf8' }}>{k}</Text></Card>)}
            </Flex>
          </>
        )}

        {/* Tabs */}
        <Flex gap="2" mb="3" wrap="wrap">
          {tabs.map(t => (
            <Button key={t} type="button" variant={tab===t?'solid':'soft'} size="1" onClick={()=>setTab(t)} style={{ cursor:'pointer' }}>
              {t}{t==='HISTÓRICO'&&history.length>0&&<Text as="span" size="1" style={{ marginLeft:4, opacity:0.7 }}>({history.length})</Text>}
            </Button>
          ))}
        </Flex>

        <Box mb="4" style={{ maxHeight:360, overflowY:'auto', paddingRight:2 }}>

          {tab==='OPERAÇÃO' && (
            <Flex direction="column" gap="2">
              <FC label="IMPEDIMENTO">
                <Flex align="center" gap="2">
                  <input type="checkbox" checked={draft.impedimento||false} onChange={e=>setDraft(p=>({...p,impedimento:e.target.checked}))} style={{ cursor:'pointer',width:16,height:16 }}/>
                  <Text size="2">{draft.impedimento?'Sim — ticket bloqueado':'Não'}</Text>
                </Flex>
              </FC>
              <FC label="PRIORIDADE INTERNA">
                <Select.Root value={draft.prioridadeInterna||''} onValueChange={v=>setDraft(p=>({...p,prioridadeInterna:v}))}>
                  <Select.Trigger style={{ width:'100%' }} placeholder="Selecione..."/>
                  <Select.Content>
                    <Select.Item value="">— Sem prioridade —</Select.Item>
                    {PRIORIDADE_INTERNA_OPTIONS.map(p=><Select.Item key={p.value} value={String(p.value)}>{p.label} — {p.description}</Select.Item>)}
                  </Select.Content>
                </Select.Root>
              </FC>
              <FC label="RESPONSÁVEL ATUAL"><input style={INPUT} value={draft.responsavelAtual||''} placeholder="Nome do responsável..." onChange={e=>setDraft(p=>({...p,responsavelAtual:e.target.value}))}/></FC>
              <FC label="DATA PREVISÃO (SGT)"><input type="date" style={INPUT} value={draft.dataPrevisao||''} onChange={e=>setDraft(p=>({...p,dataPrevisao:e.target.value}))}/></FC>
              <FC label="ESTIMATIVA MACRO (h)"><input type="number" style={INPUT} value={draft.estimativaMacro??''} placeholder="Ex: 40" min={0} onChange={e=>setDraft(p=>({...p,estimativaMacro:e.target.value}))}/></FC>
              <FC label="OBSERVAÇÃO ADICIONAL"><textarea style={TEXTAREA} value={draft.observacaoAdicional||''} placeholder="Observações internas..." onChange={e=>setDraft(p=>({...p,observacaoAdicional:e.target.value}))}/></FC>
            </Flex>
          )}

          {tab==='JIRA' && (
            <Flex direction="column" gap="2">
              <RF label="ISSUE KEY" value={ticket.issueKey}/>
              <RF label="SUMÁRIO" value={ticket.summary}/>
              <RF label="STATUS" value={ticket.status}/>
              <RF label="TIPO" value={ticket.issueType}/>
              <RF label="PRIORIDADE JIRA" value={ticket.priority}/>
              <RF label="ESCOPO" value={ticket.escopo}/>
              <RF label="GRUPO SUPORTE" value={ticket.grupoSuporte}/>
              <RF label="GRUPO SOLUCIONADOR" value={ticket.grupoSolucionador}/>
              <RF label="PARENT KEY" value={ticket.parentKey}/>
              <RF label="EPIC KEY" value={ticket.epicKey}/>
              <RF label="DEMANDA FAST" value={ticket.demandaFast}/>
              <RF label="ESTIMATIVA HORAS (JIRA)" value={ticket.estimativaHoras!=null?String(ticket.estimativaHoras):null}/>
              <RF label="REABERTURAS" value={ticket.reopenCount!=null?String(ticket.reopenCount):null}/>
              <RF label="CRIADO EM" value={fmtDT(ticket.createdAt)}/>
              <RF label="ATUALIZADO EM" value={fmtDT(ticket.updatedAt)}/>
              <RF label="RESOLVIDO EM" value={fmtDT(ticket.resolvedAt)}/>
            </Flex>
          )}

          {tab==='DATAS' && (
            <Flex direction="column" gap="2">
              <RF label="APROVAÇÃO EFSR" value={fmtDT(ticket.dataAprovacaoEfsr)}/>
              <RF label="INÍCIO ATEND. PLANEJADO" value={fmtDT(ticket.dataInicioAtendimentoPlanejada)}/>
              <RF label="INÍCIO ATENDIMENTO" value={fmtDT(ticket.dataInicioAtendimento)}/>
              <RF label="APROVAÇÃO QA PLANEJADA" value={fmtDT(ticket.dataAprovacaoQaPlanejada)}/>
              <RF label="INÍCIO HOMOLOG. PLANEJADO" value={fmtDT(ticket.dataInicioHomologacaoPlanejada)}/>
              <RF label="INÍCIO HOMOLOG. EFETIVO" value={fmtDT(ticket.dataInicioHomologacaoEfetiva)}/>
              <RF label="FIM HOMOLOG. PLANEJADO" value={fmtDT(ticket.dataFimHomologacaoPlanejada)}/>
              <RF label="FIM HOMOLOG. EFETIVO" value={fmtDT(ticket.dataFimHomologacaoEfetiva)}/>
              <RF label="ENTREGA PRODUÇÃO PREVISTA" value={fmtDT(ticket.dataEntregaProducaoPrevista)}/>
              <RF label="FIM PLANEJADO" value={fmtDT(ticket.dataFimPlanejado)}/>
              <RF label="PREVISÃO SGT" value={draft.dataPrevisao||ticket.dataPrevisao||null}/>
            </Flex>
          )}

          {tab==='HISTÓRICO' && (
            <Flex direction="column" gap="2">
              {history.length === 0
                ? <Text color="gray" size="2">Sem histórico de status registrado.</Text>
                : history.map((h, i) => (
                  <Card key={i} size="1" variant="surface">
                    <Flex justify="between" align="center" wrap="wrap" gap="1">
                      <Text size="2" weight="bold">{h.status || h.to || '—'}</Text>
                      <Text size="1" color="gray">{fmtDT(h.date || h.changedAt || h.timestamp)}</Text>
                    </Flex>
                    {(h.from||h.fromStatus) && <Text size="1" color="gray">De: {h.from||h.fromStatus}</Text>}
                    {h.author && <Text size="1" color="gray">Por: {h.author}</Text>}
                  </Card>
                ))}
            </Flex>
          )}

        </Box>

        {err && <Text color="red" size="2" mb="2">{err}</Text>}

        <Flex justify="end" mt="4" gap="2">
          <Button variant="soft" color="gray" onClick={() => { setDraft({ responsavelAtual: ticket.responsavelAtual||'', dataPrevisao: ticket.dataPrevisao ? String(ticket.dataPrevisao).slice(0,10) : '', observacaoAdicional: ticket.observacaoAdicional||'', estimativaMacro: ticket.estimativaMacro??'', prioridadeInterna: ticket.prioridadeInterna!=null?String(ticket.prioridadeInterna):'', impedimento: ticket.impedimento===true }); }}>
            Cancelar
          </Button>
          <Button variant="solid" onClick={save} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
          <Button variant="soft" color="gray" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </Flex>

      </Dialog.Content>
    </Dialog.Root>
  );
}
