const cron = require('node-cron');
const snmpService = require('../services/snmpService');

const COLLECT_INTERVAL = process.env.SNMP_COLLECT_INTERVAL || '*/30 * * * *';
const MONTH_CLOSE_SCHEDULE = '1 0 1 * *'; // dia 1 de cada mes as 00:01

function getPreviousPeriod() {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1);
  const year = prev.getFullYear();
  const month = String(prev.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getCurrentPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function start() {
  cron.schedule(COLLECT_INTERVAL, async () => {
    console.log(`[Scheduler] Iniciando coleta SNMP - ${new Date().toLocaleString('pt-BR')}`);
    try {
      await snmpService.collectAll();
    } catch (err) {
      console.error('[Scheduler] Erro na coleta SNMP:', err.message);
    }
  });

  cron.schedule(MONTH_CLOSE_SCHEDULE, async () => {
    console.log(`[Scheduler] Fechamento mensal - ${new Date().toLocaleString('pt-BR')}`);
    try {
      const prevPeriod = getPreviousPeriod();
      const currentPeriod = getCurrentPeriod();

      snmpService.closeMonth(prevPeriod);
      snmpService.rolloverMonth(prevPeriod, currentPeriod);

      console.log(`[Scheduler] Fechamento concluido: ${prevPeriod} -> ${currentPeriod}`);
    } catch (err) {
      console.error('[Scheduler] Erro no fechamento mensal:', err.message);
    }
  });

  console.log(`[Scheduler] Coleta SNMP agendada: ${COLLECT_INTERVAL}`);
  console.log(`[Scheduler] Fechamento mensal agendado: ${MONTH_CLOSE_SCHEDULE}`);
}

module.exports = { start };
