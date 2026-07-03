import axios from 'axios';
import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

// COLE SUAS CREDENCIAIS DO FIREBASE AQUI
const firebaseConfig = {
  apiKey: "COLE_AQUI",
  authDomain: "COLE_AQUI",
  projectId: "COLE_AQUI"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const dbFirestore = getFirestore(app);

// Função auxiliar com delay (se necessário)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const importHolidays = async () => {
  console.log("🚀 Iniciando importação massiva do GitHub...");
  const db = [];
  const currentYear = new Date().getFullYear();

  try {
    // 1. Buscar todos os municípios do Brasil via IBGE
    console.log("⏳ Baixando lista de municípios do IBGE...");
    const ibgeRes = await axios.get('https://servicodados.ibge.gov.br/api/v1/localidades/municipios');
    const municipalities = ibgeRes.data;
    console.log(`✅ Sucesso! Encontrados ${municipalities.length} municípios.`);

    // 2. Buscar Feriados Estaduais do GitHub
    console.log(`⏳ Baixando feriados Estaduais de ${currentYear} do GitHub...`);
    const estaduaisRes = await axios.get(`https://raw.githubusercontent.com/joaopbini/feriados-brasil/master/dados/feriados/estadual/json/${currentYear}.json`);
    const estaduaisData = estaduaisRes.data; // Array de { data: "DD/MM/YYYY", uf: "SP", ... }
    console.log(`✅ Sucesso! ${estaduaisData.length} feriados estaduais encontrados.`);

    // 3. Buscar Feriados Municipais do GitHub
    console.log(`⏳ Baixando feriados Municipais de ${currentYear} do GitHub...`);
    const municipaisRes = await axios.get(`https://raw.githubusercontent.com/joaopbini/feriados-brasil/master/dados/feriados/municipal/json/${currentYear}.json`);
    const municipaisData = municipaisRes.data; // Array de { data: "DD/MM/YYYY", codigo_ibge: 1234567, ... }
    console.log(`✅ Sucesso! ${municipaisData.length} feriados municipais encontrados.`);

    // 4. Cruzar os dados!
    console.log("🔄 Agrupando dados...");
    
    // Processamento otimizado: Agrupar feriados estaduais por UF
    const estaduaisMap = {};
    for (const fe of estaduaisData) {
      const uf = fe.uf.toUpperCase();
      if (!estaduaisMap[uf]) estaduaisMap[uf] = [];
      // Converter de DD/MM/YYYY para YYYY-MM-DD
      const [dia, mes, ano] = fe.data.split('/');
      estaduaisMap[uf].push(`${ano}-${mes}-${dia}`);
    }

    // Agrupar feriados municipais por codigo_ibge
    const municipaisMap = {};
    for (const fm of municipaisData) {
      const code = fm.codigo_ibge.toString();
      if (!municipaisMap[code]) municipaisMap[code] = [];
      const [dia, mes, ano] = fm.data.split('/');
      municipaisMap[code].push(`${ano}-${mes}-${dia}`);
    }

    console.log("🔥 Preparando para gravar no Firebase e no arquivo JSON...");

    // Se quiser testar apenas 5 cidades primeiro, altere o valor abaixo
    const limit = municipalities.length; 

    for (let i = 0; i < limit; i++) {
      const city = municipalities[i];
      let ufObj = city.microrregiao?.mesorregiao?.UF;
      if (!ufObj) {
        ufObj = city['regiao-imediata']?.['regiao-intermediaria']?.UF;
      }
      
      const uf = ufObj?.sigla?.toUpperCase() || 'UNKNOWN';
      const cityName = city.nome;
      const ibgeCode = city.id.toString();
      
      const cityData = {
        ibge_id: city.id,
        nome: cityName,
        uf: uf,
        feriados_estaduais: estaduaisMap[uf] || [],
        feriados_municipais: municipaisMap[ibgeCode] || []
      };

      db.push(cityData);

      try {
        if (firebaseConfig.projectId !== "COLE_AQUI") {
          await setDoc(doc(dbFirestore, "municipios", ibgeCode), cityData);
          if (i % 500 === 0) console.log(`✅ Salvando lote no Firebase... (${i}/${limit})`);
        }
      } catch (fbErr) {
        console.error(`❌ Erro ao salvar ${cityName} no Firebase:`, fbErr.message);
      }
    }

    // 5. Salvar backup JSON
    console.log("💾 Salvando backup local no arquivo feriados_brasil_completo.json...");
    fs.writeFileSync('feriados_brasil_completo.json', JSON.stringify(db, null, 2), 'utf-8');
    
    console.log("🎉 FINALIZADO COM SUCESSO!");
    if (firebaseConfig.projectId === "COLE_AQUI") {
      console.log("⚠️ AVISO: Os dados NÃO foram salvos no Firebase porque você precisa colar suas chaves no firebaseConfig dentro deste script.");
    }

  } catch (error) {
    console.error("❌ Erro fatal:", error.message);
  }
};

importHolidays();
