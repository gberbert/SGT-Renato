const sortAlpha = (arr) => [...arr].sort((a, b) => a.localeCompare(b, 'pt-BR'));

export const STATUS_OPTIONS = sortAlpha(['Ativo', 'Inativo']);

export const FOUNDATION_OPTIONS = sortAlpha(['EAPPS', 'MAPPS', 'QS', 'DX', 'GLOBALITY', 'CFLOW']);

export const UF_OPTIONS = sortAlpha([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

export const CONTRATO_OPTIONS = sortAlpha(['Consultoria', 'GDNe', 'Subcontratado']);

export const SENIORIDADE_OPTIONS = sortAlpha(['Especialista', 'Sênior', 'Pleno', 'Júnior']);

export const SENIORIDADE_RATECARD_OPTIONS = sortAlpha(['Especialista', 'Sênior', 'Pleno', 'Júnior']);

export const CARGO_OPTIONS = sortAlpha([
  'Engineering - Junior Engineer',
  'Engineering - Engineer',
  'Engineering - Senior Engineer',
  'Engineering - Technical Lead',
  'Engineering - Senior Technical Lead',
  'Project & Service Management - Service Lead',
  'Project & Service Management - Project Leader / Service Leader / Q Project & Service Leader',
  'Project & Service Management - Senior Project Leader / Senior Service Leader / Evangelist',
  'Q&A - Q Junior',
  'Q&A - Q Engineer / Q Architect',
  'Q&A - Q Senior Engineer',
  'Q&A - Q Lead Architect / Q Lead Engineer',
  'Q&A - Q Expert Architect / Q Expert',
  'Analysis - Junior Analyst',
  'Analysis - Analyst',
  'Analysis - Lead Analyst',
  'Analysis - Expert Analyst',
  'Architecture - Architect',
  'Architecture - Lead Architect',
  'Architecture - Expert Architect',
  'Architecture - Chief Architect',
  'Service Advisory - Service Consultant',
  'Service Advisory - Senior Service Consultant',
  'Service Advisory - Service Consulting Leader',
  'Functional - Functional Senior Specialist',
  'CRM - Salesforce - Enterprise Solutions Analist',
  'GDN-e - CJ - CENTERS JUNIOR',
  'GDN-e - CD - CENTERS DEVELOPER',
  'GDN-e - CSS - TECHNICAL SENIOR SPECIALIST',
  'GDN-e - CLS - TECHNICAL LEADER SPECIALIST',
  'GDN-e - CSL - CENTERS SERVICE LEADER',
  'GDN-e - CSSL - CENTERS SENIOR SERVICE LEADER',
]);

export const PERFIL_RATECARD_OPTIONS = sortAlpha([
  'Desenvolvedor Web (Backend e Frontend)',
  'Backend (.net core/python/java)',
  'Acquia Developer',
  'Desenvolvedor Mobile',
  'Product Owner',
  'Analista de Testes',
  'Scrum Master',
  'Gerente de Projetos',
  'Analista Desenvolvedor - Integrações',
  'Arquiteto Salesforce',
  'Funcional Salesforce',
  'Desenvolvedor Salesforce',
  'Analista Funcional Generalista',
  'Arquiteto de solução',
  'Arquiteto de Software',
  'Arquiteto de Software (Cloud e OnPremisse)',
  'Desenvolvedor Lowcode',
  'Analista de Dados (Cloud e OnPremisse)',
  'Analista Desenvolvedor - APIs',
  'Analista Desenvolvedor - Power Platform',
  'Arquiteto de Dados',
  'Engenheiro de dados',
  'Engenheiro DevSecOps (Cloud e OnPremisse)',
  'Arquiteto de Infraestrutura (Cloud e OnPremisse)',
  'Arquiteto de Integrações',
  'Consultor Salesforce',
  'Analista DataViz',
  'Analista tecnologia Acquia/Drupal/PHP/Microsoft Azure (MSC)',
  'Desenvolvedor tecnologia Acquia/Drupal/PHP/Microsoft Azure (MSC)',
  'Desenvolvedor C#',
  'Desenvolvedor Web Forms',
  'Desenvolvedor WebServices',
  'Desenvolvedor VB.NET e VB6',
  'Desenvolvedor React Native',
  'Desenvolvedor ASP.NET MVC',
  'Desenvolvedor Sharepoint / Microsoft EPM',
  'Analista Salesforce Flow, LWC, Apex',
  'Desenvolvedor Salesforce Flow, LWC, Apex',
  'Desenvolvedor Oracle BI/SQL',
  'Desenvolvedor MicroServices',
]);

export const SELECT_OPTIONS_BY_KEY = {
  status: STATUS_OPTIONS,
  foundation: FOUNDATION_OPTIONS,
  uf: UF_OPTIONS,
  contract: CONTRATO_OPTIONS,
  perfilNTT: CARGO_OPTIONS,
  seniority: SENIORIDADE_OPTIONS,
  rcSeniority: SENIORIDADE_RATECARD_OPTIONS,
  perfilRatecard: PERFIL_RATECARD_OPTIONS,
};
