import React, { useState, useEffect, useRef } from 'react';
import { Dialog, Avatar, Text } from '@radix-ui/themes';
import { Camera, Sun, Moon } from 'lucide-react';
import { storage, db } from '../firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { updateUser } from '../services/settingsService';
import { subscribeToProjectSquads } from '../services/squadService';
import { userHasFunctionPermission } from '../services/permissionService';
import { PermissionFunctionKeys } from '../services/permissionKeys';
import { SELECT_OPTIONS_BY_KEY } from '../utils/userFieldOptions';
import {
  S, TABS, FIELDS,
  isDateF, toInputDate, persistVal, maskPhone,
  CustomSelect, HardSkillsInput, JornadaTab,
} from './UserDetailsModalParts';

const isSelF = k => Object.prototype.hasOwnProperty.call(SELECT_OPTIONS_BY_KEY, k) || k === 'projectCode';

/* ── FieldInput ── */
function FieldInput({ fieldKey, label, value, onChange, readOnly, optionOverrides }) {
  const isDate = isDateF(fieldKey);
  const isSel  = isSelF(fieldKey);
  const isPhone = fieldKey === "contato";
  const displayVal = isDate ? toInputDate(value) : (value ?? "");

  if (readOnly) {
    return (
      <div>
        <span style={S.lbl}>{label}</span>
        <div style={S.inpR}>{isDate ? toInputDate(value) : (value || "—")}</div>
      </div>
    );
  }
  if (isSel) {
    const override = optionOverrides?.[fieldKey];
    const rawOpts = override ?? (SELECT_OPTIONS_BY_KEY[fieldKey] || []);
    const opts = rawOpts.map(o => typeof o === "string" ? { value:o, label:o } : o);
    return (
      <div>
        <span style={S.lbl}>{label}</span>
        <CustomSelect value={value ?? ""} onChange={v => onChange(fieldKey, v)} options={opts} />
      </div>
    );
  }
  return (
    <div>
      <span style={S.lbl}>{label}</span>
      <input
        type={isDate ? "date" : "text"}
        value={displayVal}
        onChange={e => {
          let v = e.target.value;
          if (isPhone) v = maskPhone(v);
          onChange(fieldKey, v);
        }}
        style={S.inp}
      />
    </div>
  );
}

/* ── FieldRow ── */
function FieldRow({ rowDef, draftUser, onChange, readOnly, optionOverrides }) {
  if (Array.isArray(rowDef) && typeof rowDef[0] === "string") {
    const [key, label] = rowDef;
    return <FieldInput fieldKey={key} label={label} value={draftUser?.[key] ?? ""} onChange={onChange} readOnly={readOnly} optionOverrides={optionOverrides}/>;
  }
  const { row, cols } = rowDef;
  return (
    <div style={{ display:"grid", gridTemplateColumns: cols || `repeat(${row.length},1fr)`, gap:12 }}>
      {row.map(([key, label]) => (
        <FieldInput key={key} fieldKey={key} label={label} value={draftUser?.[key] ?? ""} onChange={onChange} readOnly={readOnly} optionOverrides={optionOverrides}/>
      ))}
    </div>
  );
}

/* ── AvatarUploader ── */
function AvatarUploader({ draftUser, setDraftUser, userId, readOnly }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async e => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploading(true);
    try {
      const r = storageRef(storage, `avatars/${userId}`);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      setDraftUser(prev => ({ ...prev, photoURL: url }));
    } catch (err) { console.error(err); }
    finally { setUploading(false); }
  };

  return (
    <div style={{ position:"relative", width:80, height:80, flexShrink:0 }}>
      <Avatar
        src={draftUser?.photoURL}
        fallback={draftUser?.displayName?.[0]?.toUpperCase() || "?"}
        radius="full"
        size="6"
        style={{ width:80, height:80, border:"2px solid var(--indigo-6)" }}
      />
      {!readOnly && (
        <>
          <button type="button" onClick={() => fileRef.current?.click()} style={{
            position:"absolute", bottom:0, right:0, width:26, height:26,
            borderRadius:"50%", background:"var(--indigo-9)", border:"2px solid var(--panel-bg,#111)",
            display:"flex", alignItems:"center", justifyContent:"center",
            cursor:"pointer", color:"white",
          }}>
            {uploading ? "…" : <Camera size={13}/>}
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleFile}/>
        </>
      )}
    </div>
  );
}

