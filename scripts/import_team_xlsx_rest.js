import fs from "fs";
import path from "path";
import * as XLSXImport from "xlsx";
import { GoogleAuth } from "google-auth-library";

const XLSX = XLSXImport?.default ? XLSXImport.default : XLSXImport;

const SERVICE_ACCOUNT_PATH =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "";
const SERVICE_ACCOUNT_JSON =
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";

const XLSX_PATH =
  process.env.TEAM_XLSX_PATH ||
  path.resolve("./Arquivos_Gerais/Team.xlsx");

const COLLECTION_NAME = "team";

// Firestore DB
const projectIdFromEnv = process.env.FIREBASE_PROJECT_ID || "";
const databaseId = process.env.FIREBASE_FIRESTORE_DATABASE_ID || "default";

function getServiceAccount() {
  if (SERVICE_ACCOUNT_JSON) return JSON.parse(SERVICE_ACCOUNT_JSON);
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
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const ms = value * 24 * 60 * 60 * 1000;
    return new Date(epoch.getTime() + ms).toISOString().slice(0, 10);
  }
  return String(value);
}

function cleanString(v) {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v.trim();
  return String(v);
}

async function getAccessToken(sa) {
  const auth = new GoogleAuth({
    credentials: sa,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  return tokenResponse.token;
}

async function commitBatch({ projectId, writes }) {
  const database = `projects/${projectId}/databases/${databaseId}`;
  const url = `https://firestore.googleapis.com/v1/${database}/documents:commit`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${writes.token}`,
    },
    body: JSON.stringify({ writes: writes.ops }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`REST commit failed: ${res.status} ${text}`);
  }
}

async function main() {
  const sa = getServiceAccount();
  const projectId = projectIdFromEnv || sa.project_id || sa.projectId;
  if (!projectId) throw new Error("Missing projectId (service account project_id).");

  if (!fs.existsSync(path.isAbsolute(XLSX_PATH) ? XLSX_PATH : path.resolve(XLSX_PATH))) {
    const abs = path.isAbsolute(XLSX_PATH) ? XLSX_PATH : path.resolve(XLSX_PATH);
    throw new Error(`XLSX file not found: ${abs}`);
  }

  const absXlsx = path.isAbsolute(XLSX_PATH) ? XLSX_PATH : path.resolve(XLSX_PATH);

  const workbook = XLSX.readFile(absXlsx);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (!rows.length) {
    console.log("No rows found in sheet:", sheetName);
    return;
  }

  const token = await getAccessToken(sa);

  // Firestore REST batch write limit varies; keep it conservative
  const batchSize = 350;

  let batchOps = [];
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

    const docPath = `projects/${projectId}/databases/${databaseId}/documents/${COLLECTION_NAME}/${idRaw}`;

    // merge=true => update fields (PATCH-like) by using updateMask on commit write
    // We'll set only fields we send; server timestamps omitted (to keep simple).
    const fields = {
      status: { stringValue: status },
      nome: { stringValue: nome },
      email: { stringValue: email },
      squad: { stringValue: squad },
      contrato: { stringValue: contrato },
      foundation: { stringValue: foundation },
      perfilNTT: { stringValue: perfilNTT },
      perfilRatecard: { stringValue: perfilRatecard },
      senioridade: { stringValue: senioridade },
      dataInicio: { stringValue: dataInicio },
      dataNascimento: { stringValue: dataNascimento },
      cidade: { stringValue: cidade },
      uf: { stringValue: uf },
      // updatedAt can be set by client time:
      updatedAt: { timestampValue: new Date().toISOString() },
    };

    batchOps.push({
      update: {
        name: docPath,
        fields,
      },
    });

    total++;
    if (batchOps.length >= batchSize) {
      await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:commit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ writes: batchOps }),
        }
      ).then(async (r) => {
        if (!r.ok) {
          const t = await r.text();
          throw new Error(`REST commit failed: ${r.status} ${t}`);
        }
      });

      console.log(`Committed batch. Total so far: ${total}`);
      batchOps = [];
    }
  }

  if (batchOps.length) {
    await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:commit`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ writes: batchOps }),
      }
    ).then(async (r) => {
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`REST commit failed: ${r.status} ${t}`);
      }
    });
  }

  console.log(`Done. Upserted/merged ${total} docs into "${COLLECTION_NAME}" via REST`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
