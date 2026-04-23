'use strict';

/**
 * Classifica todas as impressoras cadastradas em um dos 3 tipos
 * (MONOCROMATICA / MULTIFUNCIONAL_MONO / MULTIFUNCIONAL_COLOR),
 * atualizando a coluna printers.type_id.
 *
 * Ordem de prioridade para determinar o tipo:
 *   1. printers.serial_number ja populado -> busca na lista da planilha HSE
 *   2. Se serial_number NULO, tenta deduzir a partir do nome da impressora
 *      cruzando com o seed-real-printers.js (grava serial_number no processo)
 *   3. Fallback por modelo (E50145DN / E52645C / Color)
 *
 * Script idempotente - pode rodar multiplas vezes. Nao apaga nada.
 */

const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

const SERIAIS_MONO = [
  'BRBSS5D048', 'BRBSS6M0KD', 'BRBSS6M0KG', 'BRBSS5D07B', 'BRBSS6M0KF',
  'BRBSS6M0K5', 'BRBSS5B07R', 'BRBSS5D07N', 'BRBSS6M0LQ', 'BRBSS6M0LM',
  'BRBSS5D046', 'BRBSS6M0KJ', 'BRBSS5B07S', 'BRBSS5D070', 'BRBSS5B07N',
  'BRBSS5D04B', 'BRBSS6M0LT', 'BRBSS6M0LG', 'BRBSS6M0LK', 'BRBSS6M0LV',
  'BRBSS6M0LP', 'BRBSS6M0H7', 'BRBSS6M0KB', 'BRBSS6M0GS', 'BRBSS6M0LH',
  'BRBSS6M0JM', 'BRBSS5B082', 'BRBSS6M0KH', 'BRBSS6M0LW', 'BRBSS5D049',
  'BRBSS5B088', 'BRBSS5D044', 'BRBSS6M0KT', 'BRBSS6M0JJ', 'BRBSS6M0LR',
  'BRBSS6M0LN', 'BRBSS5D07J', 'BRBSS6M0JC', 'BRBSS5D07L', 'BRBSS6M0LJ',
  'BRBSS6M0LS', 'BRBSS6M0HL', 'BRBSS6M0KC', 'BRBSS5D07M', 'BRBSS6M0LL',
];

const SERIAIS_MFP_MONO = [
  'BRBSS3L08P', 'BRBSS3S0G7', 'BRBSS3L08V', 'BRBSS3M02B', 'BRBSS3L049',
  'BRBSS3S042', 'BRBSS3S0K0', 'BRBSS3L08N', 'BRBSS3M03T', 'BRBSS3L04C',
  'BRBSS3S05T', 'BRBSS3S0KM', 'BRBSS3S049', 'BRBSS3L0YQ', 'BRBSS3S0HS',
  'BRBSS3M00G', 'BRBSS3S0HK', 'BRBSS3S03H', 'BRBSS3S0HD', 'BRBSS3L047',
  'BRBSS3S0KQ', 'BRBSS3M041', 'BRBSS3L0YK', 'BRBSS3S045', 'BRBSS3S05Y',
  'BRBSS3S0L2', 'BRBSS3M00Y',
];

const SERIAIS_COLOR = [
  'BRBSS5805R', 'JPBCS4B03C', 'BRBSS4G03T', 'BRBSS4G036',
];

function normalizeSerial(s) {
  if (s === null || s === undefined) return null;
  return String(s).trim().toUpperCase();
}

function normalizeName(s) {
  if (s === null || s === undefined) return '';
  return String(s).trim().toUpperCase();
}

/**
 * Le seed-real-printers.js e extrai um mapeamento nome->serial.
 * Assim conseguimos popular printers.serial_number automaticamente
 * em servidores antigos onde o cadastro inicial nao guardou o serial.
 */
function buildNameToSerialMap() {
  const seedPath = path.join(__dirname, 'seed-real-printers.js');
  const map = new Map();
  if (!fs.existsSync(seedPath)) return map;
  const src = fs.readFileSync(seedPath, 'utf-8');
  const re = /\{\s*name:\s*'([^']+)'[^}]*?serial:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    map.set(normalizeName(m[1]), m[2]);
  }
  return map;
}

function classificarPorModelo(model) {
  if (!model) return null;
  const m = model.toUpperCase();
  if (m.includes('E50145DN')) return 'MONOCROMATICA';
  if (m.includes('E52645C')) return 'MULTIFUNCIONAL_MONO';
  if (m.includes('COLOR') || m.includes('X57945') || m.includes('X55745') || m.includes('E78635')) {
    return 'MULTIFUNCIONAL_COLOR';
  }
  return null;
}

