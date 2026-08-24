/* eslint-disable no-console */

const COLLECTION = "permissionProfiles";
const roles = ["admin", "squad_leader", "user"];

async function main() {
  console.log("[seed_permission_profiles_prod_direct] Starting...");

  const firebaseMod = await import("../src/firebase.js");
  const PermissionKeysMod = await import("../src/services/permissionKeys.js");

  const db = firebaseMod.db;
  const PermissionFunctionKeys = PermissionKeysMod?.default ? PermissionKeysMod.default : PermissionKeysMod.PermissionFunctionKeys || PermissionKeysMod;

  const { doc, setDoc } = await import("firebase/firestore");

  const allKeys = Object.values(PermissionFunctionKeys || {});

  const initPayloadByRole = {
    admin: { allowedFunctions: allKeys },
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

    console.log(`[seed_permission_profiles_prod_direct] Upserting permissionProfiles/${role}...`);
    const ref = doc(db, COLLECTION, role);
    await setDoc(ref, payload, { merge: true });
  }

  console.log("[seed_permission_profiles_prod_direct] Done.");
}

main().catch((e) => {
  console.error("[seed_permission_profiles_prod_direct] ERROR:", e);
  process.exit(1);
});
