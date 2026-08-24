/* eslint-disable no-console */
/**
 * Seed/Upsert permissionProfiles no Firestore usando Firebase Admin SDK
 * (evita dependências de "navigator" no Node).
 *
 * Execução:
 *   node ./scripts/seed_permission_profiles_prod_admin.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

import { PermissionFunctionKeys } from "../src/services/permissionKeys.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVICE_ACCOUNT_PATH = path.resolve(
  __dirname,
  "../Arquivos_Gerais/sgt-renato-firebase-adminsdk-fbsvc-2c3d1c9c2c.json"
);

const COLLECTION = "permissionProfiles";
const roles = ["admin", "squad_leader", "user"];

function allFunctionKeys() {
  return Object.values(PermissionFunctionKeys || {});
}

async function main() {
  console.log("[seed_permission_profiles_prod_admin] Starting...");

  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    throw new Error(`Service account JSON não encontrado: ${SERVICE_ACCOUNT_PATH}`);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));

  const projectId = serviceAccount.project_id;

  console.log("[seed_permission_profiles_prod_admin] serviceAccount.project_id =", projectId);

  // Firestore pode usar databaseId diferente de "(default)" dependendo do setup.
  // Tentamos "(default)" e também "default" como fallback via retry manual.
  const requestedDatabaseId =
    process.env.FIRESTORE_DATABASE_ID ||
    "(default)";

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId,
  });

  async function getFirestore(databaseId) {
    const fsdb = admin.firestore({ databaseId });
    return fsdb;
  }

  let db;
  try {
    console.log("[seed_permission_profiles_prod_admin] Trying firestore databaseId =", requestedDatabaseId);
    db = await getFirestore(requestedDatabaseId);
    // Quick ping: listar 1 doc de collection (write-batch falhava; leitura tende a expor o databaseId errado)
    // Não usamos query complexa pra evitar custo.
    await db.collection(COLLECTION).limit(1).get();
  } catch (e) {
    const fallback = "default";
    console.log("[seed_permission_profiles_prod_admin] databaseId falhou, fallback =", fallback, "error:", e?.message);
    db = await getFirestore(fallback);
  }

  const initPayloadByRole = {
    admin: { allowedFunctions: allFunctionKeys() },
    squad_leader: { allowedFunctions: [] },
    user: { allowedFunctions: [] },
  };

  for (const role of roles) {
    const payload = {
      profileId: role,
      displayName: role,
      allowedFunctions: initPayloadByRole[role]?.allowedFunctions || [],
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    console.log(`[seed_permission_profiles_prod_admin] Upserting permissionProfiles/${role}...`);
    await db.collection(COLLECTION).doc(role).set(payload, { merge: true });
  }

  console.log("[seed_permission_profiles_prod_admin] Done.");
}

main().catch((e) => {
  console.error("[seed_permission_profiles_prod_admin] ERROR:", e);
  process.exit(1);
});
