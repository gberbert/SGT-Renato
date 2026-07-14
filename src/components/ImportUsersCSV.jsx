import React, { useState, useRef } from 'react';
import { Button, Text, Flex, Callout, Dialog } from '@radix-ui/themes';
import { collection, doc, setDoc, getDocs, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, createAuthUser } from '../firebase';
import { Upload, Info, Loader2 } from 'lucide-react';

export default function ImportUsersCSV() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const fileInputRef = useRef(null);

  const processCSV = async (csvContent) => {
    setLoading(true);
    setMessage(null);
    try {
      const lines = csvContent.split('\n');
      
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersByEmail = {};
      usersSnap.docs.forEach(d => {
        const data = d.data();
        if (data.email) {
          usersByEmail[data.email.toLowerCase()] = { id: d.id, ...data };
        }
      });

      const squadsSnap = await getDocs(collection(db, 'squads'));
      const squadsByName = {};
      
      squadsSnap.docs.forEach(d => {
        const data = d.data();
        squadsByName[data.name.toUpperCase()] = { id: d.id, users: data.users || [] };
      });

      let added = 0;
      let updated = 0;

      // Start from index 1 if there is a header, or 0 if no header.
      // We will try to detect if it's a header by checking the first line's email format.
      let startIndex = 0;
      if (lines.length > 0 && lines[0].toLowerCase().includes('email')) {
         startIndex = 1;
      }

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        const parts = line.split(';');
        if (parts.length < 4) continue;

        const name = parts[0].trim();
        const shortName = parts[1].trim();
        const email = parts[2].trim().toLowerCase();
        const squadName = parts[3].trim().toUpperCase();

        let userId = null;
        let isNewAuth = false;
        const tempPassword = Math.random().toString(36).slice(-8) + "Aa1@";
        let authUid = null;
        
        const createWithRetry = async (em, pass, retries = 5) => {
           for (let r = 0; r < retries; r++) {
              try {
                 const uid = await createAuthUser(em, pass, false);
                 // Delay maior para evitar bloqueio por anti-spam do Firebase
                 await new Promise(resolve => setTimeout(resolve, 2500));
                 return { uid, isNew: true };
              } catch (e) {
                 if (e.code === 'auth/email-already-in-use') {
                    return { uid: null, isNew: false };
                 }
                 if (e.code === 'auth/too-many-requests') {
                    console.log("Rate limit hit. Esperando 10 segundos...");
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    continue;
                 }
                 throw e;
              }
           }
           throw new Error("Muitas requisições (auth/too-many-requests). O Firebase bloqueou temporariamente a criação. Aguarde uns 2 minutos e tente novamente com os que faltaram.");
        };

        const authResult = await createWithRetry(email, tempPassword);
        authUid = authResult.uid;
        isNewAuth = authResult.isNew;

        if (usersByEmail[email]) {
          const oldDoc = usersByEmail[email];
          if (isNewAuth) {
             // O usuário existia apenas no Firestore (documento "fantasma" criado erroneamente), vamos deletar e recriar corretamente com o ID do Auth
             await deleteDoc(doc(db, 'users', oldDoc.id));
             userId = authUid;
             await setDoc(doc(db, 'users', userId), {
                displayName: name,
                shortName,
                email,
                role: 'user',
                tempPassword,
                createdAt: serverTimestamp()
             });
              // Limpar as squads antigas vinculadas ao ID fantasma
             for (const sqName in squadsByName) {
                squadsByName[sqName].users = squadsByName[sqName].users.filter(u => u.id !== oldDoc.id);
             }
             added++;
          } else {
             // O usuário já existe no Auth e no Firestore (ou no Auth antigo e estamos apenas atualizando)
             userId = oldDoc.id;
             await updateDoc(doc(db, 'users', userId), { displayName: name, shortName });
             updated++;
          }
        } else {
          // Não existe no Firestore
          userId = authUid;
          if (!userId) {
             console.warn(`Email ${email} já existe no Auth mas não no Firestore. Não é possível descobrir o UID. Pulando...`);
             continue;
          }
          await setDoc(doc(db, 'users', userId), {
            displayName: name,
            shortName,
            email,
            role: 'user',
            tempPassword,
            createdAt: serverTimestamp()
          });
          added++;
        }

        // Process squads for this user
        for (const sqName in squadsByName) {
          const sq = squadsByName[sqName];
          if (sqName === squadName) {
            // Target squad: add if not present
            const existingIdx = sq.users.findIndex(u => u.id === userId);
            if (existingIdx === -1) {
              sq.users.push({ id: userId, role: 'Developer' });
            }
          } else {
            // Other squad: remove if present
            sq.users = sq.users.filter(u => u.id !== userId);
          }
        }
      }

      // Save squads
      for (const sqName in squadsByName) {
        const sq = squadsByName[sqName];
        
        // Remove duplicates, ghost records, and fix legacy `userId` keys
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

        await updateDoc(doc(db, 'squads', sq.id), { users: uniqueUsers });
      }

      setMessage({ type: 'success', text: `Importação concluída! ${added} novos criados, ${updated} atualizados.` });
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
      processCSV(evt.target.result);
    };
    reader.readAsText(file);
    // clear input
    e.target.value = null;
  };

  return (
    <Flex direction="column" gap="3" style={{ padding: '20px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
      <Flex justify="between" align="center">
        <Flex direction="column" gap="1">
          <Text weight="bold" size="4">Importação de Usuários em Lote (CSV)</Text>
          <Text color="gray" size="2">Faça o upload de um arquivo .csv com colunas separadas por ponto-e-vírgula (;).</Text>
          <Text color="gray" size="2">Ordem: Nome;Nome Resumido;Email;SiglaDaSquad</Text>
        </Flex>
        <Button disabled={loading} onClick={() => fileInputRef.current?.click()}>
          {loading ? <Loader2 size={16} className="spinner-icon" /> : <Upload size={16} />}
          {loading ? 'Processando Usuários...' : 'Selecionar Arquivo CSV'}
        </Button>
      </Flex>

      <input 
        type="file" 
        accept=".csv" 
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
            <Text size="6" weight="bold" style={{ color: 'var(--blue-11)' }}>Processando Importação...</Text>
            <Text size="4" style={{ color: 'var(--blue-11)' }}>Criando usuários e vinculando Squads.</Text>
            <Text size="3" mt="2" color="ruby" weight="bold">O Firebase pode pausar alguns segundos por segurança anti-spam.</Text>
            <Text size="3" color="ruby" weight="bold">NÃO feche ou recarregue a aba!</Text>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
}
