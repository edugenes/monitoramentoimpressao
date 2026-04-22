/**
 * Forca uma coleta SNMP imediata em todas as impressoras ativas
 * e recalcula current_usage de cada cota.
 *
 * Util apos importar baseline: gera a "leitura atual" que junto com
 * o baseline determina o uso real do mes.
 */

const snmpService = require('../src/services/snmpService');

(async () => {
  console.log('Iniciando coleta SNMP forcada... (pode demorar ~1 minuto)\n');
  try {
    const result = await snmpService.collectAll();
    console.log('\n==================== RESULTADO ====================');
    console.log(`Total de impressoras : ${result.total}`);
    console.log(`Sucesso              : ${result.success}`);
    console.log(`Falhas               : ${result.failed}`);
    console.log('===================================================\n');

    if (result.failed > 0) {
      console.log('--- Impressoras que falharam (timeout/offline/IP errado) ---');
      for (const d of result.details) {
        if (d.error) {
          console.log(`  IP ${String(d.ip).padEnd(16)} | ${d.error}`);
        }
      }
    }

    console.log('\nAs cotas current_usage ja foram atualizadas automaticamente.');
    console.log('Atualize o navegador (Ctrl+F5) para ver os novos valores.\n');
    process.exit(0);
  } catch (err) {
    console.error('\n[ERRO] Falha na coleta:', err.message || err);
    process.exit(1);
  }
})();
