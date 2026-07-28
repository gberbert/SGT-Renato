import mermaid from 'mermaid';

const code = `
graph TD
    subgraph "Frontend"
        UI["Dashboard Web (React)"]
    end
    
    subgraph "Backend - Arquitetura Hexagonal"
        REST["Controlador REST (Spring Boot)"]
        CORE["Core Domain (Regras de Negócio)"]
        PORT["Interface Repository (Port)"]
    end
    
    subgraph "Persistência"
        ADAPT_FB["Adaptador Firebase (MVP)"]
        ADAPT_SQL["Adaptador SQL Server/Oracle (Futuro)"]
        DB_FB[("Banco Firebase")]
        DB_SQL[("Banco Relacional")]
    end
    
    AF["Analista Financeiro"] -->|"Interage com"| UI
    UI -->|"Consome API REST"| REST
    REST -->|"Delega processamento"| CORE
    CORE -->|"Define contrato"| PORT
    PORT -->|"Implementado por"| ADAPT_FB
    PORT -.->|"Implementado por"| ADAPT_SQL
    ADAPT_FB -->|"Lê e Grava"| DB_FB
    ADAPT_SQL -.->|"Lê e Grava"| DB_SQL
`;

async function test() {
  try {
    const parse = await mermaid.parse(code);
    console.log("SUCCESS:", parse);
  } catch (e) {
    console.error("ERROR:", e);
  }
}

test();
