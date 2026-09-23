import { db } from '../firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';

const CICLOS_COLLECTION = 'ciclos_planejamento';

export async function createCiclo({ nome, dataInicio, dataFim }) {
  return addDoc(collection(db, CICLOS_COLLECTION), {
    nome,
    dataInicio: dataInicio || null,
    dataFim: dataFim || null,
    status: 'planejamento',
    ticketKeys: [],
    createdAt: serverTimestamp(),
  });
}

export async function updateCiclo(id, patch) {
  return updateDoc(doc(db, CICLOS_COLLECTION, id), patch);
}

export async function deleteCiclo(id) {
  return deleteDoc(doc(db, CICLOS_COLLECTION, id));
}

export function subscribeToCiclos(cb) {
  const q = query(collection(db, CICLOS_COLLECTION), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

/**
 * Adiciona um ticket a um ciclo.
 * Se allCiclos for informado, remove o ticket de outros ciclos primeiro (evita duplicatas).
 * Usa arrayUnion para operação atômica — não precisa dos ticketKeys atuais.
 */
export async function addTicketToCiclo(cicloId, issueKey, allCiclos) {
  if (allCiclos) {
    const removals = allCiclos
      .filter((c) => c.id !== cicloId && (c.ticketKeys || []).includes(issueKey))
      .map((c) =>
        updateDoc(doc(db, CICLOS_COLLECTION, c.id), { ticketKeys: arrayRemove(issueKey) })
      );
    if (removals.length) await Promise.all(removals);
  }
  return updateDoc(doc(db, CICLOS_COLLECTION, cicloId), { ticketKeys: arrayUnion(issueKey) });
}

/**
 * Remove um ticket de um ciclo.
 * Usa arrayRemove para operação atômica — não precisa dos ticketKeys atuais.
 */
export async function removeTicketFromCiclo(cicloId, issueKey) {
  return updateDoc(doc(db, CICLOS_COLLECTION, cicloId), { ticketKeys: arrayRemove(issueKey) });
}
