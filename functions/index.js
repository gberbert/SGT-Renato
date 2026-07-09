const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require('firebase-admin');
admin.initializeApp();

exports.onCreateNotification = onDocumentCreated({
    document: 'notifications/{notificationId}',
    database: 'default'
}, async (event) => {
    const snap = event.data;
    if (!snap) {
      return null;
    }
    const notification = snap.data();

    // Verifique se a notificação possui o ID do usuário de destino
    if (!notification.userId) {
      console.log('Sem userId na notificação.');
      return null;
    }

    // Use a instância do Firestore do próprio documento que acionou o trigger
    const db = event.data.ref.firestore;
    
    // Busque o perfil do usuário no Firestore para pegar o FCM Token
    const userDoc = await db.collection('users').doc(notification.userId).get();
    
    if (!userDoc.exists) {
      console.log('Usuário não encontrado.');
      return null;
    }

    const userData = userDoc.data();
    const fcmToken = userData.fcmToken;

    if (!fcmToken) {
      console.log(`Usuário ${notification.userId} não possui um token FCM registrado.`);
      return null;
    }

    const title = notification.senderName || notification.title?.split(':')[0] || 'SGT - Nova Notificação';
    const bodyText = notification.ticketTitle 
          ? `[${notification.ticketTitle}]\n${notification.textSnippet || notification.message}`
          : (notification.textSnippet || notification.message);

    const payload = {
      token: fcmToken,
      notification: {
        title: title,
        body: bodyText,
      },
      webpush: {
        fcmOptions: {
          link: notification.link ? `https://sgt-renato.web.app/?ticket=${notification.link}` : "https://sgt-renato.web.app"
        },
        notification: {
          icon: '/vite.svg',
          badge: '/vite.svg'
        }
      }
    };

    try {
      const response = await admin.messaging().send(payload);
      console.log('Notificação push enviada com sucesso:', response);
    } catch (error) {
      console.error('Erro ao enviar push notification:', error);
      
      // Se o token for inválido, podemos querer removê-lo do banco
      if (error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered') {
        console.log('Removendo token inválido do usuário.');
        await db.collection('users').doc(notification.userId).update({
          fcmToken: admin.firestore.FieldValue.delete()
        });
      }
    }
  });
