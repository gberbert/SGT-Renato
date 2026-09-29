/**
 * Diagnóstico: mostra exatamente quais JQLs estão sendo usados na carga
 * (verifica operacao_config/jql_overrides no Firestore vs JQLS_DEFAULT)
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import sa from "./Arquivos_Gerais/sgt-renato-firebase-adminsdk-fbsvc-2c3d1c9c2c.json" assert { type: "json" };

const app = initializeApp({ credential: cert(sa) });

const db = getFirestore(app, "default");

const JQLS_DEFAULT = [
  { escopoId: "problemas",    label: "PROBLEMAS" },
  { escopoId: "demanda-fast", label: "DEMANDA FAST" },
  { escopoId: "demanda",      label: "DEMANDA" },
  { escopoId: "incidente",    label: "INCIDENTE" },
  { escopoId: "solicitacao",  label: "SOLICITACAO" },
  { escopoId: "catalogo",     label: "CATALOGO" },
];

async function main() {
  // 1. Verifica operacao_config/jql_overrides
  console.log("=== 1. operacao_config/jql_overrides ===");
  const overridesSnap = await db.doc("operacao_config/jql_overrides").get();
  if (!overridesSnap.exists) {
    console.log("  → DOCUMENTO NÃO EXISTE → usa JQLS_DEFAULT hardcoded");
  } else {
    const data = overridesSnap.data() || {};
    const keys = Object.keys(data);
    console.log(`  → Documento existe com ${keys.length} campos: [${keys.join(", ")}]`);
    for (const [key, val] of Object.entries(data)) {
      const isEmpty = !val || (typeof val === "string" && !val.trim());
      console.log(`\n  [${key}] ${isEmpty ? "⚠️  VAZIO/NULL" : "OK"}`);
      if (val) console.log(`    JQL: ${String(val).slice(0, 200)}...`);
    }
  }

  // 2. Verifica jql_configs (collection antiga, pode ainda existir)
  console.log("\n=== 2. collection jql_configs (legado) ===");
  try {
    const jqlConfigsSnap = await db.collection("jql_configs").get();
    if (jqlConfigsSnap.empty) {
      console.log("  → Coleção vazia ou não existe");
    } else {
      console.log(`  → ${jqlConfigsSnap.size} documentos encontrados:`);
      for (const doc of jqlConfigsSnap.docs) {
        const d = doc.data();
        console.log(`  [${doc.id}] escopo=${d.escopo || d.escopoId} | jql=${String(d.jql || "").slice(0, 100)}...`);
      }
    }
  } catch (e) {
    console.log("  → Erro ao acessar jql_configs:", e.message);
  }

  // 3. Simula o que loadJqlBatchesWithOverrides vai usar
  console.log("\n=== 3. JQLs EFETIVOS que serão usados na carga ===");
  let effectiveSource = "JQLS_DEFAULT";
  let overridesMap = {};
  if (overridesSnap.exists) {
    const data = overridesSnap.data() || {};
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === "string" && value.trim()) {
        overridesMap[key] = value;
      }
    }
    if (Object.keys(overridesMap).length > 0) effectiveSource = "operacao_config/jql_overrides";
  }
  console.log(`  Fonte: ${effectiveSource}`);
  for (const b of JQLS_DEFAULT) {
    const jql = overridesMap[b.escopoId] || "(usa JQLS_DEFAULT)";
    const preview = jql.length > 150 ? jql.slice(0, 150) + "..." : jql;
    console.log(`\n  [${b.label}] → ${preview}`);
  }

  // 4. Conta tickets_global existentes por escopo
  console.log("\n=== 4. tickets_global — contagem atual por escopo ===");
  try {
    const totalSnap = await db.collection("tickets_global").count().get();
    console.log(`  Total geral: ${totalSnap.data().count}`);
    for (const b of JQLS_DEFAULT) {
      const snap = await db.collection("tickets_global").where("escopo", "==", b.label).count().get();
      console.log(`  ${b.label}: ${snap.data().count}`);
    }
  } catch (e) {
    console.log("  Erro ao contar:", e.message);
  }

  process.exit(0);
}

main().catch((e) => { console.error("Erro:", e); process.exit(1); });
