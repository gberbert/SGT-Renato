import { collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase';

export const subscribeToSpecifications = (callback) => {
  const q = query(collection(db, 'specifications'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const specs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(specs);
  });
};

export const subscribeToEstimations = (callback) => {
  const q = query(collection(db, 'estimations'));
  return onSnapshot(q, (snapshot) => {
    const ests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(ests);
  });
};

export const saveSpecification = async (specData) => {
  try {
    if (specData.id) {
      const docRef = doc(db, 'specifications', specData.id);
      await updateDoc(docRef, { ...specData, updatedAt: serverTimestamp() });
    } else {
      await addDoc(collection(db, 'specifications'), { ...specData, createdAt: serverTimestamp() });
    }
  } catch (error) {
    console.error("Erro ao salvar especificação:", error);
    throw error;
  }
};

export const deleteSpecification = async (specId) => {
  try {
    await deleteDoc(doc(db, 'specifications', specId));
  } catch (error) {
    console.error("Erro ao excluir especificação:", error);
    throw error;
  }
};

export const updateEstimationPlanningStatus = async (estId, status, assignee) => {
  const ref = doc(db, 'estimations', estId);
  const updates = { planningStatus: status };
  if (assignee !== undefined) updates.assignee = assignee;
  await updateDoc(ref, updates);
};

export const updateSpecPlanningStatus = async (specId, status, assignee) => {
  const ref = doc(db, 'specifications', specId);
  const updates = { planningStatus: status };
  if (assignee !== undefined) {
    updates.assignee = assignee;
    updates.authorName = assignee; // Fallback so we don't break existing displays
  }
  await updateDoc(ref, updates);
};

export const updateEstimationExecutionStatus = async (estId, status) => {
  const ref = doc(db, 'estimations', estId);
  await updateDoc(ref, { executionStatus: status, updatedAt: new Date() });
};

export const updateSpecExecutionStatus = async (specId, status) => {
  const ref = doc(db, 'specifications', specId);
  await updateDoc(ref, { executionStatus: status, updatedAt: new Date() });
};
