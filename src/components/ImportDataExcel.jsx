import React, { useState, useRef } from 'react';
import { Button, Text, Flex, Callout, Dialog } from '@radix-ui/themes';
import { collection, doc, setDoc, getDocs, updateDoc, deleteDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db, createAuthUser } from '../firebase';
import { Upload, Download, Info, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ImportDataExcel() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const fileInputRef = useRef(null);

  const fetchDatabaseState = async () => {
    const usersSnap = await getDocs(collection(db, 'users'));
    const squadsSnap = await getDocs(collection(db, 'squads'));
    const projectsSnap = await getDocs(collection(db, 'projects'));
    const systemsSnap = await getDocs(collection(db, 'systems'));

    const state = {
      usersByEmail: {},
      usersById: {},
      squadsByName: {},
      squadsById: {},
      projectsByName: {},
      projectsById: {},
      systemsByName: {},
      systemsById: {}
    };

    usersSnap.docs.forEach(d => {
      const data = d.data();
      if (data.email) state.usersByEmail[data.email.toLowerCase()] = { id: d.id, ...data };
      state.usersById[d.id] = { id: d.id, ...data };
    });

    squadsSnap.docs.forEach(d => {
      const data = d.data();
      if (data.name) state.squadsByName[data.name.toUpperCase()] = { id: d.id, ...data, users: data.users || [], systemIds: data.systemIds || [] };
      state.squadsById[d.id] = { id: d.id, ...data };
    });

    projectsSnap.docs.forEach(d => {
      const data = d.data();
      if (data.name) state.projectsByName[data.name.toUpperCase()] = { id: d.id, ...data };
      state.projectsById[d.id] = { id: d.id, ...data };
    });

    systemsSnap.docs.forEach(d => {
      const data = d.data();
      if (data.name) state.systemsByName[data.name.toUpperCase()] = { id: d.id, ...data };
      state.systemsById[d.id] = { id: d.id, ...data };
    });

    return state;
  };

  const handleExport = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const state = await fetchDatabaseState();

      // Build "Time" Sheet Data
      const timeData = Object.values(state.usersById).map(u => {
        // Find squad for user
        let userSquad = '';
        for (const sq of Object.values(state.squadsByName)) {
          if (sq.users && sq.users.find(member => member.id === u.id)) {
            userSquad = sq.name;
            break;
          }
        }

        return {
          'Nome': u.displayName || '',
          'Nome Resumido': u.shortName || '',
          'Email': u.email || '',
          'Matricula SAP': u.sapId || '',
          'UN': u.un || '',
          'Situação': u.status || '',
          'Contrato': u.contract || '',
          'Perfil': u.profile || '',
          'Senioridade': u.seniority || '',
          'CSR': u.csr || '',
          'Perfil RC': u.rcProfile || '',
          'Senioridade RC': u.rcSeniority || '',
          'RC (Rate Card)': u.rc || '',
          'Squad': userSquad
        };
      });

      // Build "Sistemas x Squads" Sheet Data
      const systemsData = Object.values(state.systemsById).map(s => {
        let squadName = '';
        if (s.squadId && state.squadsById[s.squadId]) {
          squadName = state.squadsById[s.squadId].name;
        }
        let projectName = '';
        if (s.projectId && state.projectsById[s.projectId]) {
          projectName = state.projectsById[s.projectId].name;
        }
        
        return {
          'Sistemas': s.name || '',
          'Squad': squadName,
          'Projeto': projectName
        };
      });

      const wb = XLSX.utils.book_new();
      
      if (timeData.length > 0) {
        const wsTime = XLSX.utils.json_to_sheet(timeData);
        XLSX.utils.book_append_sheet(wb, wsTime, "Time");
      } else {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{}]), "Time");
      }

      if (systemsData.length > 0) {
        const wsSystems = XLSX.utils.json_to_sheet(systemsData);
        XLSX.utils.book_append_sheet(wb, wsSystems, "Sistemas x Squads");
      } else {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{}]), "Sistemas x Squads");
      }

      XLSX.writeFile(wb, "Exportacao_SGT.xlsx");
      setMessage({ type: 'success', text: 'Arquivo exportado com sucesso!' });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Erro ao exportar: ' + err.message });
    }
    setLoading(false);
  };

  const processExcel = async (workbook) => {
    setLoading(true);
    setMessage(null);
    try {
      let state = await fetchDatabaseState();
      let addedUsers = 0, updatedUsers = 0;
      let addedSystems = 0, updatedSystems = 0;

      // Ensure squad helper
      const getOrCreateSquad = async (squadName) => {
        if (!squadName) return null;
        const key = squadName.trim().toUpperCase();
        if (state.squadsByName[key]) return state.squadsByName[key];

        // Create new squad
        const docRef = await addDoc(collection(db, 'squads'), {
          name: squadName.trim(),
          users: [],
          systemIds: [],
          createdAt: serverTimestamp()
        });
        const newSquad = { id: docRef.id, name: squadName.trim(), users: [], systemIds: [] };
        state.squadsByName[key] = newSquad;
        state.squadsById[docRef.id] = newSquad;
        return newSquad;
      };

      // Ensure project helper
      const getOrCreateProject = async (projName) => {
        if (!projName) return null;
        const key = projName.trim().toUpperCase();
        if (state.projectsByName[key]) return state.projectsByName[key];

        const docRef = await addDoc(collection(db, 'projects'), {
          name: projName.trim(),
          createdAt: serverTimestamp()
        });
        const newProj = { id: docRef.id, name: projName.trim() };
        state.projectsByName[key] = newProj;
        state.projectsById[docRef.id] = newProj;
        return newProj;
      };

      // 1. Process "Time"
      const timeSheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('time'));
      if (timeSheetName) {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[timeSheetName]);

        for (const row of rows) {
          const email = (row['Email'] || '').trim().toLowerCase();
          if (!email) continue;
          
          const name = (row['Nome'] || '').trim();
          const shortName = (row['Nome Resumido'] || '').trim();
          const squadNameStr = (row['Squad'] || '').trim();
          
          let userId = null;
          let isNewAuth = false;
          const tempPassword = Math.random().toString(36).slice(-8) + "Aa1@";
          let authUid = null;

          const createWithRetry = async (em, pass, retries = 5) => {
             for (let r = 0; r < retries; r++) {
                try {
                   const uid = await createAuthUser(em, pass, false);
                   await new Promise(resolve => setTimeout(resolve, 1000));
                   return { uid, isNew: true };
                } catch (e) {
                   if (e.code === 'auth/email-already-in-use') {
                      return { uid: null, isNew: false };
                   }
                   if (e.code === 'auth/too-many-requests' || e.code === 'auth/network-request-failed') {
                      console.log(`Erro de rede/rate limit (${e.code}). Esperando 5 segundos...`);
                      await new Promise(resolve => setTimeout(resolve, 5000));
                      continue;
                   }
                   throw e;
                }
             }
             throw new Error("Muitas requisições (auth/too-many-requests ou network-request-failed).");
          };

          // Se o usuário já existe na base, evitamos bater no Firebase Auth para não tomar Rate Limit
          if (!state.usersByEmail[email]) {
             const authResult = await createWithRetry(email, tempPassword);
             authUid = authResult.uid;
             isNewAuth = authResult.isNew;
          }

          const payload = {
            displayName: name,
            shortName,
            email,
            sapId: row['Matricula SAP'] || '',
            un: row['UN'] || '',
            status: row['Situação'] || '',
            contract: row['Contrato'] || '',
            profile: row['Perfil'] || '',
            seniority: row['Senioridade'] || '',
            csr: row['CSR'] || '',
            rcProfile: row['Perfil RC'] || '',
            rcSeniority: row['Senioridade RC'] || '',
            rc: row['RC (Rate Card)'] || ''
          };

          if (state.usersByEmail[email]) {
            const oldDoc = state.usersByEmail[email];
            if (isNewAuth) {
               // Ghost doc replacement
               await deleteDoc(doc(db, 'users', oldDoc.id));
               userId = authUid;
               await setDoc(doc(db, 'users', userId), {
                  ...payload,
                  role: oldDoc.role || 'user',
                  tempPassword,
                  createdAt: serverTimestamp()
               });
               for (const sqKey in state.squadsByName) {
                  state.squadsByName[sqKey].users = state.squadsByName[sqKey].users.filter(u => u.id !== oldDoc.id);
               }
               addedUsers++;
            } else {
               userId = oldDoc.id;
               await updateDoc(doc(db, 'users', userId), payload);
               updatedUsers++;
            }
          } else {
            userId = authUid;
            if (!userId) {
               console.warn(`Email ${email} exist in Auth but not Firestore. Skip.`);
               continue;
            }
            await setDoc(doc(db, 'users', userId), {
              ...payload,
              role: 'user',
              tempPassword,
              createdAt: serverTimestamp()
            });
            addedUsers++;
          }

          // Process Squad
          if (squadNameStr) {
            await getOrCreateSquad(squadNameStr);
            const targetSquadKey = squadNameStr.toUpperCase();
            
            for (const sqKey in state.squadsByName) {
              const sq = state.squadsByName[sqKey];
              if (sqKey === targetSquadKey) {
                const existingIdx = sq.users.findIndex(u => u.id === userId);
                if (existingIdx === -1) sq.users.push({ id: userId, role: 'Developer' });
              } else {
                sq.users = sq.users.filter(u => u.id !== userId);
              }
            }
          }
        }
      }

      // O update de squads ocorrerá após os sistemas

      // 2. Process "Sistemas x Squads"
      const sysSheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('sistemas'));
      if (sysSheetName) {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sysSheetName]);
        for (const row of rows) {
          const sysName = (row['Sistemas'] || '').trim();
          if (!sysName) continue;

          const squadName = (row['Squad'] || '').trim();
          const projName = (row['Projeto'] || '').trim();

          let squadId = null;
          let projectId = null;

          if (squadName) {
            const sq = await getOrCreateSquad(squadName);
            if (sq) squadId = sq.id;
          }

          if (projName) {
            const proj = await getOrCreateProject(projName);
            if (proj) projectId = proj.id;
          }

          const sysKey = sysName.toUpperCase();
          let systemIdToUse = null;

          if (state.systemsByName[sysKey]) {
            // Update
            const sysDoc = state.systemsByName[sysKey];
            systemIdToUse = sysDoc.id;
            const updates = {};
            if (squadId && sysDoc.squadId !== squadId) {
                updates.squadId = squadId;
                if (sysDoc.squadId && state.squadsById[sysDoc.squadId]) {
                   const oldSqNameKey = state.squadsById[sysDoc.squadId].name.toUpperCase();
                   const oldSq = state.squadsByName[oldSqNameKey];
                   if (oldSq && oldSq.systemIds) {
                       oldSq.systemIds = oldSq.systemIds.filter(id => id !== systemIdToUse);
                   }
                }
            }
            if (projectId && sysDoc.projectId !== projectId) updates.projectId = projectId;
            
            if (Object.keys(updates).length > 0) {
              await updateDoc(doc(db, 'systems', sysDoc.id), { ...updates, updatedAt: serverTimestamp() });
              updatedSystems++;
            }
          } else {
            // Create
            const docRef = await addDoc(collection(db, 'systems'), {
              name: sysName,
              squadId: squadId || null,
              projectId: projectId || null,
              createdAt: serverTimestamp()
            });
            systemIdToUse = docRef.id;
            state.systemsByName[sysKey] = { id: docRef.id, name: sysName, squadId, projectId };
            addedSystems++;
          }

          if (squadId && state.squadsById[squadId]) {
            const sqNameKey = state.squadsById[squadId].name.toUpperCase();
            const sq = state.squadsByName[sqNameKey];
            if (!sq.systemIds) sq.systemIds = [];
            if (!sq.systemIds.includes(systemIdToUse)) {
               sq.systemIds.push(systemIdToUse);
            }
          }
        }
      }

      // Save Squads Users and Systems updates
      for (const sqKey in state.squadsByName) {
        const sq = state.squadsByName[sqKey];
        const uniqueUsers = [];
        const seenIds = new Set();
        sq.users.forEach(u => {
           const uid = u.id || u.userId;
           if (uid && !seenIds.has(uid)) {
               seenIds.add(uid);
               uniqueUsers.push({ 
                 id: uid, 
                 role: u.role === 'desenvolvedor' ? 'Developer' : (u.role || 'Developer') 
               });
           }
        });
        await updateDoc(doc(db, 'squads', sq.id), { 
          users: uniqueUsers, 
          systemIds: sq.systemIds || [] 
        });
      }

      setMessage({ type: 'success', text: `Importação concluída! Usuários: ${addedUsers} criados, ${updatedUsers} atualizados. Sistemas: ${addedSystems} criados, ${updatedSystems} atualizados.` });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Erro: ' + err.message });
    }
    setLoading(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      processExcel(wb);
    };
    reader.readAsBinaryString(file);
    e.target.value = null; // reset
  };

  return (
    <Flex direction="column" gap="3" style={{ padding: '20px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
      <Flex justify="between" align="center" wrap="wrap" gap="3">
        <Flex direction="column" gap="1">
          <Text weight="bold" size="4">Importação / Exportação de Configurações (Excel)</Text>
          <Text color="gray" size="2">Use planilhas .xlsx com abas "Time" e "Sistemas x Squads" para manter os dados atualizados.</Text>
        </Flex>
        
        <Flex gap="2">
          <Button disabled={loading} onClick={handleExport} variant="soft" color="green">
            {loading ? <Loader2 size={16} className="spinner-icon" /> : <Download size={16} />}
            Exportar
          </Button>
          <Button disabled={loading} onClick={() => fileInputRef.current?.click()}>
            {loading ? <Loader2 size={16} className="spinner-icon" /> : <Upload size={16} />}
            Importar
          </Button>
        </Flex>
      </Flex>

      <input 
        type="file" 
        accept=".xlsx, .xls" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleFileChange}
      />

      {message && (
        <Callout.Root color={message.type === 'error' ? 'red' : 'green'} size="2" mt="4">
          <Callout.Icon><Info size={16} /></Callout.Icon>
          <Callout.Text weight="bold">{message.text}</Callout.Text>
        </Callout.Root>
      )}

      <Dialog.Root open={loading}>
        <Dialog.Content style={{ maxWidth: 500, background: 'var(--blue-3)', border: '2px dashed var(--blue-8)' }} onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <Flex direction="column" align="center" justify="center" gap="3" p="4">
            <Loader2 size={64} className="spinner-icon" color="var(--blue-11)" style={{ animation: 'spin 1.5s linear infinite' }} />
            <Text size="6" weight="bold" style={{ color: 'var(--blue-11)' }}>Processando Arquivo...</Text>
            <Text size="4" style={{ color: 'var(--blue-11)' }}>Lendo estrutura e persistindo atualizações.</Text>
            <Text size="3" mt="2" color="ruby" weight="bold">O Firebase pode pausar alguns segundos por segurança anti-spam.</Text>
            <Text size="3" color="ruby" weight="bold">NÃO feche ou recarregue a aba!</Text>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
}
