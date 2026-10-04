#!/usr/bin/env node
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyCxZ-3xpFn_2VlHoEL-K7m5BtVZTHfZzbc",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "sgt-default-55d29.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "sgt-default-55d29",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "sgt-default-55d29.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "826621801394",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:826621801394:web:c3f77c8d0a8dddfe30edc1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('======================================================================');
console.log('🧪 Teste da Collection "squadroles"');
console.log('======================================================================\n');

async function testSquadRolesCollection() {
  try {
    // 1. Verificar documentos existentes
    console.log('▶  Lendo documentos existentes da collection "squadroles"...');
    const q = query(collection(db, 'squadroles'), orderBy('order', 'asc'));
    const snapshot = await getDocs(q);
    
    console.log(`   📊 Total de documentos: ${snapshot.size}`);
    
    if (snapshot.size === 0) {
      console.log('   ⚠️  Nenhum documento encontrado!\n');
      return false;
    }
    
    const roles = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      roles.push({ id: doc.id, ...data });
      console.log(`   ✓ ${data.name || 'SEM NOME'} (ordem: ${data.order || 'indefinida'})`);
    });
    
    console.log(`\n✅ Leitura da collection "squadroles" funcionando corretamente!\n`);
    
    // 2. Testar salvamento de novo documento
    console.log('▶  Testando salvamento de novo documento...');
    const testRoleData = {
      name: 'Teste - ' + new Date().getTime(),
      description: 'Role de teste criado em ' + new Date().toLocaleString('pt-BR'),
      order: roles.length + 1,
      createdAt: serverTimestamp()
    };
    
    const newDocRef = await addDoc(collection(db, 'squadroles'), testRoleData);
    console.log(`   ✓ Documento criado com ID: ${newDocRef.id}`);
    console.log(`   ✓ Nome: ${testRoleData.name}`);
    console.log(`   ✓ Descrição: ${testRoleData.description}\n`);
    
    console.log('✅ Salvamento na collection "squadroles" funcionando corretamente!\n');
    
    console.log('======================================================================');
    console.log('✅ Todos os testes passaram com sucesso!');
    console.log('======================================================================');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Erro durante os testes:');
    console.error(error.message);
    console.error('\n📋 Detalhes:', error);
    return false;
  }
}

testSquadRolesCollection().then(success => {
  process.exit(success ? 0 : 1);
});
