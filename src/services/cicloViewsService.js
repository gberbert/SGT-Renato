/**
 * cicloViewsService.js
 * CRUD de visões salvas para a tela de Planejamento de Ciclos.
 * Armazena em Firestore: ciclo_views/{auto-id}
 * Cada documento:
 *   { name, isPrincipal, userId, createdAt, filters: { ... } }
 */

import {
  collection, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, serverTimestamp, doc, writeBatch,
} from 'firebase/firestore';
import { db, auth } from '../firebase';

const COL = 'ciclo_views';

/** Snapshot em tempo real das visões do usuário corrente */
export function subscribeToCicloViews(callback) {
  const uid = auth.currentUser?.uid;
  if (!uid) { callback([]); return () => {}; }

  const q = query(
    collection(db, COL),
    where('userId', '==', uid),
    orderBy('createdAt', 'asc'),
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, () => callback([]));
}

/** Serializa o estado de filtros (Sets → arrays) */
export function serializeFilters(state) {
  return {
    search: state.search ?? '',
    escopoFilter: [...(state.escopoFilter ?? [])],
    squadFilter: [...(state.squadFilter ?? [])],
    grupoSolucionadorFilter: [...(state.grupoSolucionadorFilter ?? [])],
    filaFilter: [...(state.filaFilter ?? [])],
    statusFilter: [...(state.statusFilter ?? [])],
    prioridadeFilter: [...(state.prioridadeFilter ?? [])],
    respDevFilter: [...(state.respDevFilter ?? [])],
    respTesteFilter: [...(state.respTesteFilter ?? [])],
    sistemasFilter: [...(state.sistemasFilter ?? [])],
    naturezaOperacaoFilter: [...(state.naturezaOperacaoFilter ?? [])],
    naturezaIniciativaFilter: [...(state.naturezaIniciativaFilter ?? [])],
    issuetypeFilter: [...(state.issuetypeFilter ?? [])],
    dateField: state.dateField ?? 'none',
    impedimentoFilter: state.impedimentoFilter ?? false,
    showEstimativa: state.showEstimativa ?? true,
  };
}

/** Desserializa de volta para o estado do componente (arrays → Sets) */
export function deserializeFilters(filters) {
  if (!filters) return null;
  return {
    search: filters.search ?? '',
    escopoFilter: new Set(filters.escopoFilter ?? []),
    squadFilter: new Set(filters.squadFilter ?? []),
    grupoSolucionadorFilter: new Set(filters.grupoSolucionadorFilter ?? []),
    filaFilter: new Set(filters.filaFilter ?? []),
    statusFilter: new Set(filters.statusFilter ?? []),
    prioridadeFilter: new Set(filters.prioridadeFilter ?? []),
    respDevFilter: new Set(filters.respDevFilter ?? []),
    respTesteFilter: new Set(filters.respTesteFilter ?? []),
    sistemasFilter: new Set(filters.sistemasFilter ?? []),
    naturezaOperacaoFilter: new Set(filters.naturezaOperacaoFilter ?? []),
    naturezaIniciativaFilter: new Set(filters.naturezaIniciativaFilter ?? []),
    issuetypeFilter: new Set(filters.issuetypeFilter ?? []),
    dateField: filters.dateField ?? 'none',
    impedimentoFilter: filters.impedimentoFilter ?? false,
    showEstimativa: filters.showEstimativa ?? true,
  };
}

/** Salva uma nova visão */
export async function saveCicloView(name, filterState, isPrincipal = false) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Usuário não autenticado');

  const batch = writeBatch(db);

  // Se for principal, remove o flag de outras visões do mesmo usuário
  if (isPrincipal) {
    const snap = await import('firebase/firestore').then(({ getDocs, query: q2, collection: c2, where: w2 }) =>
      getDocs(q2(c2(db, COL), w2('userId', '==', uid), w2('isPrincipal', '==', true)))
    );
    snap.docs.forEach(d => batch.update(d.ref, { isPrincipal: false }));
  }

  const ref = doc(collection(db, COL));
  batch.set(ref, {
    name,
    isPrincipal,
    userId: uid,
    createdAt: serverTimestamp(),
    filters: serializeFilters(filterState),
  });

  await batch.commit();
}

/** Remove uma visão */
export async function deleteCicloView(viewId) {
  await deleteDoc(doc(db, COL, viewId));
}

/** Marca/desmarca uma visão como principal (e remove das demais) */
export async function setPrincipalView(viewId, userId) {
  const { getDocs, query: q2, collection: c2, where: w2 } = await import('firebase/firestore');
  const snap = await getDocs(q2(c2(db, COL), w2('userId', '==', userId), w2('isPrincipal', '==', true)));
  const batch = writeBatch(db);
  snap.docs.forEach(d => { if (d.id !== viewId) batch.update(d.ref, { isPrincipal: false }); });
  batch.update(doc(db, COL, viewId), { isPrincipal: true });
  await batch.commit();
}
