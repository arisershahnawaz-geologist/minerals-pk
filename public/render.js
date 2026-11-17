export const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export const slug = s => String(s).toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const chips = a => (a || []).map(x =>
  `<a class="pill" href="commodities/${slug(x)}.html">${esc(x)}</a>`).join(' ');

const row = (l, v) => (v ? `<dt>${esc(l)}</dt><dd>${v}</dd>` : '');

export function renderDetail(d, srcs, meta = {}) {
  const res = (d.resources || []).length
    ? `<table><thead><tr><th>As of</th><th>Reported figure</th><th>Source</th></tr></thead><tbody>${
        d.resources.map(r => `<tr>
          <td>${esc(r.asOf || '—')}</td>
          <td>${esc(r.figure || '—')}</td>
          <td>${r.sourceId && srcs[r.sourceId] ? esc(srcs[r.sourceId].citation) : '—'}</td>
        </tr>`).join('')}</tbody></table>`
    : '<p class="muted">No figures entered. Do not infer — obtain from a primary source.</p>';

  const refs = (d.sourceIds || []).map(id => {
    const s = srcs[id]; if (!s) return '';
    return `<li>${esc(s.citation)}${s.verified ? '' : ' <em class="unverified">— not yet verified</em>'}${s.note ? `<div class="muted small">${esc(s.note)}</div>` : ''}</li>`;
  }).join('');

  const map = d.lat != null && d.lon != null
    ? `https://www.openstreetmap.org/?mlat=${d.lat}&mlon=${d.lon}#map=10/${d.lat}/${d.lon}` : null;

  const provinceLink = d.province
    ? `<a href="provinces/${slug(d.province)}.html">${esc(d.province)}</a>` : null;

  const hostUnit = d.hostFormation
    ? (d.hostFormationSlug
        ? `<a href="https://stratigraphy.pk/#${esc(d.hostFormationSlug)}" rel="noopener">${esc(d.hostFormation)}</a>`
        : esc(d.hostFormation))
    : null;

  return `
  ${d.reviewStatus !== 'Verified'
    ? '<div class="banner"><strong>Unverified record.</strong> Figures and locations have not yet been checked against a primary source.</div>'
    : ''}
  <h1>${esc(d.name)}</h1>
  <p class="sub">${esc(d.depositType || '')}${d.district ? ' · ' + esc(d.district) : ''}${d.province ? ', ' + esc(d.province) : ''}</p>
  <div>${chips(d.commodities)}${chips(d.byProducts)}<span class="pill status">${esc(d.status || 'Status unknown')}</span></div>

  <h2>Location &amp; setting</h2>
  <dl>
    ${row('Province', provinceLink)}
    ${row('District', esc(d.district))}
    ${row('Coordinates', d.lat != null ? `${d.lat}, ${d.lon}${d.coordsApprox ? ' <span class="unverified">(approx.)</span>' : ''}${map ? ` · <a href="${map}" rel="noopener">view map</a>` : ''}` : null)}
    ${row('Tectonic domain', esc(d.tectonicDomain))}
  </dl>

  <h2>Geology</h2>
  <dl>
    ${row('Host rock', esc(d.hostRock))}
    ${row('Host unit', hostUnit)}
    ${row('Age of mineralisation', esc(d.mineralAge))}
  </dl>

  <h2>Resource / grade</h2>${res}

  <h2>Development</h2>
  <dl>
    ${row('Status', esc(d.status))}
    ${row('Operator / leaseholder', esc(d.operator))}
    ${row('Economic significance', esc(d.economic))}
    ${row('Notes', esc(d.notes))}
  </dl>

  ${refs ? `<h2>Sources</h2><ul class="refs">${refs}</ul>` : ''}
  <p class="muted small">Updated: ${esc(meta.updated || '—')} · Licence: ${esc(meta.license || '—')}</p>`;
}
