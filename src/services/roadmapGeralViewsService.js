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
    dateConfig: payload.dateConfig || null,
    isPrimary: payload.isPrimary || false,
    createdAt: serverTimestamp(),
  });
  return id;
}

/**
 * Marca uma visão como primária e desmarca todas as outras do mesmo usuário.
 */
export async function setPrimaryRoadmapGeralView(uid, viewId) {
  if (!uid) return;
  const q = query(collection(db, COLLECTION), where('ownerUid', '==', uid));
  const snap = await getDocs(q);
  const batch = [];
  for (const d of snap.docs) {
    const shouldBePrimary = d.id === viewId;
    if (d.data().isPrimary !== shouldBePrimary) {
      batch.push(setDoc(doc(db, COLLECTION, d.id), { isPrimary: shouldBePrimary }, { merge: true }));
    }
  }
  if (batch.length) await Promise.all(batch);
}

/**
 * Atualiza uma visão salva existente (sobrescreve filtros/agrupamento/granularidade/dateConfig).
 */
export async function updateRoadmapGeralView(id, payload) {
  if (!id) throw new Error('id da visão é obrigatório.');
  const ref = doc(db, COLLECTION, id);
  await setDoc(
    ref,
    {
      name: payload.name,
      filters: payload.filters,
      groupBy: payload.groupBy,
      granularity: payload.granularity,
      dateConfig: payload.dateConfig,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Remove uma visão salva pelo id do documento.
 */
export async function deleteRoadmapGeralView(id) {
  if (!id) return;
  await deleteDoc(doc(db, COLLECTION, id));
}
