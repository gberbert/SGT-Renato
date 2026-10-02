import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyDKhzKtQXvH2hZJQDx1r9KvUzuNQlJhfzY',
  authDomain: 'sgt-renato-prd.firebaseapp.com',
  projectId: 'sgt-renato-prd',
  storageBucket: 'sgt-renato-prd.appspot.com',
  messagingSenderId: '651637503584',
  appId: '1:651637503584:web:94dd5cfcc0456e0a1c3d03',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateSquadRoles() {
  try {
    console.log('🔄 Iniciando migração de Squad Roles...\n');

    // Criar coleção padrão de papéis
    const defaultRoles = [
      {
        name: 'Tech Lead',
        description: 'Líder técnico da squad',
        squadId: null,
      },
      {
        name: 'Desenvolvedor Senior',
        description: 'Desenvolvedor com experiência sênior',
        squadId: null,
      },
      {
        name: 'Desenvolvedor Pleno',
        description: 'Desenvolvedor com experiência plena',
        squadId: null,
      },
      {
        name: 'Desenvolvedor Junior',
        description: 'Desenvolvedor em desenvolvimento',
        squadId: null,
      },
      {
        name: 'QA/Tester',
        description: 'Profissional de qualidade e testes',
        squadId: null,
      },
      {
        name: 'Product Owner',
        description: 'Gestor de produto',
        squadId: null,
      },
      {
        name: 'Scrum Master',
        description: 'Facilitador de processos ágeis',
        squadId: null,
      },
    ];

    const batch = writeBatch(db);
    const rolesColl = collection(db, 'squadRoles');

    // Verificar se já existem papéis
    const existing = await getDocs(rolesColl);
    if (existing.size > 0) {
      console.log(`⚠️  Já existem ${existing.size} papéis cadastrados. Pulando criação.`);
      console.log('✅ Migração concluída sem alterações.\n');
      process.exit(0);
    }

    // Adicionar papéis padrão
    for (const role of defaultRoles) {
      const docRef = doc(rolesColl);
      batch.set(docRef, {
        ...role,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`✓ Adicionado: ${role.name}`);
    }

    await batch.commit();
    console.log(`\n✅ ${defaultRoles.length} papéis padrão criados com sucesso!`);
    console.log('📊 Migração concluída.\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro durante migração:', error);
    process.exit(1);
  }
}

migrateSquadRoles();
