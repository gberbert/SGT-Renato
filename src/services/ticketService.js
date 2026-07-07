import { collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../firebase';
import { createNotification } from './notificationService';

const COLLECTION_NAME = 'tickets';
const USERS_COLLECTION = 'users';

export const extractMentionsAndNotify = async (htmlContent, title, message, link) => {
  if (!htmlContent) return;
  const regex = /data-type="mention" data-id="([^"]+)"/g;
  const matches = [...htmlContent.matchAll(regex)];
  const userIds = [...new Set(matches.map(m => m[1]))];
  
  const currentUserUid = auth?.currentUser?.uid;
  
  for (const uid of userIds) {
    if (uid !== currentUserUid) {
      await createNotification(uid, title, message, link);
    }
  }
};

export const getUserRole = async (user) => {
  if (!user) return 'user';
  const userRef = doc(db, USERS_COLLECTION, user.uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    return userSnap.data().role || 'user';
  } else {
    // Primeiro login, cria o perfil como 'admin' apenas se for um email específico, senão 'user'
    const role = user.email === 'renato@sgt.com' ? 'admin' : 'user';
    await setDoc(userRef, {
      email: user.email,
      displayName: user.displayName,
      role: role,
      createdAt: new Date()
    });
    return role;
  }
};

export const subscribeToTickets = (callback, onError) => {
  const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const tickets = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(tickets);
  }, (error) => {
    console.error("Erro ao escutar tickets:", error);
    if (onError) onError(error);
  });
};

export const subscribeToSubtasks = (parentId, callback) => {
  const q = query(collection(db, COLLECTION_NAME));
  // Note: We filter locally since we might not have a composite index set up yet for parentId + orderBy createdAt in Firestore.
  return onSnapshot(q, (snapshot) => {
    const tickets = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(t => t.parentId === parentId)
      .sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
    callback(tickets);
  });
};

export const createTicket = async (ticketData) => {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...ticketData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await logTicketAction(docRef.id, 'Criou o ticket', ticketData.assignee || 'Sistema');
    const userName = auth?.currentUser?.displayName || 'Sistema';
    if (ticketData.description) {
      await extractMentionsAndNotify(
        ticketData.description,
        'Mencionaram você!',
        `${userName} mencionou você na descrição de um ticket.`,
        null
      );
    }
    return docRef.id;
  } catch (error) {
    console.error("Erro ao criar ticket:", error);
    throw error;
  }
};

export const updateTicketStatus = async (ticketId, newStatusId, userName = 'Sistema') => {
  try {
    const ticketRef = doc(db, COLLECTION_NAME, ticketId);
    await updateDoc(ticketRef, {
      columnId: newStatusId,
      updatedAt: new Date()
    });
    await logTicketAction(ticketId, `Moveu o ticket para ${newStatusId}`, userName);
  } catch (error) {
    console.error("Erro ao atualizar status:", error);
    throw error;
  }
};

export const updateTicket = async (ticketId, updates, userName = 'Sistema') => {
  try {
    const ticketRef = doc(db, COLLECTION_NAME, ticketId);
    await updateDoc(ticketRef, {
      ...updates,
      updatedAt: new Date()
    });
    // For simplicity, we just say it was updated, but we could diff the updates
    await logTicketAction(ticketId, 'Atualizou os detalhes do ticket', userName);
    if (updates.description) {
      await extractMentionsAndNotify(
        updates.description,
        'Mencionaram você!',
        `${userName} mencionou você ao editar um ticket.`,
        null
      );
    }
  } catch (error) {
    console.error("Erro ao atualizar ticket:", error);
    throw error;
  }
};

export const addComment = async (ticketId, commentData) => {
  try {
    const commentsRef = collection(db, `${COLLECTION_NAME}/${ticketId}/comments`);
    await addDoc(commentsRef, {
      ...commentData,
      createdAt: new Date()
    });
    if (commentData.text) {
      await extractMentionsAndNotify(
        commentData.text,
        'Nova menção!',
        `${commentData.userName || 'Alguém'} mencionou você em um comentário de ticket.`,
        null
      );
    }
  } catch (error) {
    console.error("Erro ao adicionar comentário:", error);
    throw error;
  }
};

export const subscribeToComments = (ticketId, callback) => {
  const q = query(
    collection(db, `${COLLECTION_NAME}/${ticketId}/comments`),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const comments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(comments);
  });
};

export const uploadAttachment = async (ticketId, file, uploaderInfo) => {
  try {
    const fileExtension = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExtension}`;
    const storageRef = ref(storage, `tickets/${ticketId}/${fileName}`);
    
    // Faz o upload
    const snapshot = await uploadBytesResumable(storageRef, file);
    
    // Pega a URL pública
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    // Salva o registro no Firestore
    const attachmentsRef = collection(db, `${COLLECTION_NAME}/${ticketId}/attachments`);
    await addDoc(attachmentsRef, {
      name: file.name,
      url: downloadURL,
      type: file.type,
      size: file.size,
      uploadedBy: uploaderInfo.name,
      uploaderId: uploaderInfo.uid,
      createdAt: new Date()
    });
    
    return downloadURL;
  } catch (error) {
    console.error("Erro ao fazer upload do anexo:", error);
    throw error;
  }
};

export const subscribeToAttachments = (ticketId, callback) => {
  const q = query(
    collection(db, `${COLLECTION_NAME}/${ticketId}/attachments`),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const attachments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(attachments);
  });
};

export const logTicketAction = async (ticketId, actionMessage, userName) => {
  try {
    const historyRef = collection(db, `${COLLECTION_NAME}/${ticketId}/history`);
    await addDoc(historyRef, {
      action: actionMessage,
      userName: userName,
      createdAt: new Date()
    });
  } catch (error) {
    console.error("Erro ao logar ação:", error);
  }
};

export const subscribeToHistory = (ticketId, callback) => {
  const q = query(
    collection(db, `${COLLECTION_NAME}/${ticketId}/history`),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const history = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(history);
  });
};

export const addWorkLog = async (ticketId, timeSpentMinutes, description, userName) => {
  try {
    const workLogsRef = collection(db, `${COLLECTION_NAME}/${ticketId}/workLogs`);
    await addDoc(workLogsRef, {
      timeSpentMinutes,
      description,
      userName,
      createdAt: new Date()
    });
    await logTicketAction(ticketId, `Apontou ${timeSpentMinutes} minutos de trabalho`, userName);
  } catch (error) {
    console.error("Erro ao apontar horas:", error);
    throw error;
  }
};

export const subscribeToWorkLogs = (ticketId, callback) => {
  const q = query(
    collection(db, `${COLLECTION_NAME}/${ticketId}/workLogs`),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const logs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(logs);
  });
};

