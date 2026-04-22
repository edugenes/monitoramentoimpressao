const snmpService = require('../services/snmpService');
const printerService = require('../services/printerService');
const alertService = require('../services/alertService');
const { getSectorFilter } = require('../middleware/auth');

async function collect(req, res, next) {
  try {
    const results = await snmpService.collectAll();
    const alertResult = alertService.generateAlerts();
    res.json({ ...results, alerts: alertResult });
  } catch (err) {
    next(err);
  }
}

async function testPrinter(req, res, next) {
  try {
    const printer = printerService.getById(req.params.id);
    if (!printer) return res.status(404).json({ error: true, message: 'Impressora nao encontrada' });
    if (!printer.ip_address) return res.status(400).json({ error: true, message: 'Impressora sem endereco IP' });

    const result = await snmpService.readPrinter(printer.ip_address, printer.snmp_community || 'public');
    res.json({ printer_name: printer.name, ...result });
  } catch (err) {
    next(err);
  }
}

function getReadings(req, res, next) {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const readings = snmpService.getReadings(req.params.printerId, limit);
    res.json(readings);
  } catch (err) {
    next(err);
  }
}

function getLatestReadings(req, res, next) {
  try {
    const sectorIds = getSectorFilter(req);
    let readings = snmpService.getLatestReadings();
    if (sectorIds && sectorIds.length > 0) {
      const printers = printerService.getAll(sectorIds);
      const printerIds = new Set(printers.map(p => p.id));
      readings = readings.filter(r => printerIds.has(r.printer_id));
    }
    if (req.user && req.user.role !== 'admin') {
      readings = readings.map(({ ip_address, ...rest }) => rest);
    }
    res.json(readings);
  } catch (err) {
    next(err);
  }
}

function getSnapshots(req, res, next) {
  try {
    const period = req.query.period;
    if (!period) return res.status(400).json({ error: true, message: 'Periodo e obrigatorio (formato: YYYY-MM)' });
    const snapshots = snmpService.getSnapshots(period);
    res.json(snapshots);
  } catch (err) {
    next(err);
  }
}

function closeMonth(req, res, next) {
  try {
    const period = req.body.period;
    if (!period) return res.status(400).json({ error: true, message: 'Periodo e obrigatorio' });
    const results = snmpService.closeMonth(period);
    res.json({ period, processed: results.length, details: results });
  } catch (err) {
    next(err);
  }
}

function rolloverMonth(req, res, next) {
  try {
    const { from_period, to_period } = req.body;
    if (!from_period || !to_period) return res.status(400).json({ error: true, message: 'from_period e to_period sao obrigatorios' });
    const result = snmpService.rolloverMonth(from_period, to_period);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

function getStatus(req, res, next) {
  try {
    const status = snmpService.getCollectionStatus();
    res.json(status);
  } catch (err) {
    next(err);
  }
}

module.exports = { collect, testPrinter, getReadings, getLatestReadings, getSnapshots, closeMonth, rolloverMonth, getStatus };
