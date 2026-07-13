import { collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../firebase';

const squadsCollection = collection(db, 'squads');

export const createSquad = async (squadData) => {
  try {
    const docRef = await addDoc(squadsCollection, {
      ...squadData,
      createdAt: serverTimestamp(),
      users: squadData.users || [], // Array of user IDs
    });
    return docRef.id;
  } catch (error) {
    console.error("Erro ao criar squad:", error);
    throw error;
  }
};

export const subscribeToProjectSquads = (projectId, callback, onError) => {
  if (projectId === undefined) {
    return () => {};
  }
  const q = projectId === 'all' 
    ? query(squadsCollection, orderBy('createdAt', 'desc'))
    : query(squadsCollection, where('projectId', '==', projectId));
  
  return onSnapshot(q, (snapshot) => {
    const squads = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    // Sort client-side if we didn't index orderBy on firebase
    squads.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.seconds - a.createdAt.seconds;
    });
    callback(squads);
  }, onError);
};

export const updateSquad = async (squadId, updates) => {
  try {
    const squadRef = doc(db, 'squads', squadId);
    await updateDoc(squadRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Erro ao atualizar squad:", error);
    throw error;
  }
};

export const deleteSquad = async (squadId) => {
  try {
    const squadRef = doc(db, 'squads', squadId);
    await deleteDoc(squadRef);
  } catch (error) {
    console.error("Erro ao excluir squad:", error);
    throw error;
  }
};
