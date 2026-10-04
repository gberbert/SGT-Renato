import { collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, setDoc, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
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
  
  // Subscribe to users
  const unsubscribeUsers = onSnapshot(q, (userSnapshot) => {
    const users = userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Subscribe to squadroles to enrich user data
    const squadRolesQ = query(collection(db, 'squadroles'));
    const unsubscribeSquadRoles = onSnapshot(squadRolesQ, (rolesSnapshot) => {
      const squadRolesMap = new Map();
      const userSquadRolesMap = new Map(); // Para múltiplos papéis por usuário
      
      rolesSnapshot.docs.forEach(doc => {
        const roleData = doc.data();
        if (roleData.userId) {
          const roleEntry = {
            squadId: roleData.squadId,
            squad: roleData.squad,
            squadRole: roleData.role || roleData.roleName || roleData.papelNaSquad,
            squadRoleId: doc.id
          };
          
          // Manter a primeira entrada para compatibilidade (single role)
          if (!squadRolesMap.has(roleData.userId)) {
            squadRolesMap.set(roleData.userId, roleEntry);
          }
          
          // Manter lista de todos os papéis do usuário
          if (!userSquadRolesMap.has(roleData.userId)) {
            userSquadRolesMap.set(roleData.userId, []);
          }
          userSquadRolesMap.get(roleData.userId).push(roleEntry);
        }
      });
      
      // Enrich users with squad role data
      const enrichedUsers = users.map(user => ({
        ...user,
        ...(squadRolesMap.get(user.id) || {}),
        squadRoles: userSquadRolesMap.get(user.id) || [] // Adicionar lista de todos os papéis
      }));
      
      callback(enrichedUsers);
    });
    
    return () => unsubscribeSquadRoles();
  });
  
  return unsubscribeUsers;
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

export const createUser = async (userData) => {
  try {
    if (userData.id) {
      await setDoc(doc(db, 'users', userData.id), {
        ...userData,
        createdAt: serverTimestamp(),
        role: userData.role || 'user'
      });
      return userData.id;
    } else {
      const docRef = await addDoc(collection(db, 'users'), {
        ...userData,
        createdAt: serverTimestamp(),
        role: userData.role || 'user'
      });
      return docRef.id;
    }
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    throw error;
  }
};

export const deleteUser = async (userId) => {
  try {
    await deleteDoc(doc(db, 'users', userId));
  } catch (error) {
    console.error("Erro ao excluir usuário:", error);
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

// AI Integration Settings
export const subscribeToAISettings = (callback) => {
  const docRef = doc(db, 'systemSettings', 'aiIntegration');
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() });
    } else {
      callback(null);
    }
  });
};

export const saveAISettings = async (settingsData) => {
  try {
    const docRef = doc(db, 'systemSettings', 'aiIntegration');
    await setDoc(docRef, {
      ...settingsData,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Erro ao salvar configurações de IA:", error);
    throw error;
  }
};

// Squad Roles Management
export const subscribeToSquadRoles = (callback) => {
  // orderBy('order') já exclui docs sem campo order; o filtro .name garante
  // que docs de assignment (userId/squadId) não apareçam como definições.
  const q = query(collection(db, 'squadroles'), orderBy('order', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const roles = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(r => r.name); // apenas docs de definição de papel
    callback(roles);
  });
};

export const saveSquadRole = async (roleData) => {
  try {
    if (roleData.id) {
      const docRef = doc(db, 'squadroles', roleData.id);
      const updatePayload = {
        name: roleData.name,
        description: roleData.description,
        updatedAt: serverTimestamp()
      };
      // Preserva order quando passado explicitamente (ex: reordenação)
      if (roleData.order !== undefined) {
        updatePayload.order = roleData.order;
      }
      await updateDoc(docRef, updatePayload);
    } else {
      // Calcular nextOrder contando apenas docs de definição (têm campo name)
      const allSnap = await getDocs(collection(db, 'squadroles'));
      const defCount = allSnap.docs.filter(d => d.data().name).length;
      const nextOrder = defCount + 1;

      await addDoc(collection(db, 'squadroles'), {
        name: roleData.name,
        description: roleData.description || '',
        order: nextOrder,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error("Erro ao salvar papel de squad:", error);
    throw error;
  }
};

export const deleteSquadRole = async (roleId) => {
  try {
    await deleteDoc(doc(db, 'squadroles', roleId));
  } catch (error) {
    console.error("Erro ao excluir papel de squad:", error);
    throw error;
  }
};

// Seed Squad Roles from Cloud Function
export const seedSquadRoles = async () => {
  try {
    const functions = getFunctions();
    const seedSquadRolesCallable = httpsCallable(functions, 'seedSquadRoles');
    const result = await seedSquadRolesCallable();
    return result.data;
  } catch (error) {
    console.error("Erro ao seedear papéis de squad:", error);
    throw error;
  }
};
