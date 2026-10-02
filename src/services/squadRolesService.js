import { db } from '../firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';

const COLLECTION = 'squadRoles';

/**
 * Get all squad roles
 */
export async function getSquadRoles() {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching squad roles:', error);
    throw error;
  }
}

/**
 * Get a single squad role by ID
 */
export async function getSquadRole(roleId) {
  try {
    const docRef = doc(db, COLLECTION, roleId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error fetching squad role:', error);
    throw error;
  }
}

/**
 * Get roles for a specific squad
 */
export async function getSquadRolesBySquadId(squadId) {
  try {
    const q = query(collection(db, COLLECTION), where('squadId', '==', squadId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching squad roles for squad:', error);
    throw error;
  }
}

/**
 * Create a new squad role
 */
export async function createSquadRole(roleData) {
  try {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...roleData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { id: docRef.id, ...roleData };
  } catch (error) {
    console.error('Error creating squad role:', error);
    throw error;
  }
}

/**
 * Update a squad role
 */
export async function updateSquadRole(roleId, roleData) {
  try {
    const docRef = doc(db, COLLECTION, roleId);
    await updateDoc(docRef, {
      ...roleData,
      updatedAt: new Date(),
    });
    return { id: roleId, ...roleData };
  } catch (error) {
    console.error('Error updating squad role:', error);
    throw error;
  }
}

/**
 * Delete a squad role
 */
export async function deleteSquadRole(roleId) {
  try {
    await deleteDoc(doc(db, COLLECTION, roleId));
  } catch (error) {
    console.error('Error deleting squad role:', error);
    throw error;
  }
}

/**
 * Subscribe to squad roles in real-time
 */
export function subscribeToSquadRoles(callback) {
  try {
    return onSnapshot(collection(db, COLLECTION), snapshot => {
      const roles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(roles);
    });
  } catch (error) {
    console.error('Error subscribing to squad roles:', error);
    throw error;
  }
}

/**
 * Subscribe to roles for a specific squad in real-time
 */
export function subscribeToSquadRolesBySquadId(squadId, callback) {
  try {
    const q = query(collection(db, COLLECTION), where('squadId', '==', squadId));
    return onSnapshot(q, snapshot => {
      const roles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(roles);
    });
  } catch (error) {
    console.error('Error subscribing to squad roles:', error);
    throw error;
  }
}

/**
 * Save a squad role (create or update)
 */
export async function saveSquadRole(roleData) {
  try {
    if (roleData.id) {
      // Update existing role
      return await updateSquadRole(roleData.id, roleData);
    } else {
      // Create new role
      return await createSquadRole(roleData);
    }
  } catch (error) {
    console.error('Error saving squad role:', error);
    throw error;
  }
}
