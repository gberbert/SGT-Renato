const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'sgt-renato' });

(async () => {
  try {
    const users = await admin.firestore().collection('users').get();
    let found = false;
    users.forEach(doc => {
      const data = doc.data();
      if (data.fcmToken) {
        console.log(`User ${doc.id} has token: ${data.fcmToken}`);
        found = true;
      } else {
        console.log(`User ${doc.id} has NO token.`);
      }
    });
    if (!found) console.log('No FCM tokens found in any user doc.');
  } catch(e) {
    console.error(e);
  }
})();
