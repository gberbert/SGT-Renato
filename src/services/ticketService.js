import { collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

const COLLECTION_NAME = 'tickets';

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

export const createTicket = async (ticketData) => {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...ticketData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return docRef.id;
  } catch (error) {
    console.error("Erro ao criar ticket:", error);
    throw error;
  }
};

export const updateTicketStatus = async (ticketId, newStatusId) => {
  try {
    const ticketRef = doc(db, COLLECTION_NAME, ticketId);
    await updateDoc(ticketRef, {
      columnId: newStatusId,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error("Erro ao atualizar status:", error);
    throw error;
  }
};
