const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'database.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const printers = [
  { name: '2A', ip: '192.168.1.173', model: 'HP LaserJet E50145DN', sector: '2º Andar', local: null, serial: 'BRBSS5D048' },
  { name: '2B', ip: '192.168.1.192', model: 'HP LaserJet E52645C', sector: '2º Andar', local: '2º B', serial: 'BRBSS3L049' },
  { name: '3A-ENFERMAGEM', ip: '192.168.1.215', model: 'HP LaserJet E50145DN', sector: '3º Andar', local: '3º A - Enfermagem', serial: 'BRBSS5D07B' },
  { name: '3B', ip: '192.168.1.207', model: 'HP LaserJet E52645C', sector: '3º Andar', local: '3º B', serial: 'BRBSS3S0K0' },
  { name: '3MED-RESIDENTES', ip: '192.168.1.211', model: 'HP LaserJet E50145DN', sector: '3º Andar', local: '3º - Médicos Residentes', serial: 'BRBSS5D070' },
  { name: 'ALMOXARIFADO', ip: '192.168.1.245', model: 'HP LaserJet E52645C', sector: 'Almoxarifado', local: null, serial: 'BRBSS3M00G' },
  { name: 'AMARELA-2', ip: '192.168.1.246', model: 'HP LaserJet E50145DN', sector: 'SPA', local: 'Área Amarela - Consultório 2', serial: 'BRBSS6M0H7' },
  { name: 'AMB-RECEPCAO-2', ip: '192.168.1.230', model: 'HP LaserJet E50145DN', sector: 'Ambulatório', local: 'Recepção 2', serial: 'BRBSS6M0K5' },
  { name: 'AMB-RECEPCAO-3', ip: '192.168.1.231', model: 'HP LaserJet E50145DN', sector: 'Ambulatório', local: 'Recepção 3', serial: 'BRBSS6M0LS' },
  { name: 'AMB-RECEPCAO-4', ip: '192.168.1.221', model: 'HP LaserJet E50145DN', sector: 'Ambulatório', local: 'Recepção 4', serial: 'BRBSS6M0KC' },
  { name: 'AMB-RECEPCAO-5', ip: '192.168.1.219', model: 'HP LaserJet E50145DN', sector: 'Ambulatório', local: 'Recepção 5', serial: 'BRBSS6M0LJ' },
  { name: 'AMB-RECEPCAO-6', ip: '192.168.1.175', model: 'HP LaserJet E50145DN', sector: 'Ambulatório', local: 'Recepção 6', serial: 'BRBSS6M0HL' },
  { name: 'AMBULATORIO', ip: '192.168.1.224', model: 'HP LaserJet E52645C', sector: 'Ambulatório', local: 'Gerência', serial: 'BRBSS3L08N' },
  { name: 'ANEXO-SPA', ip: '192.168.1.226', model: 'HP LaserJet E50145DN', sector: 'SPA', local: 'Anexo', serial: 'BRBSS5D046' },
  { name: 'AREA VERMELHA', ip: '192.168.1.181', model: 'HP LaserJet E50145DN', sector: 'SPA', local: 'Área Vermelha', serial: 'BRBSS6M0LG' },
  { name: 'ARQUIVO', ip: '192.168.1.225', model: 'HP LaserJet E52645C', sector: 'Arquivo', local: null, serial: 'BRBSS3L04C' },
  { name: 'BACK-UP MULTI', ip: null, model: 'HP LaserJet E52645C', sector: 'Informática', local: 'Depósito', serial: 'BRBSS3M00Y' },
  { name: 'BACK-UP MONO', ip: null, model: 'HP LaserJet E50145DN', sector: 'Informática', local: 'Depósito', serial: 'BRBSS6M0LL' },
  { name: 'BLOQUINHO', ip: '192.168.1.171', model: 'HP LaserJet E50145DN', sector: 'Bloco Cirúrgico', local: 'Pequenas Cirurgias (Bloquinho)', serial: 'BRBSS6M0GS' },
  { name: 'CEMPRE', ip: '192.168.1.182', model: 'HP LaserJet E50145DN', sector: 'CEMPRE', local: null, serial: 'BRBSS6M0LW' },
  { name: 'CENTRAL-LEITOS', ip: '192.168.1.212', model: 'HP LaserJet E52645C', sector: 'Central de Leitos', local: null, serial: 'BRBSS3L0YK' },
  { name: 'CME', ip: '192.168.1.213', model: 'HP LaserJet E50145DN', sector: '1º Andar', local: 'CME', serial: 'BRBSS6M0LV' },
  { name: 'CONSULTORIO-AMARELA-01', ip: '192.168.1.174', model: 'HP LaserJet E50145DN', sector: 'SPA', local: 'Área Amarela - Consultório 1', serial: 'BRBSS6M0LH' },
  { name: 'CONSULTORIO-AMARELA-03', ip: '192.168.1.196', model: 'HP LaserJet E50145DN', sector: 'SPA', local: 'Área Amarela - Consultório 3', serial: 'BRBSS6M0KH' },
  { name: 'CONSULTORIO-AMARELA-04', ip: '192.168.1.210', model: 'HP LaserJet E50145DN', sector: 'SPA', local: 'Área Amarela - Consultório 4', serial: 'BRBSS6M0JJ' },
  { name: 'CONSULTORIO-VERDE-01', ip: '192.168.1.185', model: 'HP LaserJet E50145DN', sector: 'SPA', local: 'Área Verde - Consultório 1', serial: 'BRBSS6M0LP' },
  { name: 'CONSULTORIO-VERDE-02', ip: '192.168.1.253', model: 'HP LaserJet E50145DN', sector: 'SPA', local: 'Área Verde - Consultório 2', serial: 'BRBSS6M0LK' },
  { name: 'DIRETORIA', ip: '192.168.1.184', model: 'HP Color LaserJet Flow X57945', sector: 'Diretoria', local: null, serial: 'BRBSS7G036' },
  { name: 'DIRETORIA-AD', ip: '192.168.1.234', model: 'HP LaserJet E52645C', sector: 'Diretoria', local: 'Diretoria Adjunta', serial: 'BRBSS3S0HK' },
  { name: 'ECOCARDIOGRAMA', ip: '192.168.0.184', model: 'HP Color LaserJet Flow X57945', sector: 'Ecocardiograma', local: null, serial: 'BRBSS4G03T' },
  { name: 'ENDOSCOPIA', ip: '192.168.1.204', model: 'HP Color LaserJet X55745', sector: 'Endoscopia', local: null, serial: 'JPBCS4B03C' },
  { name: 'ERGOMETRIA 1', ip: '192.168.1.183', model: 'HP LaserJet E50145DN', sector: 'Ambulatório', local: 'Recepção 8 (Ergometria)', serial: 'BRBSS6M0LQ' },
  { name: 'ERGOMETRIA 2', ip: '192.168.1.232', model: 'HP LaserJet E50145DN', sector: 'Ambulatório', local: 'Recepção 8 (Ergometria)', serial: 'BRBSS3S0L2' },
  { name: 'EVOLUCAO-SPA', ip: '192.168.1.198', model: 'HP LaserJet E50145DN', sector: 'SPA', local: 'Evolução Médica', serial: 'BRBSS6M0LT' },
  { name: 'FARMACIA', ip: '192.168.1.217', model: 'HP LaserJet E52645C', sector: 'Farmácia Central - NAFA', local: null, serial: 'BRBSS3S0G7' },
  { name: 'FARMACIA-SPA', ip: '192.168.1.169', model: 'HP LaserJet E50145DN', sector: 'SPA', local: 'Farmácia do SPA', serial: 'BRBSS6M0KT' },
  { name: 'FARMACIA-UTI', ip: '192.168.1.195', model: 'HP LaserJet E50145DN', sector: 'UTIs', local: 'Farmácia das UTIs', serial: 'BRBSS6M0LN' },
  { name: 'FATURAMENTO', ip: '192.168.1.197', model: 'HP LaserJet E52645C', sector: 'Faturamento', local: null, serial: 'BRBSS3S049' },
  { name: 'FISIOTERAPIA', ip: '192.168.1.189', model: 'HP LaserJet E52645C', sector: 'Ambulatório', local: 'Fisioterapia e Fono', serial: 'BRBSS5B07R' },
  { name: 'FRACIONAMENTO', ip: '192.168.1.205', model: 'HP LaserJet E50145DN', sector: 'Farmácia Central - NAFA', local: 'Fracionamento', serial: 'BRBSS5B088' },
  { name: 'GAFH', ip: '192.168.1.236', model: 'HP LaserJet E52645C', sector: 'Diretoria', local: 'GAFH', serial: 'BRBSS3M041' },
  { name: 'GERENCIA DE ENFERMAGEM', ip: '192.168.1.200', model: 'HP LaserJet E50145DN', sector: 'SPA', local: 'Supervisão de Enfermagem', serial: 'BRBSS6M0KD' },
  { name: 'GERENCIA-LABORATORIO', ip: '192.168.1.188', model: 'HP LaserJet E50145DN', sector: 'Laboratório', local: 'Hematologia', serial: 'BRBSS5D07M' },
  { name: 'GERENCIA-UTIS', ip: '192.168.1.187', model: 'HP LaserJet E52645C', sector: 'UTIs', local: 'Gerência das UTIs 2 e 3', serial: 'BRBSS3S0KM' },
  { name: 'HOSPITALDIA', ip: '192.168.1.170', model: 'HP LaserJet E50145DN', sector: 'Hospital Dia', local: null, serial: 'BRBSS6M0LR' },
  { name: 'INTERNAMENTO', ip: '192.168.1.227', model: 'HP LaserJet E52645C', sector: 'Internamento', local: null, serial: 'BRBSS3L08P' },
  { name: 'LABORATORIO-SPA', ip: '192.168.1.214', model: 'HP LaserJet E52645C', sector: 'SPA', local: 'Laboratório', serial: 'BRBSS3S03H' },
  { name: 'MANUTENCAO', ip: '192.168.1.172', model: 'HP Color LaserJet Flow E78635', sector: 'Manutenção', local: 'Gerência da Manutenção', serial: 'BRBSS5B05R' },
  { name: 'NAD', ip: '192.168.1.177', model: 'HP LaserJet E50145DN', sector: 'Domiciliar (NAD)', local: null, serial: 'BRBSS5D044' },
  { name: 'NAST', ip: '192.168.1.229', model: 'HP LaserJet E52645C', sector: 'NAST', local: null, serial: 'BRBSS3S05T' },
  { name: 'NCOMP', ip: '192.168.1.180', model: 'HP LaserJet E52645C', sector: 'Qualidade', local: null, serial: 'BRBSS3S045' },
  { name: 'NUCLEO-DE-ESTUDOS', ip: '192.168.1.206', model: 'HP LaserJet E52645C', sector: 'Núcleo de Estudos', local: null, serial: 'BRBSS3S0KQ' },
  { name: 'PEDIATRIA', ip: '192.168.1.179', model: 'HP LaserJet E52645C', sector: 'Pediatria', local: null, serial: 'BRBSS3S042' },
  { name: 'PRESCRICAO-1A', ip: '192.168.1.248', model: 'HP LaserJet E50145DN', sector: '1º Andar', local: '1º A - Prescrição', serial: 'BRBSS6M0LM' },
  { name: 'PRODUCAO-NANU', ip: '192.168.1.242', model: 'HP LaserJet E50145DN', sector: 'Nutrição', local: 'Produção - Refeitório', serial: 'BRBSS5B07N' },
  { name: 'PSICOLOGIA', ip: '192.168.1.239', model: 'HP LaserJet E50145DN', sector: 'Psicologia', local: null, serial: 'BRBSS5B082' },
  { name: 'QUIMIOTERAPIA', ip: '192.168.1.203', model: 'HP LaserJet E52645C', sector: '1º Andar', local: 'Quimioterapia', serial: 'BRBSS3S0HS' },
  { name: 'RAIOX', ip: '192.168.1.250', model: 'HP LaserJet E52645C', sector: 'Raio-X', local: 'Recepção', serial: 'BRBSS3S05Y' },
  { name: 'RECEPCAO 7', ip: '192.168.1.249', model: 'HP LaserJet E50145DN', sector: 'Ambulatório', local: 'Recepção 7', serial: 'BRBSS5D04B' },
  { name: 'RECEPCAO-SPA', ip: '192.168.1.202', model: 'HP LaserJet E52645C', sector: 'SPA', local: 'Recepção', serial: 'BRBSS3M03T' },
  { name: 'RECP-AMBU-01', ip: '192.168.1.218', model: 'HP LaserJet E50145DN', sector: 'Ambulatório', local: 'Recepção 1', serial: 'BRBSS5D049' },
  { name: 'RH', ip: '192.168.1.244', model: 'HP LaserJet E52645C', sector: 'APES Recursos Humano', local: null, serial: 'BRBSS3L047' },
  { name: 'ROUPARIA', ip: '192.168.1.220', model: 'HP LaserJet E50145DN', sector: 'Rouparia', local: null, serial: 'BRBSS5D07L' },
  { name: 'SAUDE-OCUPACIONAL', ip: '192.168.1.199', model: 'HP LaserJet E50145DN', sector: 'Saúde Ocupacional', local: null, serial: 'BRBSS5D07J' },
  { name: 'SPA-ORTOPEDIA', ip: '192.168.1.178', model: 'HP LaserJet E50145DN', sector: 'SPA', local: 'Ortopedia', serial: 'BRBSS6M0JM' },
  { name: 'SUPERVISAO-SPA', ip: '192.168.1.228', model: 'HP LaserJet E52645C', sector: 'SPA', local: 'Supervisão Médica', serial: 'BRBSS3M02B' },
  { name: 'TOMOGRAFIA', ip: '192.168.1.238', model: 'HP LaserJet E52645C', sector: 'Tomografia', local: null, serial: 'BRBSS3L0YQ' },
  { name: 'TRANSPORTE', ip: '192.168.1.191', model: 'HP LaserJet E50145DN', sector: 'Transporte', local: null, serial: 'BRBSS5B07S' },
  { name: 'TRIAGEM-02', ip: '192.168.1.223', model: 'HP LaserJet E50145DN', sector: 'SPA', local: 'Área Verde - Triagem 2', serial: 'BRBSS6M0KF' },
  { name: 'TRIAGEM-1', ip: '192.168.1.222', model: 'HP LaserJet E50145DN', sector: 'SPA', local: 'Área Verde - Triagem 1', serial: 'BRBSS6M0KG' },
  { name: 'ULTRASSOM-SPA', ip: '192.168.1.186', model: 'HP LaserJet E50145DN', sector: 'SPA', local: 'Ultrassom', serial: 'BRBSS6M0JC' },
  { name: 'UTI 2', ip: '192.168.1.190', model: 'HP LaserJet E50145DN', sector: 'UTIs', local: 'UTI 2', serial: 'BRBSS6M0KJ' },
  { name: 'UTI 3', ip: '192.168.1.243', model: 'HP LaserJet E50145DN', sector: 'UTIs', local: 'UTI 3', serial: 'BRBSS6M0KB' },
  { name: 'UTI-1', ip: '192.168.1.201', model: 'HP LaserJet E50145DN', sector: 'UTIs', local: 'UTI 1', serial: 'BRBSS5D07N' },
];

