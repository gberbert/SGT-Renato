import { collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export const subscribeToTechSpecs = (callback) => {
  const q = query(collection(db, 'tech_specifications'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const specs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(specs);
  });
};

export const saveTechSpecification = async (specData) => {
  try {
    if (specData.id) {
      const docRef = doc(db, 'tech_specifications', specData.id);
      await updateDoc(docRef, { ...specData, updatedAt: serverTimestamp() });
    } else {
      await addDoc(collection(db, 'tech_specifications'), { ...specData, createdAt: serverTimestamp() });
    }
  } catch (error) {
    console.error("Erro ao salvar especificação técnica:", error);
    throw error;
  }
};

export const deleteTechSpecification = async (specId) => {
  try {
    await deleteDoc(doc(db, 'tech_specifications', specId));
  } catch (error) {
    console.error("Erro ao excluir especificação técnica:", error);
    throw error;
  }
};

export const updateTechSpecPlanningStatus = async (specId, status, assignee) => {
  const ref = doc(db, 'tech_specifications', specId);
  const updates = { planningStatus: status };
  if (assignee !== undefined) {
    updates.assignee = assignee;
    updates.authorName = assignee;
  }
  await updateDoc(ref, updates);
};

export const updateTechSpecExecutionStatus = async (specId, status) => {
  const ref = doc(db, 'tech_specifications', specId);
  await updateDoc(ref, { executionStatus: status, updatedAt: new Date() });
};
