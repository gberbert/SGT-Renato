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

export const updateUser = async (userId, data) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Erro ao atualizar usuário:", error);
    throw error;
  }
};

export const subscribeToSystems = (callback) => {
  const q = query(collection(db, 'systems'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const systems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(systems);
  });
};

export const saveSystem = async (systemData) => {
  try {
    if (systemData.id) {
      const docRef = doc(db, 'systems', systemData.id);
      await updateDoc(docRef, { ...systemData, updatedAt: serverTimestamp() });
    } else {
      await addDoc(collection(db, 'systems'), { ...systemData, createdAt: serverTimestamp() });
    }
  } catch (error) {
    console.error("Erro ao salvar sistema:", error);
    throw error;
  }
};

export const deleteSystem = async (systemId) => {
  try {
    await deleteDoc(doc(db, 'systems', systemId));
  } catch (error) {
    console.error("Erro ao excluir sistema:", error);
    throw error;
  }
};

export const subscribeToComponents = (callback) => {
  const q = query(collection(db, 'components'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const comps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(comps);
  });
};

export const saveComponent = async (compData) => {
  try {
    if (compData.id) {
      const docRef = doc(db, 'components', compData.id);
      await updateDoc(docRef, { ...compData, updatedAt: serverTimestamp() });
    } else {
      await addDoc(collection(db, 'components'), { ...compData, createdAt: serverTimestamp() });
    }
  } catch (error) {
    console.error("Erro ao salvar componente:", error);
    throw error;
  }
};

export const deleteComponent = async (compId) => {
  try {
    await deleteDoc(doc(db, 'components', compId));
  } catch (error) {
    console.error("Erro ao excluir componente:", error);
    throw error;
  }
};

export const subscribeToCustomFields = (callback) => {
  const q = query(collection(db, 'customFields'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const fields = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(fields);
  });
};

export const saveCustomField = async (fieldData) => {
  try {
    if (fieldData.id) {
      const docRef = doc(db, 'customFields', fieldData.id);
      await updateDoc(docRef, { ...fieldData, updatedAt: serverTimestamp() });
    } else {
      await addDoc(collection(db, 'customFields'), { ...fieldData, createdAt: serverTimestamp() });
    }
  } catch (error) {
    console.error("Erro ao salvar campo customizado:", error);
    throw error;
  }
};

export const deleteCustomField = async (fieldId) => {
  try {
    await deleteDoc(doc(db, 'customFields', fieldId));
  } catch (error) {
    console.error("Erro ao excluir campo customizado:", error);
    throw error;
  }
};

export const subscribeToAutomations = (callback) => {
  const q = query(collection(db, 'automations'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const autos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(autos);
  });
};

export const saveAutomation = async (automationData) => {
  try {
    if (automationData.id) {
      const docRef = doc(db, 'automations', automationData.id);
      await updateDoc(docRef, { ...automationData, updatedAt: serverTimestamp() });
    } else {
      await addDoc(collection(db, 'automations'), { ...automationData, createdAt: serverTimestamp() });
    }
  } catch (error) {
    console.error("Erro ao salvar automação:", error);
    throw error;
  }
};

export const deleteAutomation = async (autoId) => {
  try {
    await deleteDoc(doc(db, 'automations', autoId));
  } catch (error) {
    console.error("Erro ao excluir automação:", error);
    throw error;
  }
};


