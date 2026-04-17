require('dotenv').config();
const db = require('../src/config/db');

const printerBrands = [
  { brand: 'HP', models: ['LaserJet Pro M404dn', 'LaserJet Enterprise M507', 'Color LaserJet Pro M454dw', 'LaserJet MFP M428fdw', 'OfficeJet Pro 9015', 'LaserJet Pro M203dw', 'Color LaserJet MFP M479fdw', 'LaserJet Enterprise M611dn', 'OfficeJet Pro 8025', 'LaserJet Pro MFP M227fdw'] },
  { brand: 'Xerox', models: ['WorkCentre 7855', 'VersaLink C405', 'VersaLink B400', 'Phaser 6510', 'AltaLink C8055', 'WorkCentre 6515', 'VersaLink C7000', 'AltaLink B8045', 'VersaLink B405', 'Phaser 3330'] },
  { brand: 'Brother', models: ['HL-L2350DW', 'MFC-L2710DW', 'HL-L5200DW', 'MFC-L8900CDW', 'DCP-L2550DW', 'HL-L3270CDW', 'MFC-L2750DW', 'HL-L6200DW', 'MFC-L5900DW', 'DCP-L5500DN'] },
  { brand: 'Epson', models: ['EcoTank L3250', 'EcoTank L6270', 'WorkForce Pro WF-4830', 'EcoTank L15150', 'WorkForce Enterprise WF-C5790', 'EcoTank L4260', 'WorkForce Pro WF-3820', 'EcoTank L5290', 'WorkForce Enterprise WF-M5299', 'EcoTank L3210'] },
  { brand: 'Samsung', models: ['ProXpress M4020ND', 'Xpress M2070FW', 'ProXpress C3060FW', 'Xpress M2835DW', 'MultiXpress K7600', 'ProXpress M3870FW', 'Xpress C480FW'] },
  { brand: 'Lexmark', models: ['MS621dn', 'MX521de', 'CS521dn', 'MB2338adw', 'MS431dn', 'CX421adn', 'MS826de'] },
  { brand: 'Canon', models: ['imageRUNNER 2630i', 'imageRUNNER ADVANCE C5535i', 'i-SENSYS MF445dw', 'i-SENSYS LBP623Cdw', 'imageRUNNER 2425', 'MAXIFY GX7010', 'i-SENSYS MF264dw'] },
];

const locations = [
  '1º Andar - Sala 101', '1º Andar - Sala 102', '1º Andar - Sala 103', '1º Andar - Corredor',
  '2º Andar - Sala 201', '2º Andar - Sala 202', '2º Andar - Sala 203', '2º Andar - Copa',
  '3º Andar - Sala 301', '3º Andar - Sala 302', '3º Andar - Sala 303', '3º Andar - Diretoria',
  '4º Andar - Sala 401', '4º Andar - Sala 402', '4º Andar - Auditório',
  'Térreo - Recepção', 'Térreo - Portaria', 'Térreo - Arquivo',
  'Subsolo - Almoxarifado', 'Anexo - Sala 01', 'Anexo - Sala 02',
];

const sectors = [
  { name: 'Diretoria', responsible: 'Carlos Mendes', phone: '(11) 3001-0001' },
  { name: 'Financeiro', responsible: 'Ana Paula Costa', phone: '(11) 3001-0002' },
  { name: 'Recursos Humanos', responsible: 'Maria Santos', phone: '(11) 3001-0003' },
  { name: 'Jurídico', responsible: 'Dr. Roberto Almeida', phone: '(11) 3001-0004' },
  { name: 'TI', responsible: 'Lucas Ferreira', phone: '(11) 3001-0005' },
  { name: 'Marketing', responsible: 'Juliana Rodrigues', phone: '(11) 3001-0006' },
  { name: 'Comercial', responsible: 'Pedro Oliveira', phone: '(11) 3001-0007' },
  { name: 'Compras', responsible: 'Fernanda Lima', phone: '(11) 3001-0008' },
  { name: 'Logística', responsible: 'Ricardo Souza', phone: '(11) 3001-0009' },
  { name: 'Contabilidade', responsible: 'Sandra Pereira', phone: '(11) 3001-0010' },
  { name: 'Atendimento ao Cliente', responsible: 'Bruno Carvalho', phone: '(11) 3001-0011' },
  { name: 'Engenharia', responsible: 'Marcos Teixeira', phone: '(11) 3001-0012' },
  { name: 'Qualidade', responsible: 'Patrícia Gonçalves', phone: '(11) 3001-0013' },
  { name: 'Administração', responsible: 'José Ribeiro', phone: '(11) 3001-0014' },
  { name: 'Secretaria Geral', responsible: 'Cláudia Barbosa', phone: '(11) 3001-0015' },
];