console.log(`\n=== Cadastro de Impressoras Reais ===\n`);

// 1. Get existing sectors
const existingSectors = db.prepare('SELECT id, name FROM sectors').all();
const sectorMap = {};
existingSectors.forEach(s => { sectorMap[s.name.trim().toLowerCase()] = s.id; });
console.log(`Setores existentes: ${existingSectors.length}`);
existingSectors.forEach(s => console.log(`  - [${s.id}] ${s.name}`));

// 2. Identify needed sectors from printer data
const neededSectors = [...new Set(printers.map(p => p.sector))];
console.log(`\nSetores necessários: ${neededSectors.length}`);

// 3. Create missing sectors
const insertSector = db.prepare('INSERT INTO sectors (name, responsible) VALUES (?, ?)');
let sectorsCreated = 0;
for (const sectorName of neededSectors) {
  const key = sectorName.trim().toLowerCase();
  if (!sectorMap[key]) {
    const result = insertSector.run(sectorName, null);
    sectorMap[key] = result.lastInsertRowid;
    sectorsCreated++;
    console.log(`  [CRIADO] ${sectorName} -> ID ${result.lastInsertRowid}`);
  } else {
    console.log(`  [OK] ${sectorName} -> ID ${sectorMap[key]}`);
  }
}
console.log(`\nSetores criados: ${sectorsCreated}`);

