import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function debugJornadaData() {
  console.log('\n📋 === DIAGNÓSTICO DE DADOS DE JORNADA ===\n');

  try {
    // Buscar todos os usuários
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);

    console.log(`✓ Total de usuários no Firestore: ${snapshot.size}\n`);

    // Verificar quais têm journeyPeriods
    const usersWithJourney = [];
    const usersWithoutJourney = [];

    snapshot.docs.forEach((docSnap) => {
      const user = { id: docSnap.id, ...docSnap.data() };
      if (user.journeyPeriods && Array.isArray(user.journeyPeriods) && user.journeyPeriods.length > 0) {
        usersWithJourney.push(user);
      } else {
        usersWithoutJourney.push(user);
      }
    });

    console.log(`📊 Usuários COM journeyPeriods: ${usersWithJourney.length}`);
    console.log(`📊 Usuários SEM journeyPeriods: ${usersWithoutJourney.length}\n`);

    if (usersWithJourney.length > 0) {
      console.log('✅ Usuários com dados de jornada:\n');
      usersWithJourney.forEach((user) => {
        console.log(`👤 ${user.displayName || user.email}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Períodos: ${user.journeyPeriods.length}`);
        user.journeyPeriods.forEach((period, idx) => {
          const dataInicio = period.dataInicio instanceof Date 
            ? period.dataInicio.toLocaleDateString('pt-BR')
            : (period.dataInicio?.toDate?.() ? period.dataInicio.toDate().toLocaleDateString('pt-BR') : period.dataInicio);
          const dataFim = period.dataFim instanceof Date 
            ? period.dataFim.toLocaleDateString('pt-BR')
            : (period.dataFim?.toDate?.() ? period.dataFim.toDate().toLocaleDateString('pt-BR') : period.dataFim);
          console.log(`   [${idx + 1}] ${period.tipo}: ${dataInicio} → ${dataFim}`);
        });
        console.log();
      });
    } else {
      console.log('⚠️  Nenhum usuário tem dados de jornada registrados.\n');
    }

    console.log('📋 Detalhes técnicos da estrutura:\n');
    if (usersWithJourney.length > 0) {
      const firstUser = usersWithJourney[0];
      console.log('Exemplo de usuário com jornada:');
      console.log(JSON.stringify(firstUser.journeyPeriods[0], null, 2));
    }

    console.log('\n✅ Diagnóstico concluído!\n');
  } catch (error) {
    console.error('❌ Erro ao buscar dados:', error.message);
    process.exit(1);
  }
}

debugJornadaData();
