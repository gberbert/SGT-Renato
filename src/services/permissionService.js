import { collection, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

const COLLECTION = "permissionProfiles";

const CACHE_TTL_MS = 60_000;
let cache = new Map(); // key => { value, at }

/**
 * @param {string} profileId
 */
export async function getPermissionProfile(profileId) {
  if (!profileId) return null;

  const cached = cache.get(profileId);
  const now = Date.now();
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.value;

  const ref = doc(db, COLLECTION, profileId);
  const snap = await getDoc(ref);
  const value = snap.exists() ? snap.data() : null;

  cache.set(profileId, { value, at: now });
  return value;
}

/**
 * @param {string} profileId
 * @param {object} payload
 */
export async function createOrUpdatePermissionProfile(profileId, payload) {
  if (!profileId) throw new Error("permissionProfileId é obrigatório");
  if (!payload || typeof payload !== "object") throw new Error("payload inválido");

  const ref = doc(db, COLLECTION, profileId);
  await setDoc(ref, payload, { merge: true });

  // invalida cache
  cache.delete(profileId);
}

/**
 * SECOPS: controle por funcionalidade (functionKey)
 * @param {string} profileId
 * @param {string} functionKey
 */
export async function userHasFunctionPermission(profileId, functionKey) {
  if (!profileId || !functionKey) return false;

  const profile = await getPermissionProfile(profileId);
  const allowed = Array.isArray(profile?.allowedFunctions) ? profile.allowedFunctions : [];
  return allowed.includes(functionKey);
}

/**
 * Helper para criar “perfil padrão” se não existir.
 * Útil para rodar local e garantir que UI/guards tenham base.
 */
export async function ensurePermissionProfileExists(profileId, defaultPayload) {
  const profile = await getPermissionProfile(profileId);
  if (profile) return;

  await createOrUpdatePermissionProfile(profileId, {
    profileId,
    displayName: profileId,
    allowedFunctions: [],
    ...defaultPayload,
  });
}
