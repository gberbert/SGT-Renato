import admin from 'firebase-admin';
import serviceAccount from './Arquivos_Gerais/sgt-renato-firebase-adminsdk-fbsvc-2c3d1c9c2c.json' assert { type: 'json' };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function checkJornadaData() {
  try {
    console.log('🔍 Verificando dados de jornada na collection "users"...\n');
    
    const snapshot = await db.collection('users').get();
    
    if (snapshot.empty) {
      console.log('❌ Nenhum usuário encontrado.');
      return;
    }

    snapshot.forEach(doc => {
      const user = doc.data();
      const hasJourneyPeriods = user.journeyPeriods && Array.isArray(user.journeyPeriods) && user.journeyPeriods.length > 0;
      
      console.log(`👤 ${user.displayName || user.email || doc.id}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   journeyPeriods: ${hasJourneyPeriods ? `✅ ${user.journeyPeriods.length} período(s)` : '❌ Nenhum dado'}`);
      
      if (hasJourneyPeriods) {
        user.journeyPeriods.forEach((period, idx) => {
          console.log(`   [${idx}] ${period.tipo}: ${period.dataInicio} → ${period.dataFim}`);
        });
      }
      console.log();
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

checkJornadaData();
