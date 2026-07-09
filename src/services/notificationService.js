import { collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { getToken } from 'firebase/messaging';
import { db, messaging } from '../firebase';

export const createNotification = async (userId, title, message, link = null, additionalData = {}) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      title,
      message,
      link,
      ...additionalData,
      read: false,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Erro ao criar notificação:", error);
  }
};

export const subscribeToUserNotifications = (userId, callback, onNewNotification = null) => {
  if (!userId) return () => {};
  
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  let isInitialLoad = true;

  return onSnapshot(q, (snapshot) => {
    const notifs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(notifs);

    if (!isInitialLoad && onNewNotification) {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (!data.read) {
            onNewNotification({ id: change.doc.id, ...data });
          }
        }
      });
    }
    isInitialLoad = false;
  });
};

export const requestFCMToken = async (userId) => {
  try {
    if (Notification.permission === 'granted') {
      const token = await getToken(messaging, { 
        // A VAPID Key deve ser configurada pelo usuário no Firebase Console 
        // e idealmente colocada no .env como VITE_VAPID_KEY
        vapidKey: import.meta.env.VITE_VAPID_KEY || 'SUA_VAPID_KEY_AQUI' 
      });
      if (token) {
        await updateDoc(doc(db, 'users', userId), { fcmToken: token });
        console.log('FCM Token salvo com sucesso.');
      } else {
        console.log('O Firebase não retornou um token FCM. Permissão negada ou ambiente não suportado.');
      }
    } else {
      console.log('Permissão de notificação negada pelo navegador.');
    }
  } catch (error) {
    console.error('Erro ao pedir token FCM:', error);
  }
};

export const markNotificationAsRead = async (notificationId) => {
  try {
    const notifRef = doc(db, 'notifications', notificationId);
    await updateDoc(notifRef, { read: true });
  } catch (error) {
    console.error("Erro ao marcar notificação como lida:", error);
  }
};

export const deleteNotification = async (notificationId) => {
  try {
    const notifRef = doc(db, 'notifications', notificationId);
    await deleteDoc(notifRef);
  } catch (error) {
    console.error("Erro ao apagar notificação:", error);
  }
};

export const markAllAsRead = async (userId, notifications) => {
  try {
    const unread = notifications.filter(n => !n.read);
    const promises = unread.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true }));
    await Promise.all(promises);
  } catch (error) {
    console.error("Erro ao marcar todas como lidas:", error);
  }
};

export const deleteAllNotifications = async (notifications) => {
  try {
    const promises = notifications.map(n => deleteDoc(doc(db, 'notifications', n.id)));
    await Promise.all(promises);
  } catch (error) {
    console.error("Erro ao apagar todas as notificações:", error);
  }
};
