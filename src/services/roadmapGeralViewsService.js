import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';

const COLLECTION = 'roadmap_geral_views';

/**
 * Busca as visões salvas do usuário atual (por uid), ordenadas pela data de criação.
 */
export async function fetchRoadmapGeralViews(uid) {
  if (!uid) return [];
  const q = query(collection(db, COLLECTION), where('ownerUid', '==', uid), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Cria uma nova visão salva (filtros + agrupamento + granularidade) para o usuário.
 */
export async function saveRoadmapGeralView(uid, payload) {
  if (!uid) throw new Error('Usuário não autenticado.');
  const id = `${uid}_${Date.now()}`;
  const ref = doc(db, COLLECTION, id);
  await setDoc(ref, {
    ownerUid: uid,
    name: payload.name,
    filters: payload.filters,
    groupBy: payload.groupBy,
    granularity: payload.granularity,
    createdAt: serverTimestamp(),
  });
  return id;
}

/**
 * Remove uma visão salva pelo id do documento.
 */
export async function deleteRoadmapGeralView(id) {
  if (!id) return;
  await deleteDoc(doc(db, COLLECTION, id));
}
