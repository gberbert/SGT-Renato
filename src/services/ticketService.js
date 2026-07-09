import { collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDoc, setDoc, getDocs, where } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../firebase';
import { createNotification } from './notificationService';

const COLLECTION_NAME = 'tickets';
const USERS_COLLECTION = 'users';

export const extractMentionsAndNotify = async (htmlContent, actionText, ticketId, ticketTitle) => {
  if (!htmlContent) return;
  
  const parser = new DOMParser();
  const docHtml = parser.parseFromString(htmlContent, 'text/html');
  const mentionNodes = docHtml.querySelectorAll('[data-type="mention"]');
  const userIds = [...new Set(Array.from(mentionNodes).map(n => n.getAttribute('data-id')).filter(Boolean))];
  
  const currentUserUid = auth?.currentUser?.uid;
  const userName = auth?.currentUser?.displayName || 'Sistema';

  let rawText = htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  let textSnippet = rawText.length > 50 ? rawText.substring(0, 50) + '...' : rawText;
  
  if (userIds.includes('todos')) {
    try {
      const usersSnap = await getDocs(collection(db, USERS_COLLECTION));
      usersSnap.forEach(doc => {
        userIds.push(doc.id);
      });
    } catch (err) {
      console.error("Erro ao buscar usuários para @todos", err);
    }
  }

  const uniqueUserIds = [...new Set(userIds)].filter(id => id !== 'todos' && id !== currentUserUid);

  for (const uid of uniqueUserIds) {
      await createNotification(
        uid, 
        `Novo mention: ${ticketTitle || 'Ticket'}`, 
        `${userName} ${actionText}`, 
        ticketId,
        {
          senderName: userName,
          ticketTitle: ticketTitle || 'Ticket',
          textSnippet: textSnippet
        }
      );
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

export const getTicketById = async (ticketId) => {
  if (!ticketId) return null;
  try {
    const ticketRef = doc(db, COLLECTION_NAME, ticketId);
    const snap = await getDoc(ticketRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }
    return null;
  } catch (error) {
    console.error("Erro ao buscar ticket por id:", error);
    return null;
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
    // Descrição não gera mais notificação (transferido para o chat)
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
    // Descrição não gera mais notificação (transferido para o chat)
  } catch (error) {
    console.error("Erro ao atualizar ticket:", error);
    throw error;
  }
};

export const deleteTicket = async (ticketId, userName = 'Sistema') => {
  try {
    const ticketRef = doc(db, COLLECTION_NAME, ticketId);
    await deleteDoc(ticketRef);
  } catch (error) {
    console.error("Erro ao excluir ticket:", error);
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
      const ticketRef = doc(db, COLLECTION_NAME, ticketId);
      const currentTicket = (await getDoc(ticketRef)).data();
      await extractMentionsAndNotify(
        commentData.text,
        'mencionou você em um comentário.',
        ticketId,
        currentTicket?.title || ticketId
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
    orderBy('createdAt', 'asc')
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

export const subscribeToEstimationsByTicketId = (ticketId, callback) => {
  const q = query(
    collection(db, 'estimations'),
    where('ticketId', '==', ticketId)
  );
  
  return onSnapshot(q, (snapshot) => {
    const estimations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(estimations);
  });
};

