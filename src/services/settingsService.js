import { collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const subscribeToTicketTypes = (callback) => {
  const q = query(collection(db, 'ticketTypes'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const types = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(types);
  });
};

export const saveTicketType = async (typeData) => {
  try {
    if (typeData.id) {
      const typeRef = doc(db, 'ticketTypes', typeData.id);
      await updateDoc(typeRef, {
        ...typeData,
        updatedAt: serverTimestamp()
      });
    } else {
      await addDoc(collection(db, 'ticketTypes'), {
        ...typeData,
        createdAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error("Erro ao salvar tipo de ticket:", error);
    throw error;
  }
};

export const deleteTicketType = async (typeId) => {
  try {
    await deleteDoc(doc(db, 'ticketTypes', typeId));
  } catch (error) {
    console.error("Erro ao excluir tipo de ticket:", error);
    throw error;
  }
};

export const subscribeToWorkflows = (callback) => {
  const q = query(collection(db, 'workflows'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const flows = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(flows);
  });
};

export const saveWorkflow = async (workflowData) => {
  try {
    if (workflowData.id) {
      const flowRef = doc(db, 'workflows', workflowData.id);
      await updateDoc(flowRef, {
        ...workflowData,
        updatedAt: serverTimestamp()
      });
    } else {
      await addDoc(collection(db, 'workflows'), {
        ...workflowData,
        createdAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error("Erro ao salvar workflow:", error);
    throw error;
  }
};

export const deleteWorkflow = async (workflowId) => {
  try {
    await deleteDoc(doc(db, 'workflows', workflowId));
  } catch (error) {
    console.error("Erro ao excluir workflow:", error);
    throw error;
  }
};

export const subscribeToUsers = (callback) => {
  const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(users);
  });
};

export const updateUserRole = async (userId, newRole) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { role: newRole });
  } catch (error) {
    console.error("Erro ao atualizar papel do usuário:", error);
    throw error;
  }
};
