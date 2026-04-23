import { ReportBySector, ReportByPrinter, Release, PrinterTypePoolStatus } from './types';
import { formatDateTime } from './dateUtils';

type Tab = 'sector' | 'printer' | 'releases';

interface BuildOpts {
  tab: Tab;
  periodLabel: string;
  weekLabel: string;
  sectorData: ReportBySector[];
  printerData: ReportByPrinter[];
  releasesData: Release[];
  pools?: PrinterTypePoolStatus[];
}

const fmtInt = (n: number) =>
  Number.isFinite(n) ? n.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '0';
const fmtPct = (n: number) =>
  Number.isFinite(n) ? n.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%' : '0%';

function escape(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function statusFor(pct: number): { label: string; cls: string } {
  if (pct >= 100) return { label: 'Excedido', cls: 'st-red' };
  if (pct >= 80) return { label: 'Alerta', cls: 'st-yellow' };
  return { label: 'Normal', cls: 'st-green' };
}

function barColor(pct: number): string {
  if (pct >= 100) return '#dc2626';
  if (pct >= 80) return '#ca8a04';
  if (pct >= 50) return '#2563eb';
  return '#16a34a';
}

function printCss(): string {
  return `
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #0f172a;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-size: 11px;
      line-height: 1.45;
    }
    body { padding: 28px 32px 60px; }
    @page { size: A4; margin: 14mm; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }
      .page-break { page-break-before: always; }
      .avoid-break { page-break-inside: avoid; }
    }

    .cover {
      display: flex; align-items: stretch; justify-content: space-between;
      gap: 24px;
      border-bottom: 3px solid #0f172a;
      padding-bottom: 18px;
      margin-bottom: 22px;
    }
    .brand {
      display: flex; flex-direction: column; justify-content: center;
      min-width: 180px;
    }
    .brand-logo {
      font-size: 32px; font-weight: 800; letter-spacing: -1px;
      color: #0f172a; line-height: 1;
    }
    .brand-logo .accent { color: #2563eb; }
    .brand-tagline {
      font-size: 10px; color: #64748b; margin-top: 6px;
      text-transform: uppercase; letter-spacing: 1.2px; font-weight: 600;
    }
    .cover-right { flex: 1; text-align: right; }
    .cover-right h1 {
      margin: 0 0 8px;
      font-size: 22px; font-weight: 700; color: #0f172a;
      letter-spacing: -0.3px;
    }
    .cover-right .subtitle {
      font-size: 12px; color: #475569; margin-bottom: 14px;
    }
    .meta-grid {
      display: grid; grid-template-columns: repeat(4, auto);
      gap: 0 20px;
      justify-content: flex-end;
      font-size: 10px;
    }
    .meta-grid > div { text-align: right; }
    .meta-grid .k {
      display: block; color: #94a3b8;
      text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; font-size: 9px;
      margin-bottom: 2px;
    }
    .meta-grid .v {
      display: block; color: #0f172a; font-weight: 600; font-size: 11px;
    }

    .kpis {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
      margin-bottom: 22px;
    }
    .kpi {
      border: 1px solid #e2e8f0;
      border-left-width: 4px; border-left-color: #cbd5e1;
      border-radius: 8px;
      padding: 14px 16px;
      background: #fff;
    }
    .kpi .label {
      font-size: 9px; color: #64748b; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.8px;
      margin-bottom: 6px;
    }
    .kpi .value {
      font-size: 22px; font-weight: 700; color: #0f172a;
      letter-spacing: -0.5px; line-height: 1;
      font-variant-numeric: tabular-nums;
    }
    .kpi .foot {
      font-size: 10px; color: #94a3b8; margin-top: 6px;
    }
    .kpi-blue   { border-left-color: #2563eb; }
    .kpi-green  { border-left-color: #16a34a; }
    .kpi-yellow { border-left-color: #ca8a04; }
    .kpi-red    { border-left-color: #dc2626; }
    .kpi-blue   .value { color: #1d4ed8; }
    .kpi-green  .value { color: #15803d; }
    .kpi-yellow .value { color: #a16207; }
    .kpi-red    .value { color: #b91c1c; }

    .section {
      margin-bottom: 24px;
    }
    .section-header {
      display: flex; align-items: baseline; justify-content: space-between;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px; margin-bottom: 14px;
    }
    .section-header h2 {
      margin: 0; font-size: 13px; font-weight: 700;
      letter-spacing: 0.2px; color: #0f172a;
      text-transform: uppercase;
    }
    .section-header .subtitle {
      font-size: 10px; color: #94a3b8; font-weight: 500;
    }

    .status-row {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
      margin-bottom: 18px;
    }
    .status-card {
      border: 1px solid #e2e8f0; border-radius: 8px;
      padding: 12px 16px; display: flex; align-items: center; gap: 12px;
      background: #fff;
    }
    .status-card .dot {
      width: 10px; height: 10px; border-radius: 50%;
    }
    .status-card .dot.green  { background: #16a34a; }
    .status-card .dot.yellow { background: #ca8a04; }
    .status-card .dot.red    { background: #dc2626; }
    .status-card .name {
      flex: 1; font-size: 11px; font-weight: 600; color: #475569;
    }
    .status-card .count {
      font-size: 20px; font-weight: 700; color: #0f172a;
      font-variant-numeric: tabular-nums;
    }

    .ranking { display: grid; gap: 8px; }
    .rank-item {
      display: grid;
      grid-template-columns: 28px 1fr 90px;
      gap: 12px; align-items: center;
      padding: 8px 10px;
      border: 1px solid #f1f5f9; border-radius: 6px;
      background: #fff;
    }
    .rank-pos {
      font-size: 13px; font-weight: 700; color: #2563eb;
      text-align: center; font-variant-numeric: tabular-nums;
    }
    .rank-main { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
    .rank-name {
      font-size: 11px; font-weight: 600; color: #0f172a;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .rank-stats {
      font-size: 9px; color: #64748b; font-variant-numeric: tabular-nums;
    }
    .rank-bar {
      position: relative; height: 8px; border-radius: 4px;
      background: #f1f5f9; overflow: hidden;
      margin-top: 2px;
    }
    .rank-fill {
      position: absolute; top: 0; left: 0; bottom: 0;
      border-radius: 4px;
    }
    .rank-pct {
      font-size: 12px; font-weight: 700; color: #0f172a;
      text-align: right; font-variant-numeric: tabular-nums;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
      background: #fff;
    }
    thead th {
      background: #f8fafc;
      color: #475569;
      text-transform: uppercase;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.5px;
      padding: 10px;
      text-align: left;
      border-bottom: 2px solid #cbd5e1;
    }
    th.num, td.num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    th.ctr, td.ctr { text-align: center; }
    tbody td {
      padding: 9px 10px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
    }
    tbody tr:nth-child(even) td { background: #fbfcfd; }
    tbody tr:last-child td { border-bottom: none; }
    td.strong { font-weight: 600; color: #0f172a; }

    .pill {
      display: inline-block; padding: 2px 9px; border-radius: 999px;
      font-size: 9px; font-weight: 700; letter-spacing: 0.4px;
      text-transform: uppercase;
    }
    .st-green  { background: #dcfce7; color: #166534; }
    .st-yellow { background: #fef9c3; color: #854d0e; }
    .st-red    { background: #fee2e2; color: #991b1b; }

    .mini-bar {
      display: inline-block; width: 60px; height: 6px; background: #f1f5f9;
      border-radius: 3px; overflow: hidden; vertical-align: middle;
      margin-right: 6px;
    }
    .mini-bar .fill { display: block; height: 100%; border-radius: 3px; }

    footer.doc-footer {
      margin-top: 28px; padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      display: flex; justify-content: space-between;
      font-size: 9px; color: #94a3b8;
    }

    .empty {
      text-align: center; color: #94a3b8; padding: 28px;
      border: 1px dashed #e2e8f0; border-radius: 8px;
    }
  `;
}

function renderCover(opts: BuildOpts, title: string, gen: string): string {
  return `
    <header class="cover">
      <div class="brand">
        <div class="brand-logo">HSE<span class="accent">.</span></div>
        <div class="brand-tagline">Controle de Impressão</div>
      </div>
      <div class="cover-right">
        <h1>${escape(title)}</h1>
        <div class="subtitle">Hospital dos Servidores do Estado</div>
        <div class="meta-grid">
          <div>
            <span class="k">Visão</span>
            <span class="v">${
              opts.tab === 'sector' ? 'Por Setor' :
              opts.tab === 'printer' ? 'Por Impressora' :
              'Liberações'
            }</span>
          </div>
          <div>
            <span class="k">Período</span>
            <span class="v">${escape(opts.periodLabel)}</span>
          </div>
          <div>
            <span class="k">Recorte</span>
            <span class="v">${escape(opts.weekLabel)}</span>
          </div>
          <div>
            <span class="k">Gerado em</span>
            <span class="v">${escape(gen)}</span>
          </div>
        </div>
      </div>
    </header>
  `;
}

interface Row {
  id: number;
  name: string;
  extra?: string;
  uso: number;
  limite: number;
  pct: number;
}

function renderKpis(rows: Row[], entityLabel: string): string {
  const totalUso = rows.reduce((a, r) => a + r.uso, 0);
  const totalLim = rows.reduce((a, r) => a + r.limite, 0);
  const overallPct = totalLim > 0 ? (totalUso / totalLim) * 100 : 0;
  const excedidas = rows.filter((r) => r.pct >= 100).length;

  return `
    <section class="kpis avoid-break">
      <div class="kpi">
        <div class="label">Total de ${escape(entityLabel)}</div>
        <div class="value">${fmtInt(rows.length)}</div>
        <div class="foot">entidades analisadas</div>
      </div>
      <div class="kpi kpi-blue">
        <div class="label">Páginas impressas</div>
        <div class="value">${fmtInt(totalUso)}</div>
        <div class="foot">no período</div>
      </div>
      <div class="kpi ${overallPct >= 80 ? 'kpi-yellow' : 'kpi-green'}">
        <div class="label">Utilização geral</div>
        <div class="value">${fmtPct(overallPct)}</div>
        <div class="foot">de ${fmtInt(totalLim)} disponíveis</div>
      </div>
      <div class="kpi ${excedidas > 0 ? 'kpi-red' : 'kpi-green'}">
        <div class="label">Excedidos</div>
        <div class="value">${fmtInt(excedidas)}</div>
        <div class="foot">acima de 100% da cota</div>
      </div>
    </section>
  `;
}

function renderStatusDistribution(rows: Row[]): string {
  const normal = rows.filter((r) => r.pct < 80).length;
  const alerta = rows.filter((r) => r.pct >= 80 && r.pct < 100).length;
  const excedido = rows.filter((r) => r.pct >= 100).length;
  return `
    <section class="section avoid-break">
      <div class="section-header">
        <h2>Distribuição por status</h2>
        <span class="subtitle">Entidades por faixa de utilização</span>
      </div>
      <div class="status-row">
        <div class="status-card"><span class="dot green"></span>
          <span class="name">Normal (até 80%)</span>
          <span class="count">${fmtInt(normal)}</span>
        </div>
        <div class="status-card"><span class="dot yellow"></span>
          <span class="name">Alerta (80 – 99%)</span>
          <span class="count">${fmtInt(alerta)}</span>
        </div>
        <div class="status-card"><span class="dot red"></span>
          <span class="name">Excedido (100%+)</span>
          <span class="count">${fmtInt(excedido)}</span>
        </div>
      </div>
    </section>
  `;
}

function renderRanking(rows: Row[], label: string, max = 10): string {
  const top = [...rows].sort((a, b) => b.uso - a.uso).slice(0, max);
  if (top.length === 0) return '';
  const topMaxUso = top[0]?.uso || 1;
  return `
    <section class="section avoid-break">
      <div class="section-header">
        <h2>Top ${top.length} ${escape(label)}</h2>
        <span class="subtitle">Ordenado pelo volume de páginas impressas</span>
      </div>
      <div class="ranking">
        ${top.map((r, i) => {
          const usoBarPct = Math.min(100, (r.uso / topMaxUso) * 100);
          return `
            <div class="rank-item">
              <div class="rank-pos">${i + 1}</div>
              <div class="rank-main">
                <div class="rank-name">${escape(r.name)}${r.extra ? ' <span style="color:#94a3b8;font-weight:500;">· ' + escape(r.extra) + '</span>' : ''}</div>
                <div class="rank-stats">${fmtInt(r.uso)} / ${fmtInt(r.limite)} páginas</div>
                <div class="rank-bar"><div class="rank-fill" style="width:${usoBarPct.toFixed(2)}%; background:${barColor(r.pct)};"></div></div>
              </div>
              <div class="rank-pct" style="color:${barColor(r.pct)};">${fmtPct(r.pct)}</div>
            </div>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

function renderTable(rows: Row[], label: string, showExtra: boolean): string {
  if (rows.length === 0) {
    return `
      <section class="section">
        <div class="section-header"><h2>Detalhamento completo</h2></div>
        <div class="empty">Nenhum dado para este período.</div>
      </section>
    `;
  }
  const sorted = [...rows].sort((a, b) => b.pct - a.pct);
  return `
    <section class="section">
      <div class="section-header">
        <h2>Detalhamento completo</h2>
        <span class="subtitle">${fmtInt(sorted.length)} ${escape(label)} no período</span>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:32px;" class="ctr">#</th>
            <th>${escape(label.charAt(0).toUpperCase() + label.slice(1, -1))}</th>
            ${showExtra ? '<th>Modelo</th>' : ''}
            <th class="num">Limite</th>
            <th class="num">Uso</th>
            <th class="num" style="width:150px;">% Utilização</th>
            <th style="width:80px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${sorted.map((r, i) => {
            const st = statusFor(r.pct);
            const fillW = Math.min(100, r.pct).toFixed(1);
            return `
              <tr>
                <td class="ctr" style="color:#94a3b8;">${i + 1}</td>
                <td class="strong">${escape(r.name)}</td>
                ${showExtra ? `<td>${escape(r.extra || '-')}</td>` : ''}
                <td class="num">${fmtInt(r.limite)}</td>
                <td class="num">${fmtInt(r.uso)}</td>
                <td class="num">
                  <span class="mini-bar"><span class="fill" style="width:${fillW}%;background:${barColor(r.pct)};"></span></span>
                  <span style="color:${barColor(r.pct)};font-weight:600;">${fmtPct(r.pct)}</span>
                </td>
                <td><span class="pill ${st.cls}">${st.label}</span></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </section>
  `;
}

function renderPools(pools: PrinterTypePoolStatus[]): string {
  if (!pools || pools.length === 0) return '';
  const totalPool = pools.reduce((a, p) => a + p.pool_total, 0);
  const totalConsumed = pools.reduce((a, p) => a + p.usage_total + p.releases_total, 0);
  const totalReleases = pools.reduce((a, p) => a + p.releases_total, 0);
  const totalPct = totalPool > 0 ? (totalConsumed / totalPool) * 100 : 0;

  return `
    <section class="section avoid-break">
      <div class="section-header">
        <h2>Cotas contratadas por tipo de impressora</h2>
        <span class="subtitle">Pool mensal acordado com a Simpress</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Tipo</th>
            <th class="num">Impressoras</th>
            <th class="num">Cota contratada</th>
            <th class="num">Uso no mes</th>
            <th class="num">Liberacoes</th>
            <th class="num">Saldo</th>
            <th class="num" style="width:150px;">% Utilizacao</th>
          </tr>
        </thead>
        <tbody>
          ${pools.map((p) => {
            const consumed = p.usage_total + p.releases_total;
            const fillW = Math.min(100, p.usage_pct).toFixed(1);
            return `
              <tr>
                <td class="strong">${escape(p.name)}</td>
                <td class="num">${fmtInt(p.printer_count)}</td>
                <td class="num">${fmtInt(p.pool_total)}</td>
                <td class="num">${fmtInt(p.usage_total)}</td>
                <td class="num" style="color:#7c3aed;font-weight:600;">${p.releases_total > 0 ? '+' + fmtInt(p.releases_total) : '0'}</td>
                <td class="num" style="color:${p.remaining < 0 ? '#dc2626' : '#16a34a'};font-weight:700;">${fmtInt(p.remaining)}</td>
                <td class="num">
                  <span class="mini-bar"><span class="fill" style="width:${fillW}%;background:${barColor(p.usage_pct)};"></span></span>
                  <span style="color:${barColor(p.usage_pct)};font-weight:600;">${fmtPct(p.usage_pct)}</span>
                </td>
              </tr>
            `;
          }).join('')}
          <tr style="background:#f8fafc;">
            <td class="strong">Total geral</td>
            <td class="num strong">${fmtInt(pools.reduce((a, p) => a + p.printer_count, 0))}</td>
            <td class="num strong">${fmtInt(totalPool)}</td>
            <td class="num strong">${fmtInt(totalConsumed - totalReleases)}</td>
            <td class="num strong" style="color:#7c3aed;">${totalReleases > 0 ? '+' + fmtInt(totalReleases) : '0'}</td>
            <td class="num strong" style="color:${(totalPool - totalConsumed) < 0 ? '#dc2626' : '#16a34a'};">${fmtInt(totalPool - totalConsumed)}</td>
            <td class="num strong">${fmtPct(totalPct)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  `;
}

function renderReleases(releases: Release[]): string {
  const total = releases.reduce((a, r) => a + (r.amount || 0), 0);
  const porUsuario = new Map<string, { count: number; total: number }>();
  for (const r of releases) {
    const k = r.released_by || '—';
    const cur = porUsuario.get(k) || { count: 0, total: 0 };
    cur.count += 1;
    cur.total += r.amount || 0;
    porUsuario.set(k, cur);
  }
  const topUsers = [...porUsuario.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 5);

  return `
    <section class="kpis avoid-break">
      <div class="kpi">
        <div class="label">Total de liberações</div>
        <div class="value">${fmtInt(releases.length)}</div>
        <div class="foot">no período</div>
      </div>
      <div class="kpi kpi-blue">
        <div class="label">Páginas liberadas</div>
        <div class="value">${fmtInt(total)}</div>
        <div class="foot">somatório geral</div>
      </div>
      <div class="kpi">
        <div class="label">Média por liberação</div>
        <div class="value">${fmtInt(releases.length ? Math.round(total / releases.length) : 0)}</div>
        <div class="foot">páginas por liberação</div>
      </div>
      <div class="kpi kpi-yellow">
        <div class="label">Gestores envolvidos</div>
        <div class="value">${fmtInt(porUsuario.size)}</div>
        <div class="foot">usuários distintos</div>
      </div>
    </section>

    ${topUsers.length > 0 ? `
      <section class="section avoid-break">
        <div class="section-header">
          <h2>Liberações por gestor</h2>
          <span class="subtitle">Top ${topUsers.length} por volume total</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Gestor</th>
              <th class="num">Liberações</th>
              <th class="num">Páginas liberadas</th>
              <th class="num">Média/liberação</th>
            </tr>
          </thead>
          <tbody>
            ${topUsers.map(([user, info]) => `
              <tr>
                <td class="strong">${escape(user)}</td>
                <td class="num">${fmtInt(info.count)}</td>
                <td class="num">${fmtInt(info.total)}</td>
                <td class="num">${fmtInt(Math.round(info.total / info.count))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>
    ` : ''}

    <section class="section">
      <div class="section-header">
        <h2>Detalhamento das liberações</h2>
        <span class="subtitle">${fmtInt(releases.length)} registros no período</span>
      </div>
      ${releases.length === 0 ? '<div class="empty">Nenhuma liberação registrada neste período.</div>' : `
      <table>
        <thead>
          <tr>
            <th style="width:110px;">Data/Hora</th>
            <th>Impressora</th>
            <th>Setor</th>
            <th class="num" style="width:80px;">Páginas</th>
            <th>Motivo</th>
            <th style="width:120px;">Autorizado por</th>
            <th style="width:120px;">Operador</th>
          </tr>
        </thead>
        <tbody>
          ${[...releases]
            .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
            .map((r) => `
              <tr>
                <td>${escape(formatDateTime(r.created_at))}</td>
                <td class="strong">${escape(r.printer_name || '-')}</td>
                <td>${escape(r.sector_name || '-')}</td>
                <td class="num" style="color:#7c3aed;font-weight:700;">+${fmtInt(r.amount)}</td>
                <td style="color:#64748b;">${escape(r.reason || '-')}</td>
                <td>${escape(r.released_by || '-')}</td>
                <td style="color:#64748b;">${escape(r.operator_name || r.operator_username || '-')}</td>
              </tr>
            `).join('')}
        </tbody>
      </table>
      `}
    </section>
  `;
}

export function buildPrintReport(opts: BuildOpts): string {
  const gen = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  let body = '';
  let title = '';

  const poolsHtml = opts.pools && opts.pools.length > 0 ? renderPools(opts.pools) : '';

  if (opts.tab === 'sector') {
    title = 'Relatório de Impressão por Setor';
    const rows: Row[] = opts.sectorData.map((s) => {
      const uso = parseFloat(s.total_usage) || 0;
      const limite = parseFloat(s.total_limit) || 0;
      const pct = parseFloat(s.usage_percentage) || 0;
      return { id: s.sector_id, name: s.sector_name, uso, limite, pct };
    });
    body = renderCover(opts, title, gen)
      + renderKpis(rows, 'setores')
      + poolsHtml
      + renderStatusDistribution(rows)
      + renderRanking(rows, 'setores com maior consumo', 10)
      + `<div class="page-break"></div>`
      + renderTable(rows, 'setores', false);
  } else if (opts.tab === 'printer') {
    title = 'Relatório de Impressão por Impressora';
    const rows: Row[] = opts.printerData.map((p) => {
      const uso = parseFloat(p.total_usage) || 0;
      const limite = parseFloat(p.total_limit) || 0;
      const pct = parseFloat(p.usage_percentage) || 0;
      return { id: p.printer_id, name: p.printer_name, extra: p.model || undefined, uso, limite, pct };
    });
    body = renderCover(opts, title, gen)
      + renderKpis(rows, 'impressoras')
      + poolsHtml
      + renderStatusDistribution(rows)
      + renderRanking(rows, 'impressoras com maior consumo', 10)
      + `<div class="page-break"></div>`
      + renderTable(rows, 'impressoras', true);
  } else {
    title = 'Relatório de Liberações de Cota';
    body = renderCover(opts, title, gen)
      + poolsHtml
      + renderReleases(opts.releasesData);
  }

  body += `
    <footer class="doc-footer">
      <div><strong>HSE</strong> — Sistema de Controle de Impressão</div>
      <div>Relatório gerado em ${escape(gen)}</div>
      <div>Documento interno · uso restrito à gestão</div>
    </footer>
  `;

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <title>${escape(title)} - ${escape(opts.periodLabel)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>${printCss()}</style>
  </head>
  <body>
    ${body}
  </body>
</html>`;
}
