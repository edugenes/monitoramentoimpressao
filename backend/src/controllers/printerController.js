const printerService = require('../services/printerService');
const snmpService = require('../services/snmpService');
const db = require('../config/db');

function collectSnmpForPrinter(printer) {
  if (!printer.ip_address) return;
  snmpService.readPrinter(printer.ip_address, printer.snmp_community || 'public')
    .then(data => {
      if (data.success && data.pageCount != null) {
        db.prepare(`
          INSERT INTO snmp_readings (printer_id, page_count, color_count, mono_count, toner_level, status, toner_cyan, toner_magenta, toner_yellow, toner_black)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          printer.id,
          data.pageCount,
          data.colorCount ?? null,
          data.monoCount ?? null,
          data.tonerPercent ?? null,
          data.status ?? null,
          data.tonerCyan ?? null,
          data.tonerMagenta ?? null,
          data.tonerYellow ?? null,
          data.tonerBlack ?? null
        );
        snmpService.updateQuotaUsage(printer.id, data.pageCount);
        console.log(`[SNMP] Coleta automatica: ${printer.name} (${printer.ip_address}) - ${data.pageCount} paginas`);
      }
    })
    .catch(() => {});
}

function getAll(req, res, next) {
  try {
    const printers = printerService.getAll();
    res.json(printers);
  } catch (err) {
    next(err);
  }
}

function getById(req, res, next) {
  try {
    const printer = printerService.getById(req.params.id);
    if (!printer) return res.status(404).json({ error: true, message: 'Impressora nao encontrada' });
    res.json(printer);
  } catch (err) {
    next(err);
  }
}

function create(req, res, next) {
  try {
    const printer = printerService.create(req.body);
    collectSnmpForPrinter(printer);
    res.status(201).json(printer);
  } catch (err) {
    next(err);
  }
}

function update(req, res, next) {
  try {
    const printer = printerService.update(req.params.id, req.body);
    if (!printer) return res.status(404).json({ error: true, message: 'Impressora nao encontrada' });
    collectSnmpForPrinter(printer);
    res.json(printer);
  } catch (err) {
    next(err);
  }
}

function remove(req, res, next) {
  try {
    const printer = printerService.remove(req.params.id);
    if (!printer) return res.status(404).json({ error: true, message: 'Impressora nao encontrada' });
    res.json({ message: 'Impressora removida com sucesso' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, getById, create, update, remove };
