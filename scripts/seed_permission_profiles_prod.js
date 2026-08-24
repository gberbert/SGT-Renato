/* eslint-disable no-console */
const PermissionService = require("../src/services/permissionService.js");
const { PermissionFunctionKeys } = require("../src/services/permissionKeys.js");

// This script assumes your runtime config (firebase.js -> db) already points to PROD.
// Run: node ./scripts/seed_permission_profiles_prod.js

const db = require("../src/firebase").db;

const COLLECTION = "permissionProfiles";

const roles = ["admin", "squad_leader", "user"];

function allFunctionKeys() {
  return Object.values(PermissionFunctionKeys);
}

async function main() {
  console.log("[seed_permission_profiles_prod] Starting...");

  const initPayloadByRole = {
    admin: {
      allowedFunctions: allFunctionKeys(),
    },
    squad_leader: {
      allowedFunctions: [],
    },
    user: {
      allowedFunctions: [],
    },
  };

  for (const role of roles) {
    const payload = {
      profileId: role,
      displayName: role,
      allowedFunctions: initPayloadByRole[role]?.allowedFunctions || [],
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    console.log(`[seed_permission_profiles_prod] Upserting permissionProfiles/${role}...`);

    // Use service helper if available, otherwise direct Firestore.
    if (PermissionService && typeof PermissionService.createOrUpdatePermissionProfile === "function") {
      await PermissionService.createOrUpdatePermissionProfile(role, payload);
    } else {
      const { doc, setDoc } = require("firebase/firestore");
      const ref = doc(db, COLLECTION, role);
      await setDoc(ref, payload, { merge: true });
    }
  }

  console.log("[seed_permission_profiles_prod] Done.");
}

main().catch((e) => {
  console.error("[seed_permission_profiles_prod] ERROR:", e);
  process.exit(1);
});
