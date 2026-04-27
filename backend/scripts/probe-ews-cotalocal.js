/**
 * Diagnostico de compatibilidade com a "Cota Local" do EWS HP.
 *
 * Para cada IP passado, verifica se a impressora:
 *   1. Responde HTTP/HTTPS
 *   2. Aceita login admin com a credencial configurada (.env)
 *   3. Possui a pagina LocalQuotaConfiguration
 *   4. Tem as contas Guest/Others (ou Convidado/Outros)
 *
 * Retorna saldos atuais e indica se a impressora esta apta para sync.
 *
 * Uso:
 *   node scripts/probe-ews-cotalocal.js <ip1> [ip2] [ip3] ...
 *   node scripts/probe-ews-cotalocal.js --all     # todos os IPs em printers
 */
require('dotenv').config();
const ews = require('../src/services/hpEwsCotaLocalClient');

let ips = process.argv.slice(2);
if (ips.length === 0) {
  console.error('Uso: node scripts/probe-ews-cotalocal.js <ip1> [ip2] ...');
  console.error('     node scripts/probe-ews-cotalocal.js --all');
  process.exit(1);
}

if (ips[0] === '--all') {
  const db = require('../src/config/db');
  ips = db.prepare(`
    SELECT DISTINCT ip_address
    FROM printers
    WHERE active = 1 AND ip_address IS NOT NULL AND ip_address != ''
    ORDER BY ip_address
  `).all().map(r => r.ip_address);
  console.log(`Modo --all: ${ips.length} IP(s) carregados do banco.`);
}

// Erros transientes que merecem retry (timeout, refused, race de cookie/CSRF).
const TRANSIENT_PATTERNS = [
  /Sem resposta HTTP\/HTTPS/i,
  /CSRFToken nao encontrado em SignIn/i,
  /CSRFToken ausente na pagina de cota/i,
  /fetch failed/i,
  /UND_ERR_(?:CONNECT_TIMEOUT|HEADERS_TIMEOUT|SOCKET|BODY_TIMEOUT)/i,
  /ETIMEDOUT|ECONNRESET|EPIPE/i,
];

function isTransient(msg) {
  if (!msg) return false;
  return TRANSIENT_PATTERNS.some(re => re.test(msg));
}

async function probe(ip, attempts = 2) {
  const t0 = Date.now();
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const status = await ews.getStatus(ip);
      const dt = Date.now() - t0;
      const guest = status.accounts.find(a => /guest|convidado/i.test(a.name));
      const others = status.accounts.find(a => /others|outros/i.test(a.name));
      const admin = status.accounts.find(a => /administra/i.test(a.name));
      ews.clearSessionCache(ip);
      return {
        ip,
        compatible: true,
        ms: dt,
        retried: i > 0,
        defaults: status.defaults,
        guest,
        others,
        admin,
        accountCount: status.accounts.length,
      };
    } catch (err) {
      lastErr = err;
      ews.clearSessionCache(ip);
      if (!isTransient(err.message) || i === attempts - 1) break;
      // Pequeno backoff antes de retry
      await new Promise(res => setTimeout(res, 800 + i * 1200));
    }
  }
  return {
    ip,
    compatible: false,
    ms: Date.now() - t0,
    error: lastErr ? lastErr.message : 'erro desconhecido',
  };
}

(async () => {
  console.log(`\n=== Probe Cota Local em ${ips.length} impressora(s) ===\n`);
  console.log('IP'.padEnd(16) + 'Status'.padEnd(10) + 'ms'.padEnd(7) + 'Guest'.padEnd(12) + 'Others'.padEnd(12) + 'Admin'.padEnd(12) + 'Erro');
  console.log('-'.repeat(100));

  let okCount = 0;
  let failCount = 0;

  for (const ip of ips) {
    const r = await probe(ip);
    if (r.compatible) {
      okCount++;
      const fmt = a => a ? `${a.current}/${a.limit}` : 'N/A';
      const status = r.retried ? 'OK (retry)' : 'OK';
      console.log(
        ip.padEnd(16) +
        status.padEnd(12) +
        String(r.ms).padEnd(7) +
        fmt(r.guest).padEnd(12) +
        fmt(r.others).padEnd(12) +
        fmt(r.admin).padEnd(12)
      );
    } else {
      failCount++;
      console.log(
        ip.padEnd(16) +
        'FAIL'.padEnd(12) +
        String(r.ms).padEnd(7) +
        ''.padEnd(12) +
        ''.padEnd(12) +
        ''.padEnd(12) +
        r.error
      );
    }
  }

  console.log('\n' + '-'.repeat(100));
  console.log(`Compativeis: ${okCount}    Incompativeis: ${failCount}    Total: ${ips.length}`);
})().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
