import React, { useState, useEffect, useRef } from 'react';
import { Dialog, Avatar, Text } from '@radix-ui/themes';
import { Camera } from 'lucide-react';
import { storage } from '../firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
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

const isSelF = k => Object.prototype.hasOwnProperty.call(SELECT_OPTIONS_BY_KEY, k);

/* ── FieldInput ── */
function FieldInput({ fieldKey, label, value, onChange, readOnly }) {
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
    const opts = (SELECT_OPTIONS_BY_KEY[fieldKey] || []).map(o =>
      typeof o === "string" ? { value:o, label:o } : o
    );
    return (
      <div>
        <span style={S.lbl}>{label}</span>
        <CustomSelect value={value ?? ""} onChange={v => onChange(fieldKey, v)} options={opts}/>
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
function FieldRow({ rowDef, draftUser, onChange, readOnly }) {
  if (Array.isArray(rowDef) && typeof rowDef[0] === "string") {
    const [key, label] = rowDef;
    return <FieldInput fieldKey={key} label={label} value={draftUser?.[key] ?? ""} onChange={onChange} readOnly={readOnly}/>;
  }
  const { row, cols } = rowDef;
  return (
    <div style={{ display:"grid", gridTemplateColumns: cols || `repeat(${row.length},1fr)`, gap:12 }}>
      {row.map(([key, label]) => (
        <FieldInput key={key} fieldKey={key} label={label} value={draftUser?.[key] ?? ""} onChange={onChange} readOnly={readOnly}/>
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
export default function UserDetailsModal({ open, onOpenChange, user, currentUser }) {
  const [draftUser, setDraftUser]   = useState(null);
  const [activeTab, setActiveTab]   = useState(TABS[0]);
  const [saving, setSaving]         = useState(false);
  const [squads, setSquads]         = useState([]);
  const [userSquads, setUserSquads] = useState([]);
  const [errorMsg, setErrorMsg]     = useState("");

  const canEdit = userHasFunctionPermission(currentUser, PermissionFunctionKeys.EDIT_TEAM_MEMBER);

  useEffect(() => {
    if (open && user) {
      setDraftUser({ ...user });
      setActiveTab(TABS[0]);
    }
  }, [open, user]);

  useEffect(() => {
    const unsub = subscribeToProjectSquads('all', all => {
      setSquads(all);
      if (user?.id) setUserSquads(all.filter(s => (s.members||[]).includes(user.id)));
    });
    return () => typeof unsub === "function" && unsub();
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
        background:"var(--panel-bg,#16162a)", borderRadius:16,
        border:"1px solid rgba(255,255,255,0.08)",
        padding:0, overflow:"hidden", display:"flex", flexDirection:"column",
      }}>
        {/* Header */}
        <div style={{
          display:"flex", alignItems:"center", gap:18,
          padding:"20px 24px 16px", borderBottom:"1px solid rgba(255,255,255,0.08)",
          background:"rgba(255,255,255,0.02)", flexShrink:0,
        }}>
          <AvatarUploader draftUser={draftUser} setDraftUser={setDraftUser} userId={draftUser.id || draftUser.uid} readOnly={readOnly}/>
          <div style={{ flex:1, minWidth:0 }}>
            <Text size="5" weight="bold" style={{ display:"block", marginBottom:2 }}>
              {draftUser.displayName || "—"}
            </Text>
            <Text size="2" style={{ color:"var(--gray-9)" }}>{draftUser.email || ""}</Text>
            {userSquads.length > 0 && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginTop:6 }}>
                {userSquads.map(s => (
                  <span key={s.id} style={{
                    fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:999,
                    background:"var(--indigo-3)", border:"1px solid var(--indigo-6)", color:"var(--indigo-11)",
                  }}>{s.name}</span>
                ))}
              </div>
            )}
          </div>
          <Dialog.Close asChild>
            <button style={{ background:"none", border:"none", cursor:"pointer", color:"var(--gray-9)", fontSize:20, lineHeight:1, padding:4 }}>×</button>
          </Dialog.Close>
        </div>

        {/* Tabs */}
        <div style={{
          display:"flex", gap:0, borderBottom:"1px solid rgba(255,255,255,0.08)",
          overflowX:"auto", flexShrink:0, background:"rgba(0,0,0,0.15)",
        }}>
          {TABS.map(tab => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} style={{
              padding:"10px 18px", fontSize:11, fontWeight:700, letterSpacing:"0.06em",
              border:"none", borderBottom: activeTab===tab ? "2px solid var(--indigo-9)" : "2px solid transparent",
              background:"transparent", color: activeTab===tab ? "var(--indigo-11)" : "var(--gray-9)",
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
                <FieldRow key={i} rowDef={fDef} draftUser={draftUser} onChange={handleChange} readOnly={readOnly}/>
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

        {/* Footer */}
        {!readOnly && (
          <div style={{
            display:"flex", justifyContent:"space-between", alignItems:"center", gap:10,
            padding:"14px 24px", borderTop:"1px solid rgba(255,255,255,0.08)",
            background:"rgba(0,0,0,0.15)", flexShrink:0,
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
                <button style={{ padding:"8px 20px", borderRadius:8, border:"1px solid rgba(255,255,255,0.15)", background:"transparent", color:"var(--text)", cursor:"pointer", fontSize:13 }}>
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
