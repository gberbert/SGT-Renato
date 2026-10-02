import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Text } from '@radix-ui/themes';
import { Plus, Trash2, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';

export const S = {
  inp:  { width:"100%",height:34,borderRadius:8,background:"#232336",border:"1px solid rgba(255,255,255,0.12)",color:"var(--text)",padding:"0 10px",fontSize:13,boxSizing:"border-box" },
  inpR: { width:"100%",height:34,borderRadius:8,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",color:"var(--text)",padding:"0 10px",fontSize:13,boxSizing:"border-box",opacity:0.8 },
  lbl:  { fontSize:10,fontWeight:700,color:"var(--gray-9)",letterSpacing:"0.07em",textTransform:"uppercase",display:"block",marginBottom:3 },
};

export const TABS = ["DADOS PESSOAIS","CONTRATAÇÃO","RATECARD","DADOS CLIENTE","CONTROLE DE JORNADA","SISTEMA"];
export const FIELDS = {
  "DADOS PESSOAIS":[
    {row:[["status","STATUS"],["sapId","SAP"]],cols:"160px 1fr"},
    ["displayName","NOME"],
    {row:[["shortName","NOME RESUMIDO"],["email","EMAIL"],["contato","CONTATO"]],cols:"1fr 1fr 1fr"},
    {row:[["cidade","CIDADE"],["uf","UF"],["dataNascimento","NASCIMENTO"]],cols:"1fr 80px 1fr"},
  ],
  "CONTRATAÇÃO":[["dataInicio","INÍCIO NTT"],["contract","CONTRATO"],["foundation","FOUNDATION"],["perfilNTT","CARGO"],["seniority","SENIORIDADE"],["csr","CSR"]],
  "RATECARD":[["perfilRatecard","PERFIL RATECARD"],["rcSeniority","SENIORIDADE RATECARD"],["rc","RATE CARD"]],
  "DADOS CLIENTE":[["clienteId","ID CLIENTE"],["clienteEmail","EMAIL CLIENTE"]],
  "CONTROLE DE JORNADA":[],
  "SISTEMA":[["role","PERFIL ACESSO"]],
};
export const JOURNEY_TIPOS = ["Férias","Folga","Atestado","Hora Extra"];
export const TIPO_CLR = {
  "Férias":    ["--green-7","--green-10","--green-2"],
  "Folga":     ["--cyan-7","--cyan-10","--cyan-2"],
  "Atestado":  ["--amber-7","--amber-10","--amber-2"],
  "Hora Extra":["--violet-7","--violet-10","--violet-2"],
};

/* ── helpers ── */
export const isDateF = k => ["dataNascimento","dataInicio"].includes(k);
export const toInputDate = v => {
  try {
    if (!v) return "";
    if (v?.toDate) return v.toDate().toISOString().slice(0,10);
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0,10);
  } catch { return ""; }
};
export const fromInputDate = v => {
  if (!v) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
};
export const persistVal = (key, value) => {
  if (isDateF(key)) {
    if (typeof value === "string") return fromInputDate(value);
    if (!value) return null;
    if (value?.toDate) return value.toDate();
    if (value instanceof Date) return value;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return value ?? null;
};
export const calcDays = (s,e) => {
  if (!s||!e) return 0;
  const sd=new Date(s), ed=new Date(e);
  if (isNaN(sd.getTime())||isNaN(ed.getTime())||ed<sd) return 0;
  return Math.ceil((ed-sd)/86400000)+1;
};
export const maskPhone = v => {
  if (!v) return v;
  const n = v.replace(/\D/g,"");
  if (n.length<=2)  return `(${n}`;
  if (n.length<=6)  return `(${n.slice(0,2)}) ${n.slice(2)}`;
  if (n.length<=10) return `(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`;
  return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7,11)}`;
};

/* ── CustomSelect ── */
export function CustomSelect({ value, onChange, options=[], placeholder, disabled }) {
  const [open,setOpen] = useState(false);
  const cRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = e => { if (cRef.current && !cRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const sel = options.find(o => (o.value ?? o) === value);
  const label = sel ? (sel.label ?? sel) : (value || placeholder || "—");
  return (
    <div ref={cRef} style={{ position:"relative", width:"100%" }}>
      <button type="button" onClick={() => { if (!disabled) setOpen(v => !v); }} style={{
        width:"100%", height:34, borderRadius:8,
        background: disabled ? "rgba(255,255,255,0.03)" : "#232336",
        border:"1px solid rgba(255,255,255,0.12)",
        color: value ? "var(--text)" : "var(--gray-7)",
        padding:"0 10px", fontSize:13,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.7 : 1, boxSizing:"border-box",
      }}>
        <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{label}</span>
        <ChevronDown size={13} style={{ color:"var(--gray-9)", flexShrink:0, marginLeft:6 }}/>
      </button>
      {open && !disabled && (
        <div style={{
          position:"absolute", top:"calc(100% + 4px)", left:0, right:0, zIndex:9999,
          background:"#1a1a2e", border:"1px solid rgba(255,255,255,0.15)", borderRadius:8,
          boxShadow:"0 8px 32px rgba(0,0,0,0.6)", maxHeight:220, overflowY:"auto",
        }}>
          <div onClick={() => { onChange(""); setOpen(false); }} style={{
            padding:"9px 14px", fontSize:13, color:"var(--gray-7)", cursor:"pointer",
            borderBottom:"1px solid rgba(255,255,255,0.06)",
          }}>— Nenhuma</div>
          {options.map(o => {
            const v = o.value ?? o;
            const l = o.label ?? o;
            const isSel = v === value;
            return (
              <div key={v} onClick={() => { onChange(v); setOpen(false); }} style={{
                padding:"9px 14px", fontSize:13, cursor:"pointer",
                color: isSel ? "var(--indigo-11)" : "var(--text)",
                background: isSel ? "rgba(99,102,241,0.12)" : "transparent",
              }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background="rgba(255,255,255,0.06)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = isSel ? "rgba(99,102,241,0.12)" : "transparent"; }}
              >{l}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── HardSkillsInput ── */
export function HardSkillsInput({ value=[], onChange, readOnly }) {
  const [iv, setIv] = useState("");
  const add = () => { const v=iv.trim(); if (!v) return; onChange([...value, v]); setIv(""); };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      <div style={{
        display:"flex", flexWrap:"wrap", gap:5, minHeight:36, padding:"4px 6px",
        borderRadius:8, background: readOnly ? "rgba(255,255,255,0.03)" : "#232336",
        border:"1px solid rgba(255,255,255,0.12)",
      }}>
        {value.length === 0 && <span style={{ fontSize:11, color:"var(--gray-7)", alignSelf:"center" }}>Nenhuma skill</span>}
        {value.map((sk, i) => (
          <span key={i} style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:999, background:"var(--indigo-3)", border:"1px solid var(--indigo-6)", color:"var(--indigo-11)" }}>
            {sk}
            {!readOnly && <button type="button" onClick={() => onChange(value.filter((_,j)=>j!==i))} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--indigo-9)", padding:0, lineHeight:1, fontSize:13 }}>×</button>}
          </span>
        ))}
      </div>
      {!readOnly && (
        <div style={{ display:"flex", gap:6 }}>
          <input value={iv} onChange={e=>setIv(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter"){e.preventDefault();add();} }}
            placeholder="Nova skill... (Enter)" style={{ ...S.inp, flex:1 }}/>
          <button type="button" onClick={add} style={{ padding:"0 12px", borderRadius:8, background:"var(--indigo-9)", color:"white", border:"none", cursor:"pointer" }}><Plus size={14}/></button>
        </div>
      )}
    </div>
  );
}

/* ── JornadaTab ── */
export function JornadaTab({ draftUser, setDraftUser, readOnly }) {
  const periods = draftUser?.journeyPeriods || [];
  const [showForm, setShowForm] = useState(false);
  const [np, setNp] = useState({ tipo:"Férias", dataInicio:"", dataFim:"" });
  const setPeriods = useCallback(fn => setDraftUser(prev => ({
    ...prev, journeyPeriods: typeof fn==="function" ? fn(prev?.journeyPeriods||[]) : fn,
  })), [setDraftUser]);
  const addPeriod = () => {
    if (!np.dataInicio || !np.dataFim) return;
    setPeriods(prev => [...prev, { ...np, id: Date.now().toString() }]);
    setNp({ tipo:"Férias", dataInicio:"", dataFim:"" });
    setShowForm(false);
  };
  const total = periods.reduce((a,p) => a + calcDays(p.dataInicio, p.dataFim), 0);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <CalendarDays size={16} style={{ color:"var(--indigo-9)" }}/>
          <Text size="2" weight="bold">Períodos de Jornada</Text>
          <span style={{ fontSize:13, fontWeight:700, padding:"3px 14px", borderRadius:999, background:"var(--indigo-3)", border:"1px solid var(--indigo-6)", color:"var(--indigo-11)" }}>
            {total} dia{total !== 1 ? "s" : ""}
          </span>
        </div>
        {!readOnly && (
          <button type="button" onClick={() => setShowForm(v => !v)} style={{
            display:"flex", alignItems:"center", gap:5, padding:"5px 12px",
            borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer",
            background:"var(--indigo-3)", border:"1px solid var(--indigo-6)", color:"var(--indigo-11)",
          }}>
            <Plus size={13}/> Incluir {showForm ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
          </button>
        )}
      </div>

      {showForm && !readOnly && (
        <div style={{ padding:"14px 16px", borderRadius:10, background:"rgba(99,102,241,0.06)", border:"1px solid var(--indigo-6)" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:10, alignItems:"end" }}>
            <div>
              <span style={S.lbl}>TIPO</span>
              <CustomSelect value={np.tipo} onChange={v => setNp(p=>({...p,tipo:v||"Férias"}))} options={JOURNEY_TIPOS.map(t=>({value:t,label:t}))}/>
            </div>
            <div>
              <span style={S.lbl}>INÍCIO</span>
              <input type="date" value={np.dataInicio} onChange={e=>setNp(p=>({...p,dataInicio:e.target.value}))} style={S.inp}/>
            </div>
            <div>
              <span style={S.lbl}>FIM</span>
              <input type="date" value={np.dataFim} onChange={e=>setNp(p=>({...p,dataFim:e.target.value}))} style={S.inp}/>
            </div>
            <button type="button" onClick={addPeriod} style={{
              height:34, padding:"0 14px", borderRadius:8,
              background:"var(--indigo-9)", color:"white", border:"none", cursor:"pointer", fontSize:12, fontWeight:600,
            }}>Adicionar</button>
          </div>
        </div>
      )}

      {periods.length === 0 && (
        <div style={{ textAlign:"center", padding:"24px", color:"var(--gray-7)", fontSize:13 }}>
          Nenhum período registrado.
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {periods.map((p, idx) => {
          const [border, text, bg] = (TIPO_CLR[p.tipo] || TIPO_CLR["Férias"]).map(v => `var(${v})`);
          const days = calcDays(p.dataInicio, p.dataFim);
          return (
            <div key={p.id || idx} style={{
              display:"flex", alignItems:"center", gap:12, padding:"10px 14px",
              borderRadius:8, background: bg, border:`1px solid ${border}`,
            }}>
              <span style={{ fontSize:12, fontWeight:700, color: text, minWidth:80 }}>{p.tipo}</span>
              <span style={{ fontSize:12, color:"var(--text)", flex:1 }}>
                {p.dataInicio} → {p.dataFim}
              </span>
              <span style={{ fontSize:12, fontWeight:600, color: text }}>
                {days} dia{days !== 1 ? "s" : ""}
              </span>
              {!readOnly && (
                <button type="button" onClick={() => setPeriods(prev => prev.filter((_,i)=>i!==idx))}
                  style={{ background:"none", border:"none", cursor:"pointer", color:"var(--red-9)", padding:2 }}>
                  <Trash2 size={14}/>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
