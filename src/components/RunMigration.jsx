import React, { useState } from 'react';
import { Button, Text, Box } from '@radix-ui/themes';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import estimativasData from '../utils/final_estimativas.json';

const RunMigration = () => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleImport = async () => {
    setLoading(true);
    try {
      const rulesRef = collection(db, 'estimationRules');
      let count = 0;
      for (const rule of estimativasData) {
        await addDoc(rulesRef, rule);
        count++;
        setProgress(count);
      }
      alert('Importação concluída com sucesso!');
    } catch (error) {
      console.error(error);
      alert('Erro na importação: ' + error.message);
    }
    setLoading(false);
  };

  return (
    <Box p="4">
      <Text>Importar as 370 regras do Excel para o Firestore.</Text>
      <br/>
      <Button onClick={handleImport} disabled={loading} mt="2">
        {loading ? `Importando... ${progress} de ${estimativasData.length}` : 'Rodar Migração'}
      </Button>
    </Box>
  );
};

export default RunMigration;
