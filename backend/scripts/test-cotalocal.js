/**
 * Smoke test do hpEwsCotaLocalClient.
 *
 * Uso:
 *   node scripts/test-cotalocal.js <ip> [--write <conta>=<creditos>] [--reset <conta>]
 *
 * Sem flags: so faz getStatus (read-only, seguro).
 *
 * Variaveis de ambiente:
 *   EWS_USERNAME (default: admin)
 *   EWS_PASSWORD (obrigatoria)
 */
require('dotenv').config();
const ews = require('../src/services/hpEwsCotaLocalClient');

const args = process.argv.slice(2);
const ip = args[0];
if (!ip) {
  console.error('Uso: node scripts/test-cotalocal.js <ip> [--write <conta>=<n>] [--reset <conta>]');
  process.exit(1);
}

const writeFlag = args.indexOf('--write');
const resetFlag = args.indexOf('--reset');

async function main() {
  console.log(`\n=== Smoke test ${ip} ===\n`);
  console.log(`EWS_USERNAME=${process.env.EWS_USERNAME || 'admin'}  EWS_PASSWORD=${(process.env.EWS_PASSWORD || '').replace(/./g, '*')}`);

  // 1. STATUS
  console.log('\n[1] getStatus()...');
  const t0 = Date.now();
  const status = await ews.getStatus(ip);
  console.log(`    OK em ${Date.now() - t0}ms`);
  console.log(`    Defaults: credits=${status.defaults.credits} action=${status.defaults.action} blackCost=${status.defaults.blackCost} emptyCost=${status.defaults.emptyCost}`);
  console.log(`    Contas:`);
  for (const a of status.accounts) {
    console.log(`        - ${a.name}: ${a.current} / ${a.limit}  (${a.action})`);
  }

  // 2. WRITE (opcional)
  if (writeFlag !== -1) {
    const spec = args[writeFlag + 1];
    if (!spec || !spec.includes('=')) {
      console.error('  --write requer formato Conta=N (ex: --write Guest=350)');
      process.exit(1);
    }
    const [account, creditsStr] = spec.split('=');
    const credits = parseInt(creditsStr, 10);
    console.log(`\n[2] setUserQuota(${account}, ${credits})...`);
    const t1 = Date.now();
    const r = await ews.setUserQuota(ip, account, credits);
    console.log(`    OK em ${Date.now() - t1}ms:`);
    console.log(`    ${JSON.stringify(r, null, 2)}`);

    // re-le
    console.log('\n[2.1] re-getStatus para confirmar...');
    const after = await ews.getStatus(ip);
    const acc = after.accounts.find(a => a.name === account);
    console.log(`    ${account}: ${acc?.current} / ${acc?.limit}  (${acc?.action})`);
  }

  // 3. RESET (opcional)
  if (resetFlag !== -1) {
    const account = args[resetFlag + 1];
    if (!account) {
      console.error('  --reset requer nome da conta (ex: --reset Guest)');
      process.exit(1);
    }
    console.log(`\n[3] resetUserQuota(${account})...`);
    const t2 = Date.now();
    const r = await ews.resetUserQuota(ip, account);
    console.log(`    OK em ${Date.now() - t2}ms:`);
    console.log(`    ${JSON.stringify(r, null, 2)}`);

    console.log('\n[3.1] re-getStatus para confirmar...');
    const after = await ews.getStatus(ip);
    const acc = after.accounts.find(a => a.name === account);
    console.log(`    ${account}: ${acc?.current} / ${acc?.limit}  (${acc?.action})`);
  }

  console.log('\nFim.');
}

main().catch(err => {
  console.error('\nERRO:', err.message);
  console.error(err.stack);
  process.exit(1);
});
