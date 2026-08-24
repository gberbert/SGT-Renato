/* eslint-disable no-console */
/**
 * Seed/Upsert permissionProfiles no Firestore via REST API
 * (não depende de firebase client nem de databaseId no Admin SDK).
 *
 * Execução:
 *   node ./scripts/seed_permission_profiles_prod_rest.mjs
 *
 * Observação:
 * - assume service account correto para o projeto PROD
 * - databaseId configurado como "default"
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVICE_ACCOUNT_PATH = path.resolve(
  __dirname,
  "../Arquivos_Gerais/sgt-renato-firebase-adminsdk-fbsvc-2c3d1c9c2c.json"
);

const PROJECT_ID = "sgt-renato";
const DATABASE_ID = "default";

const COLLECTION = "permissionProfiles";
const roles = ["admin", "squad_leader", "user"];

function allFunctionKeys(PermissionFunctionKeys) {
  return Object.values(PermissionFunctionKeys || {});
}

async function getAccessTokenFromServiceAccount(serviceAccount) {
  // Se existe "private_key" e "client_email", usamos JWT para obter access_token
  const { default: googleAuth } = await import("google-auth-library");
  const { JWT } = googleAuth;

  const jwtClient = new JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ["https://www.googleapis.com/auth/datastore"],
  });

  const { access_token } = await jwtClient.getAccessToken();
  if (!access_token) throw new Error("Falha ao obter access_token");
  return access_token;
}

async function main() {
  console.log("[seed_permission_profiles_prod_rest] Starting...");

  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    throw new Error(`Service account JSON não encontrado: ${SERVICE_ACCOUNT_PATH}`);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));

  const PermissionKeysMod = await import("../src/services/permissionKeys.js");
  const PermissionFunctionKeys = PermissionKeysMod?.default?.PermissionFunctionKeys
    ? PermissionKeysMod.default.PermissionFunctionKeys
    : PermissionKeysMod?.default || PermissionKeysMod.PermissionFunctionKeys || PermissionKeysMod;

  const allKeys = allFunctionKeys(PermissionFunctionKeys);
  const initPayloadByRole = {
    admin: { allowedFunctions: allKeys },
    squad_leader: { allowedFunctions: [] },
    user: { allowedFunctions: [] },
  };

  const accessToken = await getAccessTokenFromServiceAccount(serviceAccount);

  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    PROJECT_ID
  )}/databases/${encodeURIComponent(DATABASE_ID)}/documents`;

  for (const role of roles) {
    const payload = {
      fields: {
        profileId: { stringValue: role },
        displayName: { stringValue: role },
        allowedFunctions: { arrayValue: { values: (initPayloadByRole[role]?.allowedFunctions || []).map((k) => ({ stringValue: k })) } },
        updatedAt: { stringValue: new Date().toISOString() },
        createdAt: { stringValue: new Date().toISOString() },
      },
    };

    const url = `${base}/${encodeURIComponent(COLLECTION)}/${encodeURIComponent(role)}?currentDocument.exists=true&updateMask.fieldPaths=allowedFunctions,profileId,displayName,updatedAt,createdAt`;

    // Se o doc não existir, cria via "create" (sem updateMask)
    try {
      console.log(`[seed_permission_profiles_prod_rest] Upserting ${COLLECTION}/${role} (update)...`);
      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        // Se não existir, cai para create
        if (res.status !== 404) {
          throw new Error(`HTTP ${res.status}: ${text}`);
        }
      } else {
        continue;
      }
    } catch (e) {
      // tenta create
    }

    console.log(`[seed_permission_profiles_prod_rest] Creating ${COLLECTION}/${role}...`);
    const createUrl = `${base}/${encodeURIComponent(COLLECTION)}/${encodeURIComponent(role)}`;
    const res2 = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields: payload.fields }),
    });

    if (!res2.ok) {
      const text2 = await res2.text().catch(() => "");
      throw new Error(`Create failed HTTP ${res2.status}: ${text2}`);
    }
  }

  console.log("[seed_permission_profiles_prod_rest] Done.");
}

main().catch((e) => {
  console.error("[seed_permission_profiles_prod_rest] ERROR:", e);
  process.exit(1);
});