/* ── Main Modal ── */
export default function UserDetailsModal({ open, onOpenChange, user, currentUser, theme, toggleTheme }) {
  const [draftUser, setDraftUser]   = useState(null);
  const [activeTab, setActiveTab]   = useState(TABS[0]);
  const [saving, setSaving]         = useState(false);
  const [squads, setSquads]         = useState([]);
  const [userSquads, setUserSquads] = useState([]);
  const [errorMsg, setErrorMsg]     = useState("");
  const [memberChangeLog, setMemberChangeLog] = useState([]);
  const [changeLogOpen, setChangeLogOpen] = useState(false);
  const [projectCodes, setProjectCodes] = useState([]);

  const canEdit = userHasFunctionPermission(currentUser, PermissionFunctionKeys.EDIT_TEAM_MEMBER);

  useEffect(() => {
    if (open && user) {
      setDraftUser({ ...user });
      setActiveTab(TABS[0]);
    }
  }, [open, user]);

  useEffect(() => {
    // collectionGroup requer regra específica; iteramos os projetos diretamente
    getDocs(collection(db, 'projects'))
      .then(async projectsSnap => {
        const codeSet = new Set();
        await Promise.all(
          projectsSnap.docs.map(pd =>
            getDocs(collection(db, 'projects', pd.id, 'codigosProjeto'))
              .then(snap => snap.docs.forEach(d => { const v = d.data().projeto; if (v) codeSet.add(v); }))
              .catch(() => {})
          )
        );
        setProjectCodes([...codeSet].sort((a, b) => a.localeCompare(b, 'pt-BR')));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const q = query(collection(db, 'users', user.id, 'changeLog'), orderBy('changedAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setMemberChangeLog(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return unsub;
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) { setUserSquads([]); return; }
    const uid = user.id;
    const unsub = onSnapshot(
      query(collection(db, 'squads')),
      (snap) => {
        const matched = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(s => {
            const members = Array.isArray(s.users) ? s.users : [];
            return members.some(m => {
              if (!m) return false;
              if (typeof m === 'string') return m === uid;
              return m?.id === uid;
            });
          });
        setUserSquads(matched);
      },
      () => {}
    );
    return () => unsub();
  }, [user?.id]);

  const handleChange = (key, value) => {
    setDraftUser(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const userId = draftUser?.id;
    if (!userId) {
      setErrorMsg("Erro: Usuário não identificado");
      return;
    }
    setSaving(true);
    setErrorMsg("");
    try {
      const payload = {};
      for (const [k, v] of Object.entries(draftUser)) {
        if (k === "uid" || k === "id") continue;
        payload[k] = persistVal(k, v);
      }
      await updateUser(userId, payload);
      // Log de alterações campo a campo
      const changedBy = user?.displayName || user?.email || 'Sistema';
      const LABEL = {
        displayName:'Nome de Exibição', email:'E-mail', phone:'Telefone', contato:'Contato',
        role:'Cargo', bio:'Bio', status:'Status', foundation:'Foundation', uf:'UF',
        contract:'Contrato', seniority:'Senioridade', ratecardSeniority:'Senioridade Ratecard',
        ratecardProfile:'Perfil Ratecard', project:'Projeto', allocation:'Alocação (%)',
        monthlyHours:'Horas Mensais', observation:'Observação', photoURL:'Foto',
        hardSkills:'Hard Skills', shortName:'Nome Curto', name:'Nome',
        dataNascimento:'Data de Nascimento', dataInicio:'Data de Início',
        dataDesligamento:'Data de Desligamento', city:'Cidade',
      };
      // Normaliza valor para comparação — campos de data usam toInputDate para converter Timestamps
      const normalizeVal = (k, val) => {
        if (val == null) return '';
        if (isDateF(k)) return toInputDate(val) || '';
        if (Array.isArray(val)) return val.join(', ');
        return String(val);
      };
      const logRef = collection(db, 'users', userId, 'changeLog');
      for (const [k, v] of Object.entries(payload)) {
        const orig = user?.[k];
        const stringOrig = normalizeVal(k, orig);
        const stringNew  = normalizeVal(k, v);
        if (stringOrig !== stringNew) {
          await addDoc(logRef, {
            field: k,
            fieldLabel: LABEL[k] || k,
            oldValue: stringOrig || null,
            newValue: stringNew  || null,
            changedBy,
            changedAt: serverTimestamp(),
          });
        }
      }
      onOpenChange(false);
    } catch (err) {
      console.error("Erro ao salvar usuário:", err);
      setErrorMsg(`Erro ao salvar: ${err?.message || "Tente novamente"}`);
    } finally {
      setSaving(false);
    }
  };

  const readOnly = !canEdit;
  const fields   = FIELDS[activeTab] || [];

  if (!draftUser) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content style={{
        maxWidth:920, width:"96vw", maxHeight:"90vh",
        background:"var(--color-panel-solid)", borderRadius:16,
        border:"1px solid var(--gray-5)",
        padding:0, overflow:"hidden", display:"flex", flexDirection:"column",
      }}>
        {/* Header */}
        <div style={{
          display:"flex", alignItems:"center", gap:18,
          padding:"20px 24px 16px", borderBottom:"1px solid var(--gray-5)",
          background:"var(--gray-1)", flexShrink:0,
        }}>
          <AvatarUploader draftUser={draftUser} setDraftUser={setDraftUser} userId={draftUser.id || draftUser.uid} readOnly={readOnly}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:4 }}>
              <Text size="5" weight="bold" style={{ lineHeight:1.2 }}>
                {draftUser.displayName || "—"}
              </Text>
              {userSquads.map(s => {
                const memberEntry = Array.isArray(s.users)
                  ? s.users.find(m => (typeof m === 'string' ? m : m?.id) === (user?.id))
                  : null;
                const escopo = memberEntry?.escopoPrincipal || '';
                return (
                  <div key={s.id} style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", gap:2 }}>
                    <span style={{
                      fontSize:11, fontWeight:700, padding:"2px 9px", borderRadius:999,
                      background:"var(--cyan-3)", border:"1px solid var(--cyan-7)", color:"var(--cyan-11)",
                      letterSpacing:"0.04em", whiteSpace:"nowrap",
                    }}>{s.name.toUpperCase()}</span>
                    {escopo && (
                      <span style={{
                        fontSize:10, fontWeight:600, color:"var(--indigo-11)",
                        background:"var(--indigo-2)", border:"1px solid var(--indigo-5)",
                        borderRadius:4, padding:"1px 6px", letterSpacing:"0.03em", whiteSpace:"nowrap",
                      }}>{escopo}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <Text size="2" style={{ color:"var(--gray-9)" }}>{draftUser.email || ""}</Text>
          </div>
          <Dialog.Close asChild>
            <button style={{ background:"none", border:"none", cursor:"pointer", color:"var(--gray-9)", fontSize:20, lineHeight:1, padding:4 }}>×</button>
          </Dialog.Close>
        </div>

        {/* Tabs */}
        <div style={{
          display:"flex", gap:0, borderBottom:"1px solid var(--gray-5)",
          overflowX:"auto", flexShrink:0, background:"var(--gray-2)",
        }}>
          {TABS.map(tab => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} style={{
              padding:"10px 18px", fontSize:11, fontWeight:700, letterSpacing:"0.06em",
              border:"none", borderBottom: activeTab===tab ? "2px solid var(--indigo-9)" : "2px solid transparent",
              background:"transparent", color: activeTab===tab ? "var(--indigo-11)" : "var(--gray-10)",
              cursor:"pointer", whiteSpace:"nowrap", transition:"color 0.15s",
            }}>{tab}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>
          {activeTab === "CONTROLE DE JORNADA" ? (
            <JornadaTab draftUser={draftUser} setDraftUser={setDraftUser} readOnly={readOnly}/>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {fields.map((fDef, i) => (
                <FieldRow key={i} rowDef={fDef} draftUser={draftUser} onChange={handleChange} readOnly={readOnly} optionOverrides={{ projectCode: projectCodes }}/>
              ))}
              {activeTab === "DADOS PESSOAIS" && (
                <div>
                  <span style={S.lbl}>HARD SKILLS</span>
                  <HardSkillsInput
                    value={draftUser.hardSkills || []}
                    onChange={v => handleChange("hardSkills", v)}
                    readOnly={readOnly}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Histórico de Alterações */}
        {memberChangeLog.length > 0 && (
          <div style={{ marginTop: 24, borderTop: '1px solid var(--gray-5)', paddingTop: 14 }}>
            <button
              type="button"
              onClick={() => setChangeLogOpen(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '4px 0', color: 'var(--gray-10)', fontSize: 12, fontWeight: 700,
                letterSpacing: '0.05em', textTransform: 'uppercase', width: '100%',
              }}
            >
              <span style={{ fontSize: 14 }}>🕓</span>
              HISTÓRICO DE ALTERAÇÕES
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                background: 'rgba(99,102,241,0.2)', color: '#a5b4fc',
                border: '1px solid rgba(99,102,241,0.35)',
              }}>{memberChangeLog.length}</span>
              <span style={{ marginLeft: 'auto', fontSize: 13, transform: changeLogOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
            </button>
            {changeLogOpen && (
              <div style={{ marginTop: 10, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: 'var(--gray-9)', textAlign: 'left' }}>
                      {['Campo', 'De', 'Para', 'Por', 'Quando'].map(h => (
                        <th key={h} style={{ padding: '4px 8px', fontWeight: 700, borderBottom: '1px solid var(--gray-5)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {memberChangeLog.map(entry => {
                      const d = entry.changedAt?.toDate ? entry.changedAt.toDate() : null;
                      const when = d ? d.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
                      return (
                        <tr key={entry.id} style={{ borderBottom: '1px solid var(--gray-4)' }}>
                          <td style={{ padding: '5px 8px', color: 'var(--gray-11)', fontWeight: 600 }}>{entry.fieldLabel || entry.field}</td>
                          <td style={{ padding: '5px 8px', color: '#f87171' }}>{entry.oldValue || '—'}</td>
                          <td style={{ padding: '5px 8px', color: '#4ade80' }}>{entry.newValue || '—'}</td>
                          <td style={{ padding: '5px 8px', color: 'var(--gray-10)' }}>{entry.changedBy || '—'}</td>
                          <td style={{ padding: '5px 8px', color: 'var(--gray-9)' }}>{when}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Theme toggle — always visible */}
        {typeof toggleTheme === 'function' && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 24px', borderTop: '1px solid var(--gray-5)',
            background: 'var(--gray-2)', flexShrink: 0,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--gray-9)', textTransform: 'uppercase' }}>
              Tema da Interface
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 14px', borderRadius: 20,
                border: '1px solid var(--gray-6)',
                background: 'var(--gray-3)',
                color: 'var(--gray-12)',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
                transition: 'all 0.2s',
              }}
            >
              {theme === 'dark'
                ? <><Sun size={14} />&nbsp;Mudar para Claro</>
                : <><Moon size={14} />&nbsp;Mudar para Escuro</>
              }
            </button>
          </div>
        )}

        {/* Footer */}
        {!readOnly && (
          <div style={{
            display:"flex", justifyContent:"space-between", alignItems:"center", gap:10,
            padding:"14px 24px", borderTop:"1px solid var(--gray-5)",
            background:"var(--gray-2)", flexShrink:0,
          }}>
            <div style={{ flex:1, minWidth:0 }}>
              {errorMsg && (
                <Text size="2" style={{ color:"var(--red-10)" }}>
                  {errorMsg}
                </Text>
              )}
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
              <Dialog.Close asChild>
                <button style={{ padding:"8px 20px", borderRadius:8, border:"1px solid var(--gray-6)", background:"transparent", color:"var(--gray-12)", cursor:"pointer", fontSize:13 }}>
                  Cancelar
                </button>
              </Dialog.Close>
              <button type="button" onClick={handleSave} disabled={saving} style={{
                padding:"8px 24px", borderRadius:8, border:"none",
                background:"var(--indigo-9)", color:"white", cursor:saving?"wait":"pointer",
                fontSize:13, fontWeight:600, opacity:saving?0.7:1,
              }}>
                {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
}
