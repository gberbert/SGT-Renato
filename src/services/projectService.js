import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const projectsCollection = collection(db, 'projects');

export const createProject = async (projectData) => {
  try {
    const docRef = await addDoc(projectsCollection, {
      ...projectData,
      createdAt: serverTimestamp(),
      status: projectData.status || 'Ativo',
    });
    return docRef.id;
  } catch (error) {
    console.error("Erro ao criar projeto:", error);
    throw error;
  }
};

export const subscribeToProjects = (callback, onError) => {
  const q = query(projectsCollection, orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const projects = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(projects);
  }, onError);
};
