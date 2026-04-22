/**
 * Faz SNMP walk numa impressora HP para descobrir qual OID retorna o
 * contador "equivalente A4" (Imprimir + Copiar + Fax) exibido na
 * interface web e cobrado pelo Simpress.
 *
 * Uso:
 *   node scripts/investigar-contadores-snmp.js <ip>
 * Ex:
 *   node scripts/investigar-contadores-snmp.js 192.168.1.192
 */
const snmp = require('net-snmp');

const IP = process.argv[2];
if (!IP) {
  console.error('Uso: node scripts/investigar-contadores-snmp.js <ip>');
  process.exit(1);
}

const TARGET_TOTAL = Number(process.argv[3]) || null; // valor esperado para highlight (ex: 252979)
const COMMUNITY = process.argv[4] || 'public';

// Candidatos: arvores padrao (printer MIB) e HP proprietaria
const ROOT_OIDS = [
  { root: '1.3.6.1.2.1.43.10.2.1.4.1', name: 'Printer MIB prtMarkerLifeCount (totais)' },
  { root: '1.3.6.1.4.1.11.2.3.9.4.2.1.1.16', name: 'HP job counters (impressao/copia/fax)' },
  { root: '1.3.6.1.4.1.11.2.3.9.4.2.1.1.1', name: 'HP device' },
  { root: '1.3.6.1.4.1.11.2.3.9.4.2.1.4', name: 'HP scanner/copy' },
];

function walkOid(session, rootOid) {
  return new Promise((resolve) => {
    const out = [];
    session.subtree(
      rootOid,
      30,
      (varbinds) => {
        for (const vb of varbinds) {
          if (snmp.isVarbindError(vb)) continue;
          if (
            vb.type === snmp.ObjectType.NoSuchObject ||
            vb.type === snmp.ObjectType.NoSuchInstance ||
            vb.type === snmp.ObjectType.EndOfMibView
          ) continue;
          let val = vb.value;
          if (Buffer.isBuffer(val)) {
            const s = val.toString('utf8').trim();
            const n = Number(s);
            val = isNaN(n) ? s : n;
          }
          out.push({ oid: vb.oid, value: val, type: vb.type });
        }
      },
      (err) => {
        if (err) {
          resolve({ error: err.message || String(err), results: out });
        } else {
          resolve({ results: out });
        }
      }
    );
  });
}

(async function main() {
  console.log(`\nAlvo: ${IP} (community ${COMMUNITY})`);
  if (TARGET_TOTAL) console.log(`Procurando valor proximo a ${TARGET_TOTAL.toLocaleString('pt-BR')}`);
  console.log('');

  const session = snmp.createSession(IP, COMMUNITY, {
    timeout: 7000,
    version: snmp.Version2c,
  });
  session.on('error', (err) => console.warn('[SNMP] erro:', err.message));

  const all = [];
  for (const { root, name } of ROOT_OIDS) {
    console.log(`\n====== ${name} (${root}) ======`);
    const res = await walkOid(session, root);
    if (res.error) console.log(`  erro: ${res.error}`);
    if (!res.results || res.results.length === 0) {
      console.log('  (sem retorno)');
      continue;
    }
    // imprime so OIDs numericos (contadores)
    for (const r of res.results) {
      if (typeof r.value !== 'number') continue;
      const highlight = TARGET_TOTAL && Math.abs(r.value - TARGET_TOTAL) < 100 ? '  <<< CANDIDATO!!' : '';
      console.log(`  ${r.oid.padEnd(45)} = ${String(r.value).padStart(12)}${highlight}`);
      all.push(r);
    }
  }

  session.close();

  if (TARGET_TOTAL) {
    console.log('\n====== TOP CANDIDATOS (valor numerico mais proximo do alvo) ======');
    const candidates = all
      .filter(r => typeof r.value === 'number' && r.value > 0)
      .map(r => ({ ...r, diff: Math.abs(r.value - TARGET_TOTAL) }))
      .sort((a, b) => a.diff - b.diff)
      .slice(0, 15);
    for (const c of candidates) {
      console.log(`  diff ${String(c.diff).padStart(8)}  |  ${c.oid.padEnd(45)} = ${c.value}`);
    }
  }

  process.exit(0);
})();
