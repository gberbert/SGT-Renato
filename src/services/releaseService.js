import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from '../firebase';

const RELEASES_COL = 'ciclo_releases';

/**
 * Subscribe to all releases ordered by createdAt desc.
 * Returns an unsubscribe function.
 */
export function subscribeToReleases(onData) {
  const q = query(collection(db, RELEASES_COL), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    () => {}
  );
}

/**
 * Create a new release.
 * @param {{ nome: string, ambiente: string, tipo: string, dataAlvo: string }} data
 */
export async function createRelease(data) {
  return addDoc(collection(db, RELEASES_COL), {
    nome: data.nome,
    ambiente: data.ambiente || null,
    tipo: data.tipo || null,
    dataAlvo: data.dataAlvo || null,
    janelas: [],
    createdAt: serverTimestamp(),
  });
}

/**
 * Update an existing release.
 */
export async function updateRelease(id, data) {
  return updateDoc(doc(db, RELEASES_COL, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a release.
 */
export async function deleteRelease(id) {
  return deleteDoc(doc(db, RELEASES_COL, id));
}

/**
 * Add a calendar entry (deploy window or CAB) to a release.
 * @param {string} releaseId
 * @param {{ tipo: 'deploy'|'cab', data: string, hora?: string, descricao?: string }} entry
 */
export async function addJanela(releaseId, entry) {
  const item = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    tipo: entry.tipo,
    data: entry.data,
    hora: entry.hora || null,
    descricao: entry.descricao || null,
  };
  return updateDoc(doc(db, RELEASES_COL, releaseId), {
    janelas: arrayUnion(item),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Remove a calendar entry from a release.
 * @param {string} releaseId
 * @param {object} entry  — must be the exact same object stored in the array
 */
export async function removeJanela(releaseId, entry) {
  return updateDoc(doc(db, RELEASES_COL, releaseId), {
    janelas: arrayRemove(entry),
    updatedAt: serverTimestamp(),
  });
}
