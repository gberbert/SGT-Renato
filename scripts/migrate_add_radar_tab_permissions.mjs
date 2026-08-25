/* eslint-disable no-console */
/**
 * Migração: adiciona as novas permissões de abas do Radar Operação
 * (RADAR_GERAL_VIEW, RADAR_PROBLEMAS_VIEW, RADAR_DEMANDAS_TAB_VIEW,
 * RADAR_INCIDENTES_VIEW, RADAR_SOLICITACOES_VIEW, RADAR_CATALOGO_VIEW,
 * RADAR_EFICIENCIA_VIEW) a todos os perfis que já possuem RADAR_VIEW ou
 * ADMIN_ALL, preservando o comportamento atual (quem já via o Radar
 * continua vendo todas as abas após esta migração).
 *
 * Execução:
 *   node ./scripts/migrate_add_radar_tab_permissions.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";

import { PermissionFunctionKeys } from "../src/services/permissionKeys.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVICE_ACCOUNT_PATH = path.resolve(
  __dirname,
  "../Arquivos_Gerais/sgt-renato-firebase-adminsdk-fbsvc-2c3d1c9c2c.json"
);

const COLLECTION = "permissionProfiles";

const RADAR_TAB_KEYS = [
  PermissionFunctionKeys.RADAR_GERAL_VIEW,
  PermissionFunctionKeys.RADAR_PROBLEMAS_VIEW,
  PermissionFunctionKeys.RADAR_DEMANDAS_TAB_VIEW,
  PermissionFunctionKeys.RADAR_INCIDENTES_VIEW,
  PermissionFunctionKeys.RADAR_SOLICITACOES_VIEW,
  PermissionFunctionKeys.RADAR_CATALOGO_VIEW,
  PermissionFunctionKeys.RADAR_EFICIENCIA_VIEW,
];

async function main() {
  console.log("[migrate_add_radar_tab_permissions] Starting...");

  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    throw new Error(`Service account JSON não encontrado: ${SERVICE_ACCOUNT_PATH}`);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));
  const projectId = serviceAccount.project_id;

  const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId,
  });

  const db = getAdminFirestore(app, "default");
  const snap = await db.collection(COLLECTION).get();

  if (snap.empty) {
    console.log("[migrate_add_radar_tab_permissions] Nenhum perfil encontrado.");
    return;
  }

  let updatedCount = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data() || {};
    const allowed = Array.isArray(data.allowedFunctions) ? data.allowedFunctions : [];
    const allowedSet = new Set(allowed);

    const hadRadarAccess =
      allowedSet.has(PermissionFunctionKeys.RADAR_VIEW) ||
      allowedSet.has(PermissionFunctionKeys.ADMIN_ALL);

    if (!hadRadarAccess) {
      console.log(`[migrate_add_radar_tab_permissions] Pulando ${docSnap.id} (sem RADAR_VIEW/ADMIN_ALL).`);
      continue;
    }

    let changed = false;
    for (const key of RADAR_TAB_KEYS) {
      if (key && !allowedSet.has(key)) {
        allowedSet.add(key);
        changed = true;
      }
    }

    if (!changed) {
      console.log(`[migrate_add_radar_tab_permissions] ${docSnap.id} já possuía todas as chaves.`);
      continue;
    }

    await docSnap.ref.set(
      {
        allowedFunctions: Array.from(allowedSet),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    updatedCount += 1;
    console.log(`[migrate_add_radar_tab_permissions] Atualizado: ${docSnap.id}`);
  }

  console.log(`[migrate_add_radar_tab_permissions] Concluído. ${updatedCount} perfil(is) atualizado(s).`);
}

main().catch((e) => {
  console.error("[migrate_add_radar_tab_permissions] ERROR:", e);
  process.exit(1);
});