function run() {
  const typeIdByCode = {};
  for (const t of db.prepare('SELECT id, code FROM printer_types').all()) {
    typeIdByCode[t.code] = t.id;
  }
  if (!typeIdByCode.MONOCROMATICA || !typeIdByCode.MULTIFUNCIONAL_MONO || !typeIdByCode.MULTIFUNCIONAL_COLOR) {
    throw new Error('printer_types nao populado. Rode a migration 007_printer_types.sql antes.');
  }

  const serialToCode = new Map();
  for (const s of SERIAIS_MONO) serialToCode.set(normalizeSerial(s), 'MONOCROMATICA');
  for (const s of SERIAIS_MFP_MONO) serialToCode.set(normalizeSerial(s), 'MULTIFUNCIONAL_MONO');
  for (const s of SERIAIS_COLOR) serialToCode.set(normalizeSerial(s), 'MULTIFUNCIONAL_COLOR');

  const nameToSerial = buildNameToSerialMap();

  const printers = db.prepare('SELECT id, name, model, serial_number, type_id FROM printers').all();
  const updateType   = db.prepare('UPDATE printers SET type_id = ? WHERE id = ?');
  const updateSerial = db.prepare('UPDATE printers SET serial_number = ? WHERE id = ?');

  let bySerial = 0;
  let byModel = 0;
  let unchanged = 0;
  let seriaisPopulados = 0;
  const semSerialNaPlanilha = [];
  const semClassificacao = [];

  const tx = db.transaction(() => {
    for (const p of printers) {
      let serial = normalizeSerial(p.serial_number);

      if (!serial) {
        const guessed = nameToSerial.get(normalizeName(p.name));
        if (guessed) {
          serial = normalizeSerial(guessed);
          updateSerial.run(serial, p.id);
          seriaisPopulados++;
        }
      }

      let code = serial ? serialToCode.get(serial) : null;
      let via = 'serial';

      if (!code) {
        code = classificarPorModelo(p.model);
        via = 'modelo';
        if (code) {
          semSerialNaPlanilha.push({ id: p.id, name: p.name, serial: serial || p.serial_number, model: p.model, code });
        }
      }

      if (!code) {
        semClassificacao.push({ id: p.id, name: p.name, serial: serial || p.serial_number, model: p.model });
        continue;
      }

      const newTypeId = typeIdByCode[code];
      if (p.type_id === newTypeId) {
        unchanged++;
      } else {
        updateType.run(newTypeId, p.id);
        if (via === 'serial') bySerial++; else byModel++;
      }
    }
  });
  tx();

  const seriaisBanco = new Set(printers.map(p => normalizeSerial(p.serial_number)).filter(Boolean));
  const seriaisPlanilhaFaltando = [];
  for (const [serial, code] of serialToCode.entries()) {
    if (!seriaisBanco.has(serial)) {
      seriaisPlanilhaFaltando.push({ serial, code });
    }
  }

  console.log('');
  console.log('=== Classificacao de impressoras por tipo ===');
  console.log(`  Seriais populados       : ${seriaisPopulados}`);
  console.log(`  Atualizadas por serial  : ${bySerial}`);
  console.log(`  Atualizadas por modelo  : ${byModel}`);
  console.log(`  Ja estavam corretas     : ${unchanged}`);

  if (semSerialNaPlanilha.length > 0) {
    console.log('');
    console.log(`  [AVISO] ${semSerialNaPlanilha.length} impressora(s) classificada(s) por modelo (serial nao esta na planilha HSE):`);
    for (const p of semSerialNaPlanilha) {
      console.log(`    - #${p.id} ${p.name} (serial=${p.serial || '-'}, model=${p.model || '-'}) -> ${p.code}`);
    }
  }

  if (semClassificacao.length > 0) {
    console.log('');
    console.log(`  [ATENCAO] ${semClassificacao.length} impressora(s) NAO foram classificadas (sem serial na planilha e sem modelo reconhecido):`);
    for (const p of semClassificacao) {
      console.log(`    - #${p.id} ${p.name} (serial=${p.serial || '-'}, model=${p.model || '-'})`);
    }
  }

  if (seriaisPlanilhaFaltando.length > 0) {
    console.log('');
    console.log(`  [INFO] ${seriaisPlanilhaFaltando.length} serial(is) da planilha HSE ainda nao cadastrado(s) no banco:`);
    for (const s of seriaisPlanilhaFaltando) {
      console.log(`    - ${s.serial} (${s.code})`);
    }
  }

  console.log('');
  const totals = db.prepare(`
    SELECT pt.code, pt.name, pt.monthly_pool, COUNT(p.id) as qtd
    FROM printer_types pt
    LEFT JOIN printers p ON p.type_id = pt.id AND p.active = 1
    GROUP BY pt.id
    ORDER BY pt.id
  `).all();
  console.log('  Distribuicao atual:');
  for (const t of totals) {
    console.log(`    ${t.code.padEnd(22)} ${String(t.qtd).padStart(3)} impressora(s)  pool=${t.monthly_pool}`);
  }
  console.log('');
}

if (require.main === module) {
  try {
    run();
    console.log('Classificacao concluida.');
  } catch (err) {
    console.error('Erro durante a classificacao:', err.message);
    process.exitCode = 1;
  }
}

module.exports = { run };
