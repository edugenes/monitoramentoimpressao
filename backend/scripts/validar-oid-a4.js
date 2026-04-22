/**
 * Testa em TODAS as impressoras se o OID HP "...16.4.1.1.2.0" (total A4) retorna
 * um valor valido, e compara com o OID padrao Printer MIB (engine count).
 *
 * NAO altera nada. So imprime o comparativo.
 */
const snmp = require('net-snmp');
const db = require('../src/config/db');

const OID_A4 = '1.3.6.1.4.1.11.2.3.9.4.2.1.1.16.4.1.1.2.0';     // HP total A4 equivalent
const OID_ENGINE = '1.3.6.1.2.1.43.10.2.1.4.1.1';               // Printer MIB engine count

function get(session, oids, timeout = 4000) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve({ error: 'timeout' }), timeout + 500);
    session.get(oids, (err, varbinds) => {
      clearTimeout(t);
      if (err) return resolve({ error: err.message || String(err) });
      resolve({ varbinds });
    });
  });
}

function val(vb) {
  if (!vb || snmp.isVarbindError(vb)) return null;
  if (vb.type === snmp.ObjectType.NoSuchObject ||
      vb.type === snmp.ObjectType.NoSuchInstance ||
      vb.type === snmp.ObjectType.EndOfMibView) return null;
  const v = Buffer.isBuffer(vb.value) ? parseInt(vb.value.toString(), 10) : vb.value;
  return isNaN(v) ? null : v;
}

function fmt(n, w, a='right') {
  const s = n == null ? '-' : Number(n).toLocaleString('pt-BR');
  return a === 'right' ? s.padStart(w) : s.padEnd(w);
}

(async function main() {
  const printers = db.prepare(
    "SELECT name, ip_address, snmp_community FROM printers WHERE active=1 AND ip_address IS NOT NULL ORDER BY name"
  ).all();

  console.log(`\nTestando ${printers.length} impressoras ativas...\n`);
  console.log(fmt('IMPRESSORA',25,'left')+fmt('IP',16,'left')+fmt('A4 (novo)',14)+fmt('ENGINE (atual)',16)+fmt('DIFF',10)+'  %');
  console.log('-'.repeat(90));

  const linhas = [];
  let okA4 = 0, soEngine = 0, ambosFalharam = 0;

  for (const p of printers) {
    const session = snmp.createSession(p.ip_address, p.snmp_community || 'public', {
      timeout: 4000, version: snmp.Version2c,
    });
    session.on('error', () => {});

    const res = await get(session, [OID_A4, OID_ENGINE]);
    session.close();

    let a4 = null, engine = null;
    if (res.varbinds) {
      a4 = val(res.varbinds[0]);
      engine = val(res.varbinds[1]);
    }

    let diff = null, pct = null;
    if (a4 != null && engine != null) {
      diff = engine - a4;
      pct = engine > 0 ? (diff / engine) * 100 : null;
    }

    if (a4 != null) okA4++;
    else if (engine != null) soEngine++;
    else ambosFalharam++;

    const pctStr = pct == null ? '-' : (pct.toFixed(1).replace('.',',') + '%');

    console.log(
      fmt(p.name.substring(0,23),25,'left') +
      fmt(p.ip_address,16,'left') +
      fmt(a4,14) +
      fmt(engine,16) +
      fmt(diff,10) +
      '  ' + pctStr
    );

    linhas.push({ name: p.name, ip: p.ip_address, a4, engine, diff, pct });
  }

  console.log('-'.repeat(90));
  console.log(`\nResumo:`);
  console.log(`  Com OID A4 (novo) funcionando:   ${okA4}`);
  console.log(`  SO com engine (OID novo falhou): ${soEngine}`);
  console.log(`  Ambos falharam (offline?):       ${ambosFalharam}`);

  // Estatisticas de diff
  const comDiff = linhas.filter(l => l.pct != null);
  if (comDiff.length > 0) {
    const pctMedia = comDiff.reduce((s,l)=>s+l.pct,0) / comDiff.length;
    console.log(`\n  Diff medio (engine vs A4): ${pctMedia.toFixed(1)}%`);
    console.log(`  Diff minimo: ${Math.min(...comDiff.map(l=>l.pct)).toFixed(1)}%`);
    console.log(`  Diff maximo: ${Math.max(...comDiff.map(l=>l.pct)).toFixed(1)}%`);
  }

  process.exit(0);
})();