const releaseReasons = [
  'Demanda extra para relatório trimestral',
  'Impressão de contratos urgentes',
  'Preparação de material para auditoria',
  'Campanha de marketing impressa',
  'Impressão de manuais de treinamento',
  'Relatórios anuais para diretoria',
  'Documentação de licitação',
  'Material para evento corporativo',
  'Folha de pagamento extra (13º)',
  'Impressão de propostas comerciais',
  'Balanço patrimonial anual',
  'Preparação para fiscalização',
];

const releaseAuthors = [
  'Eduardo Vieira', 'Carlos Mendes', 'Ana Paula Costa',
  'Dr. Roberto Almeida', 'Lucas Ferreira', 'José Ribeiro',
];

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[rand(0, arr.length - 1)];
}

function generateIP() {
  return `192.168.${rand(0, 5)}.${rand(10, 254)}`;
}

function seed() {
  console.log('Limpando dados existentes...');
  db.exec('DELETE FROM usage_logs');
  db.exec('DELETE FROM releases');
  db.exec('DELETE FROM quotas');
  db.exec('DELETE FROM printers');
  db.exec('DELETE FROM sectors');

  console.log('Inserindo setores...');
  const insertSector = db.prepare('INSERT INTO sectors (name, responsible, phone) VALUES (?, ?, ?)');
  const sectorIds = [];
  for (const s of sectors) {
    const result = insertSector.run(s.name, s.responsible, s.phone);
    sectorIds.push(result.lastInsertRowid);
  }
  console.log(`  ${sectorIds.length} setores criados`);

  console.log('Inserindo 70 impressoras...');
  const insertPrinter = db.prepare('INSERT INTO printers (name, model, location, ip_address) VALUES (?, ?, ?, ?)');
  const printerIds = [];
  const usedNames = new Set();

  for (let i = 0; i < 70; i++) {
    const brandData = pick(printerBrands);
    const model = pick(brandData.models);
    let name = `${brandData.brand} ${model}`;

    let suffix = 2;
    const baseName = name;
    while (usedNames.has(name)) {
      name = `${baseName} #${suffix}`;
      suffix++;
    }
    usedNames.add(name);

    const location = pick(locations);
    const ip = generateIP();
    const result = insertPrinter.run(name, model, location, ip);
    printerIds.push(result.lastInsertRowid);
  }
  console.log(`  ${printerIds.length} impressoras criadas`);

  console.log('Criando cotas para abril/2026...');
  const period = '2026-04';
  const insertQuota = db.prepare(
    'INSERT INTO quotas (printer_id, sector_id, monthly_limit, current_usage, period) VALUES (?, ?, ?, ?, ?)'
  );
  const quotaData = [];

  for (const printerId of printerIds) {
    const numSectors = rand(1, 4);
    const shuffled = [...sectorIds].sort(() => Math.random() - 0.5);
    const selectedSectors = shuffled.slice(0, numSectors);

    for (const sectorId of selectedSectors) {
      const limit = pick([200, 300, 500, 750, 1000, 1500, 2000]);
      const usagePercent = Math.random();
      let usage;
      if (usagePercent < 0.15) {
        usage = rand(0, Math.floor(limit * 0.3));
      } else if (usagePercent < 0.50) {
        usage = rand(Math.floor(limit * 0.3), Math.floor(limit * 0.7));
      } else if (usagePercent < 0.80) {
        usage = rand(Math.floor(limit * 0.7), Math.floor(limit * 0.95));
      } else {
        usage = rand(limit, Math.floor(limit * 1.3));
      }

      const result = insertQuota.run(printerId, sectorId, limit, usage, period);
      quotaData.push({ id: result.lastInsertRowid, limit, usage, printerId, sectorId });
    }
  }
  console.log(`  ${quotaData.length} cotas criadas`);

  console.log('Registrando logs de uso...');
  const insertUsage = db.prepare(
    'INSERT INTO usage_logs (quota_id, pages_used, observation, created_at) VALUES (?, ?, ?, ?)'
  );
  let usageCount = 0;

  for (const q of quotaData) {
    if (q.usage === 0) continue;
    let remaining = q.usage;
    const numLogs = rand(1, 6);

    for (let i = 0; i < numLogs && remaining > 0; i++) {
      const pages = i === numLogs - 1 ? remaining : rand(1, remaining);
      remaining -= pages;
      const day = rand(1, 16).toString().padStart(2, '0');
      const hour = rand(7, 18).toString().padStart(2, '0');
      const min = rand(0, 59).toString().padStart(2, '0');
      const createdAt = `2026-04-${day} ${hour}:${min}:00`;
      const obs = pick([null, null, null, 'Impressão de rotina', 'Relatórios internos', 'Documentos para reunião', 'Cópias de contratos']);
      insertUsage.run(q.id, pages, obs, createdAt);
      usageCount++;
    }
  }
  console.log(`  ${usageCount} logs de uso criados`);

  console.log('Registrando liberações...');
  const insertRelease = db.prepare(
    'INSERT INTO releases (quota_id, amount, reason, released_by, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  const overQuotas = quotaData.filter(q => q.usage >= q.limit);
  let releaseCount = 0;

  for (const q of overQuotas) {
    if (Math.random() < 0.3) continue;
    const extra = rand(50, 500);
    const day = rand(5, 16).toString().padStart(2, '0');
    const hour = rand(8, 17).toString().padStart(2, '0');
    const min = rand(0, 59).toString().padStart(2, '0');
    const createdAt = `2026-04-${day} ${hour}:${min}:00`;

    db.prepare('UPDATE quotas SET monthly_limit = monthly_limit + ? WHERE id = ?').run(extra, q.id);
    insertRelease.run(q.id, extra, pick(releaseReasons), pick(releaseAuthors), createdAt);
    releaseCount++;
  }

  const normalQuotas = quotaData.filter(q => q.usage < q.limit && q.usage > q.limit * 0.7);
  for (const q of normalQuotas) {
    if (Math.random() < 0.85) continue;
    const extra = rand(50, 200);
    const day = rand(1, 16).toString().padStart(2, '0');
    const hour = rand(8, 17).toString().padStart(2, '0');
    const min = rand(0, 59).toString().padStart(2, '0');
    const createdAt = `2026-04-${day} ${hour}:${min}:00`;

    db.prepare('UPDATE quotas SET monthly_limit = monthly_limit + ? WHERE id = ?').run(extra, q.id);
    insertRelease.run(q.id, extra, pick(releaseReasons), pick(releaseAuthors), createdAt);
    releaseCount++;
  }
  console.log(`  ${releaseCount} liberações criadas`);

  const stats = db.prepare(`
    SELECT 
      (SELECT COUNT(*) FROM printers) as printers,
      (SELECT COUNT(*) FROM sectors) as sectors,
      (SELECT COUNT(*) FROM quotas) as quotas,
      (SELECT COUNT(*) FROM usage_logs) as usage_logs,
      (SELECT COUNT(*) FROM releases) as releases
  `).get();

  console.log('\n=== Resumo do Seed ===');
  console.log(`Impressoras: ${stats.printers}`);
  console.log(`Setores:     ${stats.sectors}`);
  console.log(`Cotas:       ${stats.quotas}`);
  console.log(`Logs de uso: ${stats.usage_logs}`);
  console.log(`Liberações:  ${stats.releases}`);
  console.log('======================\n');

  db.close();
  console.log('Seed concluído com sucesso!');
}

seed();
