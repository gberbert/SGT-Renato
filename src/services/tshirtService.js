import { collection, doc, updateDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export const subscribeToTShirts = (callback) => {
  const q = query(collection(db, 't_shirts'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const tshirts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(tshirts);
  });
};

export const updateTShirt = async (id, data) => {
  try {
    const docRef = doc(db, 't_shirts', id);
    await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
  } catch (error) {
    console.error("Erro ao atualizar T-Shirt:", error);
    throw error;
  }
};

export const updateTShirtPlanningStatus = async (tshirtId, status, assignee) => {
  const ref = doc(db, 't_shirts', tshirtId);
  const updates = { planningStatus: status };
  if (assignee !== undefined) updates.assignee = assignee;
  await updateDoc(ref, updates);
};

export const updateTShirtExecutionStatus = async (tshirtId, status) => {
  const ref = doc(db, 't_shirts', tshirtId);
  await updateDoc(ref, { executionStatus: status, updatedAt: new Date() });
};
