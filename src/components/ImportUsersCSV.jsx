import React, { useState, useRef } from 'react';
import { Button, Text, Flex, Callout } from '@radix-ui/themes';
import { collection, doc, setDoc, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Upload, Info } from 'lucide-react';

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
        if (usersByEmail[email]) {
          userId = usersByEmail[email].id;
          await updateDoc(doc(db, 'users', userId), { name, shortName });
          updated++;
        } else {
          const userRef = doc(collection(db, 'users'));
          userId = userRef.id;
          await setDoc(userRef, {
            name,
            shortName,
            email,
            role: 'user',
            createdAt: serverTimestamp()
          });
          added++;
        }

        // Process squads for this user
        for (const sqName in squadsByName) {
          const sq = squadsByName[sqName];
          if (sqName === squadName) {
            // Target squad: add if not present
            const existingIdx = sq.users.findIndex(u => u.userId === userId);
            if (existingIdx === -1) {
              sq.users.push({ userId, role: 'desenvolvedor' });
            }
          } else {
            // Other squad: remove if present
            sq.users = sq.users.filter(u => u.userId !== userId);
          }
        }
      }

      // Save squads
      for (const sqName in squadsByName) {
        const sq = squadsByName[sqName];
        await updateDoc(doc(db, 'squads', sq.id), { users: sq.users });
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
          <Upload size={16} />
          {loading ? 'Processando...' : 'Selecionar Arquivo CSV'}
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
        <Callout.Root color={message.type === 'error' ? 'red' : 'green'} size="1" mt="2">
          <Callout.Icon><Info size={14} /></Callout.Icon>
          <Callout.Text>{message.text}</Callout.Text>
        </Callout.Root>
      )}
    </Flex>
  );
}
