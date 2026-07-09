importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyBfX9ytpF-hXsLjvu8RFWd4qUIyRC1FiRs",
  authDomain: "sgt-renato.firebaseapp.com",
  projectId: "sgt-renato",
  storageBucket: "sgt-renato.firebasestorage.app",
  messagingSenderId: "759301519468",
  appId: "1:759301519468:web:7010dd7733a234387c4049"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensagem recebida em background ', payload);
  // O Firebase SDK já exibe automaticamente notificações que contêm o objeto "notification".
  // Comentado para evitar duplicidade no iPhone/Android:
  // const notificationTitle = payload.notification.title;
  // const notificationOptions = {
  //   body: payload.notification.body,
  //   icon: '/vite.svg',
  //   data: payload.data
  // };
  // self.registration.showNotification(notificationTitle, notificationOptions);
});
