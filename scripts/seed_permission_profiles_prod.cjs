/* eslint-disable no-console */
const PermissionServiceMod = await import("../src/services/permissionService.js");
const PermissionKeysMod = await import("../src/services/permissionKeys.js");
const firebaseMod = await import("../src/firebase.js");

const PermissionService = PermissionServiceMod?.default || PermissionServiceMod;
const { PermissionFunctionKeys } = PermissionKeysMod?.default ? PermissionKeysMod.default : PermissionKeysMod;

const db = firebaseMod.db;

const COLLECTION = "permissionProfiles";
const roles = ["admin", "squad_leader", "user"];

function allFunctionKeys() {
  return Object.values(PermissionFunctionKeys || {});
}

async function main() {
  console.log("[seed_permission_profiles_prod] Starting...");

  const initPayloadByRole = {
    admin: { allowedFunctions: allFunctionKeys() },
    squad_leader: { allowedFunctions: [] },
    user: { allowedFunctions: [] },
  };

  // Prefer service helper if it exists
  const createOrUpdate = PermissionService?.createOrUpdatePermissionProfile;

  for (const role of roles) {
    const payload = {
      profileId: role,
      displayName: role,
      allowedFunctions: (initPayloadByRole[role] && initPayloadByRole[role].allowedFunctions) || [],
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    console.log(`[seed_permission_profiles_prod] Upserting permissionProfiles/${role}...`);

    if (typeof createOrUpdate === "function") {
      await createOrUpdate(role, payload);
      continue;
    }

    // Fallback direct Firestore write
    const { doc, setDoc } = await import("firebase/firestore");
    const ref = doc(db, COLLECTION, role);
    await setDoc(ref, payload, { merge: true });
  }

  console.log("[seed_permission_profiles_prod] Done.");
}

main().catch((e) => {
  console.error("[seed_permission_profiles_prod] ERROR:", e);
  process.exit(1);
});
