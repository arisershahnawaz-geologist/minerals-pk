import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { esc, slug, renderDetail } from './public/render.js';

const RAW = JSON.parse(await readFile('data/deposits.json', 'utf8'));
const DEPOSITS = (RAW.deposits || []).slice().sort((a, b) => a.name.localeCompare(b.name));
const SOURCES = RAW.sources || [];
const META = RAW.meta || {};
const SRC = Object.fromEntries(SOURCES.map(s => [s.id, s]));
const SITE = (process.env.SITE_URL || '').replace(/\/$/, '');

async function write(path, content) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

const NAV = [
  ['explore', 'Explore', './'],
  ['deposits', 'Deposits', 'deposits/index.html'],
  ['provinces', 'Provinces', 'provinces/index.html'],
  ['commodities', 'Commodities', 'commodities/index.html'],
  ['map', 'Map', 'map/index.html'],
  ['downloads', 'Downloads', 'downloads/index.html'],
  ['about', 'About', 'about/index.html'],
];

function shell({ title, desc, depth = 0, active = '', path = '', body = '', head = '', scripts = '' }) {
  const base = depth ? '../'.repeat(depth) : './';
  const canonical = SITE && path ? `<link rel="canonical" href="${SITE}/${path}">` : '';
  const nav = NAV.map(([k, label, href]) =>
    `<a href="${href}"${k === active ? ' class="active"' : ''}>${label}</a>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<base href="${base}">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${canonical}
<link rel="stylesheet" href="style.css">
${head}
</head>
<body>
<header class="site-header">
  <a class="brand" href="./">Minerals <span>of</span> Pakistan</a>
  <nav>${nav}</nav>
</header>
<main>
${body}
</main>
<footer>
  <p><strong>Minerals of Pakistan</strong> — independent, sourced reference.
  Data <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> ·
  <a href="about/index.html">About &amp; disclaimer</a></p>
</footer>
${scripts}
</body>
</html>`;
}

// ---- Home (Explore SPA) ----
await write('dist/index.html', shell({
  title: 'Minerals of Pakistan — Explorer',
  desc: 'A sourced, open reference to the metallic mineral deposits of Pakistan.',
  depth: 0, active: 'explore', path: '',
  body: `<section class="explore">
    <div class="explore-controls">
      <input id="q" type="search" placeholder="Search name, commodity, district…" aria-label="Search">
      <select id="commodity" aria-label="Commodity"><option value="">All commodities</option></select>
      <select id="province" aria-label="Province"><option value="">All provinces</option></select>
      <div id="count"></div>
    </div>
    <nav id="list" aria-label="Results"></nav>
    <section id="detail"><p class="muted" style="padding:1rem">Select a deposit, or type to search.</p></section>
  </section>`,
  scripts: `<script type="module" src="app.js"></script>`
}));

// ---- Deposits index ----
await write('dist/deposits/index.html', shell({
  title: 'All deposits — Minerals of Pakistan',
  desc: `Index of ${DEPOSITS.length} metallic mineral deposits in Pakistan.`,
  depth: 1, active: 'deposits', path: 'deposits/',
  body: `<div class="container">
    <h1>All deposits</h1>
    <p class="muted">${DEPOSITS.length} record${DEPOSITS.length === 1 ? '' : 's'}</p>
    <ul class="link-list">
      ${DEPOSITS.map(d => `<li>
        <a href="deposits/${d.id}.html">${esc(d.name)}</a>
        <span class="muted"> — ${esc((d.commodities || []).join(', '))}${d.district ? ', ' + esc(d.district) : ''}${d.province ? ', ' + esc(d.province) : ''}</span>
        ${d.reviewStatus !== 'Verified' ? '<em class="unverified"> (unverified)</em>' : ''}
      </li>`).join('')}
    </ul>
  </div>`
}));

// ---- Per-deposit pages ----
for (const d of DEPOSITS) {
  const desc = [(d.commodities || []).join(', '), d.depositType,
    [d.district, d.province].filter(Boolean).join(', ')].filter(Boolean).join(' — ');
  await write(`dist/deposits/${d.id}.html`, shell({
    title: `${d.name} — Minerals of Pakistan`,
    desc, depth: 1, active: 'deposits', path: `deposits/${d.id}.html`,
    body: `<article class="container">${renderDetail(d, SRC, META)}</article>`
  }));
}

// ---- Provinces ----
const provinces = {};
for (const d of DEPOSITS) if (d.province) (provinces[d.province] ??= []).push(d);

await write('dist/provinces/index.html', shell({
  title: 'Provinces — Minerals of Pakistan',
  desc: 'Browse metallic mineral deposits by province.',
  depth: 1, active: 'provinces', path: 'provinces/',
  body: `<div class="container">
    <h1>Provinces</h1>
    <ul class="link-list">
      ${Object.entries(provinces).sort(([a], [b]) => a.localeCompare(b)).map(([p, list]) =>
        `<li><a href="provinces/${slug(p)}.html">${esc(p)}</a>
        <span class="muted"> — ${list.length} deposit${list.length === 1 ? '' : 's'}</span></li>`).join('')}
    </ul>
  </div>`
}));

for (const [p, list] of Object.entries(provinces)) {
  await write(`dist/provinces/${slug(p)}.html`, shell({
    title: `${p} — Minerals of Pakistan`,
    desc: `Metallic mineral deposits in ${p}, Pakistan.`,
    depth: 1, active: 'provinces', path: `provinces/${slug(p)}.html`,
    body: `<div class="container">
      <p class="muted"><a href="provinces/index.html">← All provinces</a></p>
      <h1>${esc(p)}</h1>
      <p class="muted">${list.length} deposit${list.length === 1 ? '' : 's'}</p>
      <ul class="link-list">
        ${list.sort((a, b) => a.name.localeCompare(b.name)).map(d =>
          `<li><a href="deposits/${d.id}.html">${esc(d.name)}</a>
          <span class="muted"> — ${esc((d.commodities || []).join(', '))}</span></li>`).join('')}
      </ul>
    </div>`
  }));
}

// ---- Commodities ----
const commodities = {};
for (const d of DEPOSITS) for (const c of (d.commodities || [])) (commodities[c] ??= []).push(d);

await write('dist/commodities/index.html', shell({
  title: 'Commodities — Minerals of Pakistan',
  desc: 'Browse metallic mineral deposits by commodity.',
  depth: 1, active: 'commodities', path: 'commodities/',
  body: `<div class="container">
    <h1>Commodities</h1>
    <ul class="link-list">
      ${Object.entries(commodities).sort(([a], [b]) => a.localeCompare(b)).map(([c, list]) =>
        `<li><a href="commodities/${slug(c)}.html">${esc(c)}</a>
        <span class="muted"> — ${list.length} deposit${list.length === 1 ? '' : 's'}</span></li>`).join('')}
    </ul>
  </div>`
}));

for (const [c, list] of Object.entries(commodities)) {
  await write(`dist/commodities/${slug(c)}.html`, shell({
    title: `${c} deposits in Pakistan — Minerals of Pakistan`,
    desc: `Deposits of ${c} in Pakistan.`,
    depth: 1, active: 'commodities', path: `commodities/${slug(c)}.html`,
    body: `<div class="container">
      <p class="muted"><a href="commodities/index.html">← All commodities</a></p>
      <h1>${esc(c)}</h1>
      <p class="muted">${list.length} deposit${list.length === 1 ? '' : 's'}</p>
      <ul class="link-list">
        ${list.sort((a, b) => a.name.localeCompare(b.name)).map(d =>
          `<li><a href="deposits/${d.id}.html">${esc(d.name)}</a>
          <span class="muted"> — ${esc(d.district || d.province || '')}</span></li>`).join('')}
      </ul>
    </div>`
  }));
}

// ---- Map ----
const geo = DEPOSITS.filter(d => d.lat != null && d.lon != null)
  .map(d => ({ id: d.id, name: d.name, lat: d.lat, lon: d.lon,
               commodities: d.commodities || [], province: d.province, status: d.status }));

await write('dist/map/index.html', shell({
  title: 'Map — Minerals of Pakistan',
  desc: 'Map of metallic mineral deposits in Pakistan.',
  depth: 1, active: 'map', path: 'map/',
  head: `<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">`,
  body: `<div class="container">
    <h1>Map of deposits</h1>
    <p class="muted">${geo.length} of ${DEPOSITS.length} records have coordinates.</p>
    <div id="map"></div>
  </div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const DATA = ${JSON.stringify(geo)};
    const map = L.map('map').setView([30, 69], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 18
    }).addTo(map);
    const safe = s => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
    for (const d of DATA) {
      L.circleMarker([d.lat, d.lon], {
        radius: 7, color: '#0b5d4b', fillColor: '#0b5d4b', fillOpacity: 0.7, weight: 1
      }).addTo(map).bindPopup(
        '<strong>' + safe(d.name) + '</strong><br>' + safe((d.commodities || []).join(', ')) +
        '<br><a href="deposits/' + safe(d.id) + '.html">View details →</a>'
      );
    }
  </script>`
}));

// ---- Downloads ----
await write('dist/downloads/index.html', shell({
  title: 'Downloads — Minerals of Pakistan',
  desc: 'Download the dataset as JSON, CSV, or GeoJSON.',
  depth: 1, active: 'downloads', path: 'downloads/',
  body: `<div class="container">
    <h1>Downloads</h1>
    <p>All data is released under <a href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0</a>.
    Please cite as <em>Minerals of Pakistan</em>${META.updated ? `, updated ${esc(META.updated)}` : ''}.</p>
    <ul class="download-list">
      <li><a href="data/deposits.json" download>deposits.json</a> — full structured dataset</li>
      <li><a href="data/deposits.csv" download>deposits.csv</a> — flat table for spreadsheets</li>
      <li><a href="data/deposits.geojson" download>deposits.geojson</a> — for GIS (georeferenced records only)</li>
    </ul>
    <p class="muted small">Version: ${esc(META.version || '—')} · Updated: ${esc(META.updated || '—')}</p>
    <p class="muted small"><strong>Note:</strong> many records are marked unverified. Check against primary sources before reuse.</p>
  </div>`
}));

// ---- About ----
await write('dist/about/index.html', shell({
  title: 'About — Minerals of Pakistan',
  desc: 'About this site, its scope, sources, and disclaimer.',
  depth: 1, active: 'about', path: 'about/',
  body: `<div class="container">
    <h1>About</h1>
    <p><strong>Minerals of Pakistan</strong> is an independent, open reference to the metallic mineral deposits of Pakistan.</p>
    <h2>Scope</h2>
    <p>Version 1 covers metallic commodities (copper, gold, lead, zinc, chromite, iron, and related metals). Coal, gemstones, and industrial minerals are planned for future versions.</p>
    <h2>Sources and editorial standard</h2>
    <p>Every fact is attributed to a source. Each deposit carries a <em>review status</em>:</p>
    <ul>
      <li><strong>Unverified</strong> — the record has not yet been checked against a primary source. Unverified records carry a visible warning.</li>
      <li><strong>Verified</strong> — the record has been checked against a primary source (GSP bulletin, company technical report, or peer-reviewed paper).</li>
    </ul>
    <p>Resource figures are only ever entered with an as-of date. If two sources disagree, both are shown. Gaps are shown, never guessed.</p>
    <h2>Disclaimer</h2>
    <p>Not a geological survey. Not affiliated with the Geological Survey of Pakistan or any government body. Resource figures vary between sources and change over time — always verify against primary sources.</p>
    <h2>Licence and reuse</h2>
    <p>Data and text are released under <a href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0</a>.</p>
  </div>`
}));

// ---- 404 ----
await write('dist/404.html', shell({
  title: 'Not found — Minerals of Pakistan',
  desc: 'Page not found.',
  depth: 1, active: '', path: '',
  body: `<div class="container">
    <h1>Page not found</h1>
    <p>Try the <a href="./">Explorer</a> or <a href="deposits/index.html">all deposits</a>.</p>
  </div>`
}));

// ---- Copy assets ----
for (const f of ['style.css', 'render.js', 'app.js']) {
  await copyFile(`public/${f}`, `dist/${f}`);
}

// ---- Data files ----
await write('dist/data/deposits.json', JSON.stringify(RAW, null, 2));

const csvFields = ['id','name','commodities','byProducts','depositType','province','district',
  'lat','lon','hostRock','hostFormation','mineralAge','tectonicDomain','status','operator',
  'economic','notes','reviewStatus'];
const csvEsc = v => {
  if (v == null) return '';
  const s = Array.isArray(v) ? v.join('; ') : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
await write('dist/data/deposits.csv',
  [csvFields.join(','), ...DEPOSITS.map(d => csvFields.map(f => csvEsc(d[f])).join(','))].join('\n'));

await write('dist/data/deposits.geojson', JSON.stringify({
  type: 'FeatureCollection',
  features: geo.map(d => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [d.lon, d.lat] },
    properties: { id: d.id, name: d.name, commodities: d.commodities, province: d.province, status: d.status }
  }))
}, null, 2));

// ---- sitemap + robots ----
const pages = ['', 'deposits/', ...DEPOSITS.map(d => `deposits/${d.id}.html`),
  'provinces/', ...Object.keys(provinces).map(p => `provinces/${slug(p)}.html`),
  'commodities/', ...Object.keys(commodities).map(c => `commodities/${slug(c)}.html`),
  'map/', 'downloads/', 'about/'];

await write('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p => `  <url><loc>${SITE}/${p}</loc>${META.updated ? `<lastmod>${META.updated}</lastmod>` : ''}</url>`).join('\n')}
</urlset>`);

await write('dist/robots.txt',
  `User-agent: *\nAllow: /\n${SITE ? `Sitemap: ${SITE}/sitemap.xml\n` : ''}`);

console.log(`Built ${DEPOSITS.length} deposits, ${Object.keys(provinces).length} provinces, ${Object.keys(commodities).length} commodities.`);