// 4. Remove existing printers (clean slate for real data)
const existingPrinters = db.prepare('SELECT COUNT(*) as total FROM printers').get();
console.log(`\nImpressoras existentes antes: ${existingPrinters.total}`);

db.prepare('DELETE FROM snmp_readings').run();
db.prepare('DELETE FROM quotas').run();
db.prepare('DELETE FROM releases').run();
db.prepare('DELETE FROM printers').run();
console.log('Dados antigos removidos.');

// 5. Insert all printers
const insertPrinter = db.prepare(
  'INSERT INTO printers (name, model, sector_id, local_description, ip_address, snmp_community, active) VALUES (?, ?, ?, ?, ?, ?, 1)'
);

const insertAll = db.transaction(() => {
  let count = 0;
  for (const p of printers) {
    const sectorKey = p.sector.trim().toLowerCase();
    const sectorId = sectorMap[sectorKey];
    if (!sectorId) {
      console.log(`  [ERRO] Setor nao encontrado: ${p.sector}`);
      continue;
    }
    insertPrinter.run(p.name, p.model, sectorId, p.local || null, p.ip || null, 'public');
    count++;
  }
  return count;
});

const total = insertAll();
console.log(`\nImpressoras cadastradas: ${total} de ${printers.length}`);

// 6. Verify
const finalCount = db.prepare('SELECT COUNT(*) as total FROM printers WHERE active = 1').get();
const finalSectors = db.prepare('SELECT COUNT(*) as total FROM sectors').get();
console.log(`\n=== Resultado Final ===`);
console.log(`Setores: ${finalSectors.total}`);
console.log(`Impressoras ativas: ${finalCount.total}`);
console.log(`\nDone!`);

db.close();
