import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import * as XLSXImport from "xlsx";

const XLSX = XLSXImport?.default ? XLSXImport.default : XLSXImport;

const SERVICE_ACCOUNT_PATH =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "";
const SERVICE_ACCOUNT_JSON =
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";

// XLSX source
const XLSX_PATH =
  process.env.TEAM_XLSX_PATH ||
  path.resolve("./Arquivos_Gerais/Team.xlsx");

const COLLECTION_NAME = "team";

function getServiceAccount() {
  if (SERVICE_ACCOUNT_JSON) {
    return JSON.parse(SERVICE_ACCOUNT_JSON);
  }
  if (SERVICE_ACCOUNT_PATH) {
    const p = path.resolve(SERVICE_ACCOUNT_PATH);
    return JSON.parse(fs.readFileSync(p, "utf8"));
  }
  throw new Error(
    "Missing Firebase service account. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH"
  );
}

function normalizeDate(value) {
  if (!value) return "";
  // Excel dates can come as Date objects or serials depending on parser.
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    // XLSX serial date -> JS date
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const ms = value * 24 * 60 * 60 * 1000;
    return new Date(epoch.getTime() + ms).toISOString().slice(0, 10);
  }
  // keep as string
  return String(value);
}

function cleanString(v) {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v.trim();
  return String(v);
}

async function main() {
  const serviceAccount = getServiceAccount();

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  const projectId = serviceAccount.project_id || serviceAccount.projectId;
  const databaseId = process.env.FIREBASE_FIRESTORE_DATABASE_ID || "default";

  const databaseURL =
    process.env.FIREBASE_FIRESTORE_DATABASE_URL ||
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}`;

  // initializeApp com nome fixo (evita reuso de instância antiga sem databaseURL)
  const app =
    admin.apps.find((a) => a.name === "team-import") ||
    admin.initializeApp(
      {
        credential: admin.credential.cert(serviceAccount),
        projectId,
        databaseURL,
      },
      "team-import"
    );

  // Firestore no app correto
  const db =
    typeof admin.firestore === "function"
      ? admin.firestore(app)
      : admin.firestore();

  const absXlsx = path.isAbsolute(XLSX_PATH)
    ? XLSX_PATH
    : path.resolve(XLSX_PATH);

  if (!fs.existsSync(absXlsx)) {
    throw new Error(`XLSX file not found: ${absXlsx}`);
  }

  const workbook = XLSX.readFile(absXlsx);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Read rows with header (first row)
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (!rows.length) {
    console.log("No rows found in sheet:", sheetName);
    return;
  }

  // Expected columns from your Excel:
  // STATUS, NOME, ID, EMAIL, SQUAD, CONTRATO, FOUNDATION, PERFIL NTT, PERFIL RATECARD, SENIORIDADE,
  // DATA INÍCIO, DATA NASCIMENTO, CIDADE, UF
  const batchSize = 450; // Firestore per batch limit: 500

  let batch = db.batch();
  let opCount = 0;
  let total = 0;

  for (const row of rows) {
    const status = cleanString(row["STATUS"]);
    const nome = cleanString(row["NOME"]);
    const idRaw = cleanString(row["ID"]);
    const email = cleanString(row["EMAIL"]);
    const squad = cleanString(row["SQUAD"]);
    const contrato = cleanString(row["CONTRATO"]);
    const foundation = cleanString(row["FOUNDATION"]);
    const perfilNTT = cleanString(row["PERFIL NTT"]);
    const perfilRatecard = cleanString(row["PERFIL RATECARD"]);
    const senioridade = cleanString(row["SENIORIDADE"]);
    const dataInicio = normalizeDate(row["DATA INÍCIO"]);
    const dataNascimento = normalizeDate(row["DATA NASCIMENTO"]);
    const cidade = cleanString(row["CIDADE"]);
    const uf = cleanString(row["UF"]);

    if (!idRaw || idRaw.toLowerCase() === "nan") continue;

    const docRef = db.collection(COLLECTION_NAME).doc(idRaw);

    batch.set(
      docRef,
      {
        status,
        nome,
        email,
        squad,
        contrato,
        foundation,
        perfilNTT,
        perfilRatecard,
        senioridade,
        dataInicio,
        dataNascimento,
        cidade,
        uf,
        // helpful bookkeeping
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    opCount++;
    total++;

    if (opCount >= batchSize) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
      console.log(`Committed batch. Total so far: ${total}`);
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }

  console.log(`Done. Upserted ${total} docs into "${COLLECTION_NAME}"`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
