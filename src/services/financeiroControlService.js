import { db, auth } from '../firebase';
import { doc, getDoc, setDoc, onSnapshot, collection, addDoc, serverTimestamp } from 'firebase/firestore';

const CONTROL_DOC = 'settings/financeiro_control';
const SNAPSHOTS_COL = 'financeiro_snapshots';
const DEFAULT_PASSWORD = 'Fin@SGT2026';

/** Ensure the control document exists with defaults */
export async function ensureControlDoc() {
  const ref = doc(db, 'settings', 'financeiro_control');
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      isClosed: false,
      password: DEFAULT_PASSWORD,
      closedAt: null,
      closedBy: null,
      openedAt: null,
      openedBy: null,
      createdAt: serverTimestamp(),
    });
  }
  return snap.exists() ? snap.data() : { isClosed: false, password: DEFAULT_PASSWORD };
}

/** Subscribe to control state */
export function subscribeToControl(callback) {
  const ref = doc(db, 'settings', 'financeiro_control');
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) callback(snap.data());
    else callback({ isClosed: false, password: DEFAULT_PASSWORD });
  }, () => callback({ isClosed: false, password: DEFAULT_PASSWORD }));
}

/** Validate password against stored value */
export async function validatePassword(inputPassword) {
  const ref = doc(db, 'settings', 'financeiro_control');
  const snap = await getDoc(ref);
  if (!snap.exists()) return inputPassword === DEFAULT_PASSWORD;
  return snap.data().password === inputPassword;
}

/** Close the financial control — saves snapshot + updates state */
export async function closeControl(months, rows, projectCodeOptions, exportExpenses, exportRevenue) {
  const userName = auth.currentUser?.displayName || auth.currentUser?.email || 'Usuário';
  const periodKey = months[0]?.ps?.slice(0, 7) || new Date().toISOString().slice(0, 7);

  // Save snapshot
  const snapshotData = {
    period: periodKey,
    months: months.map(m => ({ ps: m.ps, pe: m.pe, label: m.label })),
    closedAt: serverTimestamp(),
    closedBy: userName,
    rows: rows.map(r => ({
      member: r.user?.displayName || r.user?.name || r.id,
      projectCode: r.user?.projectCode || '',
      contract: r.user?.contract || '',
      csrRate: r.csrRate,
      monthHours: r.monthHours,
      monthValues: r.monthValues,
      total: r.total,
      totalValue: r.totalValue,
    })),
    projectCodes: projectCodeOptions,
  };

  await addDoc(collection(db, SNAPSHOTS_COL), snapshotData);

  // Update control state
  await setDoc(doc(db, 'settings', 'financeiro_control'), {
    isClosed: true,
    closedAt: serverTimestamp(),
    closedBy: userName,
    snapshotPeriod: periodKey,
  }, { merge: true });
}

/** Open the financial control */
export async function openControl() {
  const userName = auth.currentUser?.displayName || auth.currentUser?.email || 'Usuário';
  await setDoc(doc(db, 'settings', 'financeiro_control'), {
    isClosed: false,
    openedAt: serverTimestamp(),
    openedBy: userName,
  }, { merge: true });
}
