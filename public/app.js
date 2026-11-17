import { esc, renderDetail } from './render.js';

const $q = document.getElementById('q');
const $c = document.getElementById('commodity');
const $p = document.getElementById('province');
const $list = document.getElementById('list');
const $detail = document.getElementById('detail');
const $count = document.getElementById('count');

let D = { meta: {}, deposits: [], sources: [] };
const srcMap = () => Object.fromEntries(D.sources.map(s => [s.id, s]));

function fill(el, vals) {
  [...new Set(vals.filter(Boolean))].sort().forEach(v => {
    const o = document.createElement('option');
    o.value = v; o.textContent = v;
    el.appendChild(o);
  });
}

function filtered() {
  const q = $q.value.trim().toLowerCase();
  const com = $c.value, prov = $p.value;
  return D.deposits.filter(d => {
    if (com && !(d.commodities||[]).includes(com) && !(d.byProducts||[]).includes(com)) return false;
    if (prov && d.province !== prov) return false;
    if (!q) return true;
    const hay = [d.name, d.depositType, d.province, d.district, d.operator,
      d.hostFormation, d.hostRock, d.tectonicDomain,
      ...(d.commodities||[]), ...(d.byProducts||[])].join(' ').toLowerCase();
    return q.split(/\s+/).every(t => hay.includes(t));
  });
}

function renderList() {
  const hits = filtered();
  $count.textContent = `${hits.length} deposit${hits.length === 1 ? '' : 's'}`;
  $list.innerHTML = hits.length
    ? hits.map(d => `<button data-id="${esc(d.id)}">${esc(d.name)}
        <small>${esc((d.commodities||[]).join(', '))} · ${esc(d.district || d.province || '')}</small>
      </button>`).join('')
    : '<p style="padding:1rem;color:#666">No matches.</p>';
  $list.querySelectorAll('button').forEach(b =>
    b.addEventListener('click', () => show(b.dataset.id)));
  const a = location.hash.slice(1);
  if (a) $list.querySelectorAll('button').forEach(b =>
    b.classList.toggle('active', b.dataset.id === a));
}

function show(id) {
  const d = D.deposits.find(x => x.id === id);
  if (!d) return;
  $detail.innerHTML = renderDetail(d, srcMap(), D.meta) +
    `<p style="margin-top:1.5rem"><a href="deposits/${esc(d.id)}.html">Open as standalone page →</a></p>`;
  $list.querySelectorAll('button').forEach(b =>
    b.classList.toggle('active', b.dataset.id === id));
  history.replaceState(null, '', '#' + id);
  $detail.scrollIntoView({ block: 'start' });
}

fetch('data/deposits.json')
  .then(r => r.json())
  .then(data => {
    D = { meta: data.meta || {}, deposits: data.deposits || [], sources: data.sources || [] };
    fill($c, D.deposits.flatMap(d => [...(d.commodities||[]), ...(d.byProducts||[])]));
    fill($p, D.deposits.map(d => d.province));
    renderList();
    const start = location.hash.slice(1) || D.deposits[0]?.id;
    if (start) show(start);
  })
  .catch(() => { $detail.innerHTML = '<p>Could not load data.</p>'; });

[$q, $c, $p].forEach(el => el.addEventListener('input', renderList));
window.addEventListener('hashchange', () => show(location.hash.slice(1)));
