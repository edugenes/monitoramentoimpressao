const cron = require('node-cron');
const snmpService = require('../services/snmpService');
const alertService = require('../services/alertService');
const printerControlService = require('../services/printerControlService');

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
      const alertResult = alertService.generateAlerts();
      if (alertResult.created > 0 || alertResult.resolved > 0) {
        console.log(`[Alerts] +${alertResult.created} criados, -${alertResult.resolved} resolvidos`);
      }
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

      // Reseta Cota Local de todas as impressoras com sync habilitado.
      // Mesmo que falhe pra algumas, o cron roda mensalmente e os retries
      // do sync por coleta vao tentar novamente.
      try {
        const reset = await printerControlService.resetMonth({ triggeredBy: 'rollover' });
        console.log(`[Scheduler] Cota Local resetada em ${reset.processed} impressora(s)`);
      } catch (err) {
        console.warn('[Scheduler] Erro no reset de Cota Local:', err.message);
      }

      console.log(`[Scheduler] Fechamento concluido: ${prevPeriod} -> ${currentPeriod}`);
    } catch (err) {
      console.error('[Scheduler] Erro no fechamento mensal:', err.message);
    }
  });

  console.log(`[Scheduler] Coleta SNMP agendada: ${COLLECT_INTERVAL}`);
  console.log(`[Scheduler] Fechamento mensal agendado: ${MONTH_CLOSE_SCHEDULE}`);
}

module.exports = { start };
