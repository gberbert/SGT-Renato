import { collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

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

export const updateProject = async (projectId, updates) => {
  try {
    const projectRef = doc(db, 'projects', projectId);
    await updateDoc(projectRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Erro ao atualizar projeto:", error);
    throw error;
  }
};

export const uploadProjectLogo = (projectId, file, type) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }
    const fileExtension = file.name.split('.').pop();
    const filePath = `projects/${projectId}/${type}_${Date.now()}.${fileExtension}`;
    const storageRef = ref(storage, filePath);
    
    const uploadTask = uploadBytesResumable(storageRef, file);
    
    uploadTask.on('state_changed',
      (snapshot) => {
        // Opcional: acompanhar progresso
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log(`Upload ${type} está ${progress}% concluído`);
      },
      (error) => {
        console.error(`Erro no uploadTask (${type}):`, error);
        reject(error);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        } catch (err) {
          console.error(`Erro ao obter URL de download (${type}):`, err);
          reject(err);
        }
      }
    );
  });
};

export const updateProjectMembers = async (projectId, membersMap) => {
  try {
    const projectRef = doc(db, 'projects', projectId);
    await updateDoc(projectRef, {
      members: membersMap,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Erro ao atualizar acessos do projeto:", error);
    throw error;
  }
};

export const deleteProject = async (projectId) => {
  try {
    const projectRef = doc(db, 'projects', projectId);
    await deleteDoc(projectRef);
  } catch (error) {
    console.error("Erro ao excluir projeto:", error);
    throw error;
  }
};
