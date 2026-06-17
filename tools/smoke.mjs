import { JSDOM } from 'jsdom';
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
const { document } = window;

// ---- stubs ----
window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
window.devicePixelRatio = 2;
const noopCtx = new Proxy({}, {
  get: (_t, p) => {
    if (p === 'createLinearGradient' || p === 'createRadialGradient')
      return () => ({ addColorStop() {} });
    return () => {};
  },
  set: () => true
});
window.HTMLCanvasElement.prototype.getContext = () => noopCtx;

const N = 20;
const marine = Array.from({ length: N }, (_, i) => ({
  current: {
    wave_height: i === 3 ? null : +(0.4 + i * 0.18).toFixed(2),
    wave_period: 6 + (i % 9),
    wave_direction: (i * 31) % 360,
    swell_wave_height: +(0.3 + i * 0.12).toFixed(2),
    swell_wave_period: 8 + (i % 7),
    swell_wave_direction: (i * 47) % 360,
    sea_surface_temperature: 9 + (i % 6)
  }
}));
const forecast = Array.from({ length: N }, (_, i) => ({
  current: {
    temperature_2m: 8 + (i % 10),
    weather_code: [0, 2, 3, 61, 80, 45, 95][i % 7],
    wind_speed_10m: 5 + (i % 20),
    wind_direction_10m: (i * 53) % 360
  }
}));

let marineCalls = 0, fcCalls = 0;
window.fetch = (url) => {
  const isMarine = String(url).includes('marine-api');
  if (isMarine) marineCalls++; else fcCalls++;
  // verify the requested params are present
  const u = String(url);
  const needed = isMarine
    ? ['wave_height', 'wave_period', 'sea_surface_temperature', 'cell_selection=sea']
    : ['temperature_2m', 'weather_code', 'wind_direction_10m', 'wind_speed_unit=mph'];
  for (const k of needed) if (!u.includes(k)) throw new Error(`missing ${k} in URL`);
  return Promise.resolve({ ok: true, status: 200, json: async () => (isMarine ? marine : forecast) });
};

dom.window.eval(fs.readFileSync('app.js', 'utf8'));

// allow async refresh() to settle
await new Promise(r => setTimeout(r, 200));

const fail = (m) => { console.error('FAIL:', m); process.exit(1); };

if (marineCalls !== 1) fail(`expected 1 marine call, got ${marineCalls}`);
if (fcCalls !== 1) fail(`expected 1 forecast call, got ${fcCalls}`);

const cards = document.querySelectorAll('.card');
if (cards.length !== N) fail(`expected ${N} cards, got ${cards.length}`);

const regionNames = [...document.querySelectorAll('.region-name')].map(e => e.textContent);
for (const r of ['South West England', 'Wales', 'North East & Yorkshire', 'Scotland', 'South Coast'])
  if (!regionNames.includes(r)) fail(`region missing: ${r}`);

// region counts: 8,4,3,3,2
const counts = [...document.querySelectorAll('.region-count')].map(e => +e.textContent);
if (counts.join(',') !== '8,4,3,3,2') fail(`region counts ${counts.join(',')}`);

// null wave height (index 3) must render as em dash, not NaN/null
const card3 = cards[3];
if (/NaN|null|undefined/.test(card3.outerHTML)) fail('NaN/null leaked into card');
if (!card3.querySelector('.h').textContent.includes('—')) fail('null wave not shown as dash');

// hero populated
const hero = document.getElementById('heroBeach').textContent;
if (hero !== 'Fistral Beach, Newquay') fail(`hero beach: ${hero}`);
if (/NaN|undefined/.test(document.getElementById('heroStats').innerHTML)) fail('hero stats bad');

// selecting a card updates hero
cards[15].click();
await new Promise(r => setTimeout(r, 20));
if (document.getElementById('heroBeach').textContent !== 'Thurso East')
  fail('card click did not update hero');

// updated timestamp set
if (document.getElementById('updated').textContent === '—') fail('timestamp not set');

console.log('PASS — 20 cards, 5 regions (8,4,3,3,2), 1+1 batched calls, null-safe, hero+click OK');
