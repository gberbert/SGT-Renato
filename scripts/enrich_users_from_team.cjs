/**
 * Enriquecer collection "users" a partir de "team" usando "email" como chave.
 * Regra: não sobrescrever "email" e "displayName"; apenas preencher campos vazios.
 *
 * Campos copiados (somente estes):
 *   cidade, contrato, dataInicio, dataNascimento, foundation,
 *   perfilNTT, perfilRatecard, senioridade, status, uf
 *
 * Execução:
 *   node scripts/enrich_users_from_team.js
 *
 * Observação:
 * - Requer credenciais Firebase em runtime (ex.: via firebase admin sdk com arquivo no repo)
 */

const admin = require("firebase-admin");
const path = require("path");

async function main() {
  // Ajuste para apontar ao service account se estiver no repo.
  // O projeto já usa Arquivos_Gerais/sgt-renato-firebase-adminsdk-*.json.
  // Você pode trocar manualmente o caminho do arquivo aqui.
  const saPath = path.join(
    __dirname,
    "..",
    "Arquivos_Gerais",
    "sgt-renato-firebase-adminsdk-fbsvc-2c3d1c9c2c.json"
  );

  const serviceAccount = require(saPath);
  const projectIdFromSa = serviceAccount.project_id || serviceAccount.projectId;
  const databaseURL = `https://firestore.googleapis.com/v1/projects/${projectIdFromSa}/databases/(default)`;

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: projectIdFromSa,
    databaseURL,
  });

  console.log("[admin] projectIdFromSa:", projectIdFromSa);
  console.log("[admin] databaseURL:", databaseURL);

  const db = admin.firestore();

  const FIELDS = [
    "cidade",
    "contrato",
    "dataInicio",
    "dataNascimento",
    "foundation",
    "perfilNTT",
    "perfilRatecard",
    "senioridade",
    "status",
    "uf",
  ];

  const baseDb = db;

  // Diagnóstico: imprimir contexto do Admin SDK e listar collections (quando suportado)
  try {
    const opts = admin.app().options || {};
    console.log("[admin] app options:", {
      projectId: opts.projectId,
      databaseURL: opts.databaseURL,
    });
  } catch (e) {
    console.log("[admin] não foi possível ler options:", e?.message || e);
  }

  try {
    // Alguns SDKs suportam listCollections; serve para confirmar o "banco" conectado.
    const cols = await db.listCollections();
    const names = cols.map((c) => c.id);
    console.log("[probe] listCollections (top 200):", names.slice(0, 200));
  } catch (e) {
    console.error("[probe] listCollections ERRO:", e?.code || e?.message || e);
  }

  async function probeCollection(name) {
    try {
      const snap = await baseDb.collection(name).limit(1).get();
      console.log(`[probe] ${name}: OK (size=${snap.size})`);
      return true;
    } catch (e) {
      console.error(`[probe] ${name}: ERRO`, e?.code || e?.message || e);
      return false;
    }
  }

  await probeCollection("users");
  await probeCollection("squads");
  await probeCollection("team");

  console.log("[enrich_users_from_team] Lendo collection team...");
  const teamSnap = await baseDb.collection("team").get();
  console.log(`[enrich_users_from_team] Docs team: ${teamSnap.size}`);
  let updated = 0;
  let skippedNoEmail = 0;
  let skippedNoUser = 0;

  for (const teamDoc of teamSnap.docs) {
    const teamData = teamDoc.data() || {};
    const email = (teamData.email || "").toString().trim().toLowerCase();
    if (!email) {
      skippedNoEmail++;
      continue;
    }

    // Busca user por email (não temos índice aqui; fazemos query simples)
    // Se for muito grande, vamos otimizar depois com índices/coleções auxiliares.
    const usersQuery = baseDb
      .collection("users")
      .where("email", "==", email)
      .limit(10);

    const usersSnap = await usersQuery.get();

    if (usersSnap.empty) {
      skippedNoUser++;
      continue;
    }

    // Se houver múltiplos, atualiza todos (a deduplicação por email foi sua exceção,
    // mas aqui garantimos atualização consistente).
    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data() || {};
      const patch = {};

      for (const field of FIELDS) {
        const incoming = teamData[field];
        const current = userData[field];

        const currentIsEmpty =
          current === null ||
          current === undefined ||
          (typeof current === "string" && current.trim() === "");

        if (!currentIsEmpty) continue; // não sobrescreve

        if (incoming === null || incoming === undefined) continue;
        patch[field] = incoming;
      }

      // Nunca sobrescreve email/displayName
      delete patch.email;
      delete patch.displayName;

      const hasChanges = Object.keys(patch).length > 0;
      if (!hasChanges) continue;

      await userDoc.ref.set(
        {
          ...patch,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      updated++;
    }
  }

  console.log("[enrich_users_from_team] Concluído.");
  console.log({
    updated,
    skippedNoEmail,
    skippedNoUser,
  });
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[enrich_users_from_team] Erro:", e);
    process.exit(1);
  });
