/**
 * Recalcula o uso do mes SUBSTITUINDO o contador SNMP atual (engine)
 * pelo contador A4 (OID HP 16.4.1.1.2.0).
 *
 * Baseline continua sendo o valor do Simpress de 01/04 (que ja e A4 total).
 * Assim a subtracao fica homogenea: A4_atual - A4_baseline = uso real do mes.
 *
 * Uso:
 *   node scripts/comparar-uso-novo-oid.js "<simpress.xlsx>"
 */
const snmp = require('net-snmp');
const XLSX = require('xlsx');
const db = require('../src/config/db');

const SIMPRESS_PATH = process.argv[2];
if (!SIMPRESS_PATH) {
  console.error('Uso: node scripts/comparar-uso-novo-oid.js "<simpress.xlsx>"');
  process.exit(1);
}

const OID_A4 = '1.3.6.1.4.1.11.2.3.9.4.2.1.1.16.4.1.1.2.0';

function get(session, oids, timeout=4000) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve({ error: 'timeout' }), timeout+500);
    session.get(oids, (err, vbs) => {
      clearTimeout(t);
      if (err) return resolve({ error: err.message || String(err) });
      resolve({ varbinds: vbs });
    });
  });
}
function val(vb) {
  if (!vb || snmp.isVarbindError(vb)) return null;
  if (vb.type === snmp.ObjectType.NoSuchObject ||
      vb.type === snmp.ObjectType.NoSuchInstance ||
      vb.type === snmp.ObjectType.EndOfMibView) return null;
  const v = Buffer.isBuffer(vb.value) ? parseInt(vb.value.toString(),10) : vb.value;
  return isNaN(v) ? null : v;
}

// baseline Simpress
const baselinePorSerie = {}, baselinePorIp = {};
{
  const wb = XLSX.readFile(SIMPRESS_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  for (let i=1;i<rows.length;i++) {
    const r=rows[i]; if(!r||!r[2]) continue;
    const serie=String(r[2]).trim().toUpperCase();
    const ip=r[3]?String(r[3]).trim():'';
    const c=(Number(r[14])||0)+(Number(r[15])||0)+(Number(r[16])||0)+(Number(r[17])||0);
    baselinePorSerie[serie]={serie,ip,contador:c};
    if(ip) baselinePorIp[ip]={serie,ip,contador:c};
  }
}

const impressoras = db.prepare(`
  SELECT p.id, p.name, p.ip_address, p.serial_number, p.snmp_community,
         s.name AS setor_name, q.monthly_limit
  FROM printers p
  LEFT JOIN sectors s ON p.sector_id=s.id
  LEFT JOIN quotas q ON q.printer_id=p.id AND q.period='2026-04'
  WHERE p.active=1 AND p.ip_address IS NOT NULL
  ORDER BY p.name
`).all();

(async function main() {
  console.log(`\nLendo OID A4 ao vivo em ${impressoras.length} impressoras...\n`);

  const linhas = [];
  for (const p of impressoras) {
    let base = null;
    if (p.serial_number) base = baselinePorSerie[p.serial_number.trim().toUpperCase()] || null;
    if (!base && p.ip_address) base = baselinePorIp[p.ip_address.trim()] || null;
    const baseline = base ? base.contador : null;

    const session = snmp.createSession(p.ip_address, p.snmp_community||'public', {
      timeout: 4000, version: snmp.Version2c,
    });
    session.on('error',()=>{});
    const res = await get(session, [OID_A4]);
    session.close();
    const atualA4 = res.varbinds ? val(res.varbinds[0]) : null;

    const usoNovo = (atualA4 != null && baseline != null) ? Math.max(atualA4 - baseline, 0) : null;
    const cota = p.monthly_limit;
    const pctNovo = (cota && cota>0 && usoNovo!=null) ? (usoNovo/cota)*100 : null;

    linhas.push({
      nome:p.name, setor:p.setor_name, ip:p.ip_address,
      baseline, atualA4, usoNovo, cota, pctNovo,
    });
  }

  function fmt(v,w,a='right') {
    const s = v==null ? '-' : (typeof v==='number' ? v.toLocaleString('pt-BR') : String(v));
    return a==='right' ? s.padStart(w) : s.padEnd(w);
  }
  function pct(v){ return v==null ? '-' : v.toFixed(1).replace('.',',')+'%'; }

  linhas.sort((a,b)=>{
    const pa=a.pctNovo==null?-1:a.pctNovo, pb=b.pctNovo==null?-1:b.pctNovo;
    return pb-pa;
  });

  console.log('USO DO MES RECALCULADO COM OID A4 (novo)\n');
  console.log(fmt('IMPRESSORA',25,'left')+fmt('BASELINE',12)+fmt('A4 ATUAL',12)+fmt('USO MES',10)+fmt('COTA',10)+fmt('%',8)+'  STATUS');
  console.log('-'.repeat(100));

  let excedeu=0, perto=0, ok=0, semBase=0;
  for (const l of linhas) {
    let status='';
    if (l.usoNovo==null) { status='SEM DADOS'; semBase++; }
    else if (l.cota==null) status='SEM COTA';
    else if (l.pctNovo>=100) { status='EXCEDEU'; excedeu++; }
    else if (l.pctNovo>=80) { status='ATENCAO'; perto++; }
    else { status='ok'; ok++; }

    console.log(
      fmt(l.nome.substring(0,23),25,'left') +
      fmt(l.baseline,12) +
      fmt(l.atualA4,12) +
      fmt(l.usoNovo,10) +
      fmt(l.cota,10) +
      fmt(pct(l.pctNovo),8) +
      '  ' + status
    );
  }
  console.log('-'.repeat(100));

  console.log('\n==== RESUMO COM OID A4 ====');
  console.log(`EXCEDERAM:    ${excedeu}`);
  console.log(`ATENCAO:      ${perto}`);
  console.log(`OK:           ${ok}`);
  console.log(`Sem dados:    ${semBase}`);
  console.log('============================\n');

  process.exit(0);
})();
