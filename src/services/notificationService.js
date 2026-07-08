import { collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

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

export const subscribeToUserNotifications = (userId, callback) => {
  if (!userId) return () => {};
  
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const notifs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(notifs);
  });
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
