/**
 * Testa todos os OIDs candidatos em todas as impressoras,
 * pega o 1o que tiver valor proximo (>= baseline do Simpress e < engine count)
 */
const snmp = require('net-snmp');
const XLSX = require('xlsx');
const db = require('../src/config/db');

const SIMPRESS_PATH = process.argv[2];
if (!SIMPRESS_PATH) { console.error('arg1: simpress.xlsx'); process.exit(1); }

const CANDIDATOS = [
  { nome: 'A4_total_mono',   oid: '1.3.6.1.4.1.11.2.3.9.4.2.1.1.16.4.1.1.2.0' },
  { nome: 'A4_total_color',  oid: '1.3.6.1.4.1.11.2.3.9.4.2.1.1.16.1.38.13.26.0' },
  { nome: 'engine',          oid: '1.3.6.1.2.1.43.10.2.1.4.1.1' },
];

function get(session, oids, t=4000) {
  return new Promise(r => {
    const tm = setTimeout(() => r({ error: 'timeout' }), t+500);
    session.get(oids, (err, vbs) => { clearTimeout(tm); err ? r({error:err.message||String(err)}) : r({varbinds:vbs}); });
  });
}
function val(vb) {
  if (!vb || snmp.isVarbindError(vb)) return null;
  if (vb.type === snmp.ObjectType.NoSuchObject || vb.type === snmp.ObjectType.NoSuchInstance || vb.type === snmp.ObjectType.EndOfMibView) return null;
  const v = Buffer.isBuffer(vb.value) ? parseInt(vb.value.toString(),10) : vb.value;
  return isNaN(v) ? null : v;
}

const baselinePorSerie={}, baselinePorIp={};
{
  const wb=XLSX.readFile(SIMPRESS_PATH);
  const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:null});
  for(let i=1;i<rows.length;i++){
    const r=rows[i]; if(!r||!r[2]) continue;
    const serie=String(r[2]).trim().toUpperCase();
    const ip=r[3]?String(r[3]).trim():'';
    const c=(Number(r[14])||0)+(Number(r[15])||0)+(Number(r[16])||0)+(Number(r[17])||0);
    baselinePorSerie[serie]={contador:c}; if(ip) baselinePorIp[ip]={contador:c};
  }
}

const ps = db.prepare(
  "SELECT name,ip_address,model,serial_number,snmp_community FROM printers WHERE active=1 AND ip_address IS NOT NULL ORDER BY name"
).all();

(async function main() {
  console.log('\nTestando 3 OIDs em ' + ps.length + ' impressoras (valor usado = primeiro >= baseline e < engine*1.02)\n');
  console.log('IMPRESSORA               MODELO                     BASELINE    A4_MONO    A4_COLOR    ENGINE   => ESCOLHIDO');
  console.log('-'.repeat(120));

  let chosenMono=0, chosenColor=0, chosenEngine=0, noBaseline=0, offline=0;
  const detalhes=[];

  for (const p of ps) {
    let base=null;
    if (p.serial_number) base=baselinePorSerie[p.serial_number.trim().toUpperCase()]||null;
    if (!base && p.ip_address) base=baselinePorIp[p.ip_address.trim()]||null;
    const baseline = base?base.contador:null;

    const session = snmp.createSession(p.ip_address, p.snmp_community||'public', { timeout:4000, version: snmp.Version2c });
    session.on('error', ()=>{});
    const res = await get(session, CANDIDATOS.map(c=>c.oid));
    session.close();

    let vals = {};
    if (res.varbinds) {
      for (let i=0;i<CANDIDATOS.length;i++) vals[CANDIDATOS[i].nome] = val(res.varbinds[i]);
    }
    const vMono=vals.A4_total_mono, vColor=vals.A4_total_color, vEngine=vals.engine;

    let escolhido='-', escolhidoVal=null;
    if (vEngine == null) { escolhido='OFFLINE'; offline++; }
    else if (baseline == null) { escolhido='?SEM_BASELINE'; noBaseline++; }
    else {
      // regra: valor >= baseline e <= engine*1.02 (pequena tolerancia)
      const plausivel = (v) => v != null && v >= baseline && v <= vEngine * 1.02;
      if (plausivel(vMono)) { escolhido='A4_mono'; escolhidoVal=vMono; chosenMono++; }
      else if (plausivel(vColor)) { escolhido='A4_color'; escolhidoVal=vColor; chosenColor++; }
      else { escolhido='engine(fallback)'; escolhidoVal=vEngine; chosenEngine++; }
    }

    const fmt = (n,w) => { const s=n==null?'-':Number(n).toLocaleString('pt-BR'); return s.padStart(w); };

    console.log(
      p.name.substring(0,24).padEnd(25) +
      (p.model||'-').substring(0,26).padEnd(27) +
      fmt(baseline,10) +
      fmt(vMono,11) +
      fmt(vColor,12) +
      fmt(vEngine,10) +
      '   ' + escolhido
    );

    detalhes.push({name:p.name,model:p.model,baseline,vMono,vColor,vEngine,escolhido,escolhidoVal});
  }

  console.log('-'.repeat(120));
  console.log(`\nResumo das escolhas:`);
  console.log(`  A4 mono  ('16.4.1.1.2.0'):        ${chosenMono}`);
  console.log(`  A4 color ('16.1.38.13.26.0'):     ${chosenColor}`);
  console.log(`  Engine (fallback):                ${chosenEngine}`);
  console.log(`  Sem baseline:                     ${noBaseline}`);
  console.log(`  Offline no teste:                 ${offline}`);

  process.exit(0);
})();
