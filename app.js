'use strict';

/* ------------------------------------------------------------------ *
 * Beaches: 20 of the UK's best-known surf spots, grouped by region.
 * Coordinates sit on the coast; the Marine API (cell_selection=sea)
 * resolves each to its nearest ~5 km sea grid cell.
 * ------------------------------------------------------------------ */
const REGIONS = [
  'South West England',
  'Wales',
  'North East & Yorkshire',
  'Scotland',
  'South Coast'
];

const BEACHES = [
  // South West England
  { name: 'Fistral Beach, Newquay', region: 'South West England', lat: 50.4161, lon: -5.1006 },
  { name: 'Watergate Bay',          region: 'South West England', lat: 50.4432, lon: -5.0419 },
  { name: 'Polzeath',               region: 'South West England', lat: 50.5694, lon: -4.9162 },
  { name: 'Porthtowan',             region: 'South West England', lat: 50.2872, lon: -5.2356 },
  { name: 'Sennen Cove',            region: 'South West England', lat: 50.0772, lon: -5.7008 },
  { name: 'Widemouth Bay, Bude',    region: 'South West England', lat: 50.7869, lon: -4.5556 },
  { name: 'Croyde Bay',             region: 'South West England', lat: 51.1306, lon: -4.2419 },
  { name: 'Woolacombe',             region: 'South West England', lat: 51.1728, lon: -4.2092 },
  // Wales
  { name: 'Rhossili Bay, Gower',    region: 'Wales', lat: 51.5664, lon: -4.2936 },
  { name: 'Llangennith, Gower',     region: 'Wales', lat: 51.6010, lon: -4.2880 },
  { name: 'Freshwater West',        region: 'Wales', lat: 51.6606, lon: -5.0656 },
  { name: 'Whitesands Bay, St Davids', region: 'Wales', lat: 51.8986, lon: -5.2944 },
  // North East & Yorkshire
  { name: 'Tynemouth Longsands',    region: 'North East & Yorkshire', lat: 55.0205, lon: -1.4250 },
  { name: 'Saltburn-by-the-Sea',    region: 'North East & Yorkshire', lat: 54.5836, lon: -0.9690 },
  { name: 'Scarborough South Bay',  region: 'North East & Yorkshire', lat: 54.2773, lon: -0.3955 },
  // Scotland
  { name: 'Thurso East',            region: 'Scotland', lat: 58.5969, lon: -3.5089 },
  { name: 'Pease Bay',              region: 'Scotland', lat: 55.9326, lon: -2.3469 },
  { name: 'Belhaven Bay, Dunbar',   region: 'Scotland', lat: 56.0040, lon: -2.5430 },
  // South Coast
  { name: 'Kimmeridge Bay, Dorset', region: 'South Coast', lat: 50.6072, lon: -2.1186 },
  { name: 'Compton Bay, Isle of Wight', region: 'South Coast', lat: 50.6669, lon: -1.5380 }
];

const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

/* ------------------------------------------------------------------ *
 * Formatting helpers
 * ------------------------------------------------------------------ */
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

function compass(deg) {
  if (deg == null || isNaN(deg)) return '—';
  return COMPASS[Math.round(deg / 22.5) % 16];
}

function num(v, dp, unit) {
  if (v == null || isNaN(v)) return '—';
  const s = dp === 0 ? Math.round(v).toString() : Number(v).toFixed(dp);
  return unit ? s + unit : s;
}

// WMO weather codes -> short label + glyph.
function weather(code) {
  const map = {
    0: ['Clear', '☀️'], 1: ['Mostly clear', '🌤️'], 2: ['Partly cloudy', '⛅'],
    3: ['Overcast', '☁️'], 45: ['Fog', '🌫️'], 48: ['Rime fog', '🌫️'],
    51: ['Light drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Heavy drizzle', '🌦️'],
    56: ['Freezing drizzle', '🌧️'], 57: ['Freezing drizzle', '🌧️'],
    61: ['Light rain', '🌧️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'],
    66: ['Freezing rain', '🌧️'], 67: ['Freezing rain', '🌧️'],
    71: ['Light snow', '🌨️'], 73: ['Snow', '🌨️'], 75: ['Heavy snow', '🌨️'],
    77: ['Snow grains', '🌨️'], 80: ['Showers', '🌦️'], 81: ['Showers', '🌧️'],
    82: ['Heavy showers', '🌧️'], 85: ['Snow showers', '🌨️'], 86: ['Snow showers', '🌨️'],
    95: ['Thunderstorm', '⛈️'], 96: ['Thunderstorm', '⛈️'], 99: ['Thunderstorm', '⛈️']
  };
  return map[code] || ['—', '🌊'];
}

// Wave-height tier (significant wave height, metres).
function tier(h) {
  if (h == null || isNaN(h)) return { label: 'No data', key: 'flat', colour: 'var(--tier-flat)' };
  if (h < 0.5) return { label: 'Flat', key: 'flat', colour: 'var(--tier-flat)' };
  if (h < 1.0) return { label: 'Small', key: 'small', colour: 'var(--tier-small)' };
  if (h < 1.8) return { label: 'Fun', key: 'fun', colour: 'var(--tier-fun)' };
  if (h < 3.0) return { label: 'Solid', key: 'solid', colour: 'var(--tier-solid)' };
  return { label: 'Heavy', key: 'big', colour: 'var(--tier-big)' };
}

/* ------------------------------------------------------------------ *
 * Data fetching — two batched requests for all 20 beaches at once.
 * ------------------------------------------------------------------ */
function asList(data) { return Array.isArray(data) ? data : [data]; }

async function loadConditions() {
  const lats = BEACHES.map(b => b.lat).join(',');
  const lons = BEACHES.map(b => b.lon).join(',');

  const marine = `${MARINE_URL}?latitude=${lats}&longitude=${lons}` +
    '&current=wave_height,wave_period,wave_direction,swell_wave_height,' +
    'swell_wave_period,swell_wave_direction,sea_surface_temperature' +
    '&cell_selection=sea';

  const forecast = `${FORECAST_URL}?latitude=${lats}&longitude=${lons}` +
    '&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m' +
    '&wind_speed_unit=mph';

  const [mRes, fRes] = await Promise.all([fetch(marine), fetch(forecast)]);
  if (!mRes.ok || !fRes.ok) throw new Error(`API error ${mRes.status}/${fRes.status}`);
  const marineData = asList(await mRes.json());
  const fcData = asList(await fRes.json());

  return BEACHES.map((b, i) => {
    const m = (marineData[i] && marineData[i].current) || {};
    const f = (fcData[i] && fcData[i].current) || {};
    return {
      ...b,
      waveHeight: m.wave_height,
      wavePeriod: m.wave_period,
      waveDir: m.wave_direction,
      swellHeight: m.swell_wave_height,
      swellPeriod: m.swell_wave_period,
      swellDir: m.swell_wave_direction,
      seaTemp: m.sea_surface_temperature,
      airTemp: f.temperature_2m,
      weatherCode: f.weather_code,
      windSpeed: f.wind_speed_10m,
      windDir: f.wind_direction_10m
    };
  });
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */
const state = { beaches: [], selected: 0 };

const els = {
  regions: document.getElementById('regions'),
  banner: document.getElementById('banner'),
  updated: document.getElementById('updated'),
  refresh: document.getElementById('refresh'),
  heroRegion: document.getElementById('heroRegion'),
  heroBeach: document.getElementById('heroBeach'),
  heroStats: document.getElementById('heroStats')
};

function renderHero() {
  const b = state.beaches[state.selected];
  if (!b) return;
  els.heroRegion.textContent = b.region;
  els.heroBeach.textContent = b.name;
  els.heroStats.innerHTML = [
    ['wave', num(b.waveHeight, 1, ' m')],
    ['period', num(b.wavePeriod, 0, ' s')],
    ['swell dir', compass(b.swellDir)],
    ['water', num(b.seaTemp, 0, '°')]
  ].map(([label, val]) =>
    `<div class="stat"><b>${val}</b><span>${label}</span></div>`).join('');
  sea.setTarget(b.waveHeight, b.wavePeriod);
}

function cardHTML(b, idx) {
  const t = tier(b.waveHeight);
  const [wlabel, wglyph] = weather(b.weatherCode);
  const wind = b.windDir != null
    ? `${compass(b.windDir)} ${num(b.windSpeed, 0)} mph` : '—';
  return `
    <button class="card${idx === state.selected ? ' selected' : ''}"
            style="--tier:${t.colour}" data-idx="${idx}">
      <div class="card-name">${b.name}</div>
      <div class="card-wave">
        <span class="h">${num(b.waveHeight, 1)}<span style="font-size:.6em"> m</span></span>
        <span class="tier">${t.label}</span>
      </div>
      <div class="card-meta">
        <span class="m">${num(b.wavePeriod, 0)}s · ${num(b.swellHeight, 1)}m swell ${compass(b.swellDir)}</span>
        <span class="m">wind <b>${wind}</b></span>
        <span class="m">sea <b>${num(b.seaTemp, 0)}°</b></span>
        <span class="m wx">${wglyph} ${wlabel} ${num(b.airTemp, 0, '°')}</span>
      </div>
    </button>`;
}

function render() {
  const html = REGIONS.map(region => {
    const items = state.beaches
      .map((b, i) => ({ b, i }))
      .filter(x => x.b.region === region);
    if (!items.length) return '';
    const cards = items.map(x => cardHTML(x.b, x.i)).join('');
    return `
      <section class="region">
        <div class="region-head">
          <span class="region-name">${region}</span>
          <span class="region-rule"></span>
          <span class="region-count">${items.length}</span>
        </div>
        <div class="cards">${cards}</div>
      </section>`;
  }).join('');
  els.regions.innerHTML = html;
  renderHero();
}

function showSkeleton() {
  els.heroBeach.textContent = 'Loading…';
  els.regions.innerHTML = `<section class="region">
    <div class="region-head"><span class="region-name">Fetching the swell…</span>
    <span class="region-rule"></span></div>
    <div class="cards">${'<div class="skeleton"></div>'.repeat(6)}</div></section>`;
}

function showBanner(msg) {
  els.banner.textContent = msg;
  els.banner.hidden = false;
}

/* ------------------------------------------------------------------ *
 * Live sea: a swell whose amplitude tracks wave height and whose
 * wavelength/speed track period, with a backlit surfer on the face.
 * ------------------------------------------------------------------ */
const sea = (() => {
  const canvas = document.getElementById('sea');
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w = 0, h = 0, dpr = 1;
  // animated values tween toward targets for smooth beach switches
  let amp = 0.12, wlen = 0.5, tAmp = 0.12, tWlen = 0.5;
  let t = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Map metres/seconds to drawing parameters.
  function setTarget(waveHeight, period) {
    const hgt = (waveHeight == null || isNaN(waveHeight)) ? 0.3 : waveHeight;
    const per = (period == null || isNaN(period)) ? 7 : period;
    // amplitude: 0..4 m -> 0.05..0.42 of available crest space
    tAmp = Math.max(0.05, Math.min(0.42, 0.05 + (hgt / 4) * 0.37));
    // wavelength: longer period -> longer waves (fewer crests on screen)
    tWlen = Math.max(0.35, Math.min(1.2, 0.30 + (per / 16) * 0.9));
    if (reduce) { amp = tAmp; wlen = tWlen; frame(); }
  }

  // Sea surface height (px from top) at horizontal fraction x, time t.
  function surfaceY(x, horizon, crestSpace) {
    const k1 = (Math.PI * 2) / wlen;       // primary swell
    const k2 = k1 * 2.1;                    // chop harmonic
    const a = amp * crestSpace;
    const y = Math.sin(x * k1 - t * 1.1) * a
            + Math.sin(x * k2 - t * 1.7) * a * 0.18;
    return horizon - y;
  }

  function drawSurfer(x, y, angle, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    // backlit silhouette with a thin foam rim
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(232,244,242,0.85)';
    ctx.lineWidth = 1.2;
    ctx.fillStyle = '#06141b';
    // board
    ctx.beginPath();
    ctx.ellipse(0, 2.6 * s, 13 * s, 3.2 * s, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // legs
    ctx.lineWidth = 2.6 * s;
    ctx.strokeStyle = '#06141b';
    ctx.beginPath();
    ctx.moveTo(-4 * s, 1.5 * s); ctx.lineTo(-1.5 * s, -7 * s);
    ctx.moveTo(5 * s, 1.5 * s); ctx.lineTo(1.5 * s, -7 * s);
    ctx.stroke();
    // torso
    ctx.beginPath();
    ctx.moveTo(0.5 * s, -6.5 * s); ctx.lineTo(-1.5 * s, -15 * s);
    ctx.stroke();
    // arms out for balance
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(-1.5 * s, -12 * s); ctx.lineTo(-10 * s, -10 * s);
    ctx.moveTo(-1.5 * s, -12 * s); ctx.lineTo(7 * s, -15 * s);
    ctx.stroke();
    // head
    ctx.beginPath();
    ctx.arc(-2 * s, -17.5 * s, 2.6 * s, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function frame() {
    if (!w) resize();
    const horizon = h * 0.46;
    const crestSpace = h * 0.34;

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#0b1d26');
    sky.addColorStop(1, '#163a47');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, horizon + 2);

    // low dawn sun + glow, to the right
    const sunX = w * 0.74, sunY = horizon - crestSpace * 0.5;
    const glow = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, h * 0.5);
    glow.addColorStop(0, 'rgba(244,184,96,0.55)');
    glow.addColorStop(0.4, 'rgba(244,184,96,0.12)');
    glow.addColorStop(1, 'rgba(244,184,96,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, horizon + crestSpace);
    ctx.fillStyle = '#f4b860';
    ctx.beginPath();
    ctx.arc(sunX, sunY, h * 0.05, 0, Math.PI * 2);
    ctx.fill();

    // build the sea surface path
    const step = Math.max(3, w / 160);
    const pts = [];
    for (let px = -step; px <= w + step; px += step) {
      pts.push([px, surfaceY(px / w, horizon, crestSpace)]);
    }

    // sea fill
    const sea = ctx.createLinearGradient(0, horizon - crestSpace, 0, h);
    sea.addColorStop(0, '#2a7d8c');
    sea.addColorStop(0.5, '#1d5b6e');
    sea.addColorStop(1, '#0d2c38');
    ctx.fillStyle = sea;
    ctx.beginPath();
    ctx.moveTo(-step, h);
    pts.forEach(p => ctx.lineTo(p[0], p[1]));
    ctx.lineTo(w + step, h);
    ctx.closePath();
    ctx.fill();

    // sun glint reflected on the water
    const refl = ctx.createLinearGradient(0, horizon, 0, h);
    refl.addColorStop(0, 'rgba(244,184,96,0.30)');
    refl.addColorStop(0.5, 'rgba(244,184,96,0.05)');
    refl.addColorStop(1, 'rgba(244,184,96,0)');
    ctx.fillStyle = refl;
    ctx.beginPath();
    ctx.moveTo(sunX - w * 0.06, horizon);
    pts.filter(p => p[0] > sunX - w * 0.12 && p[0] < sunX + w * 0.12)
       .forEach(p => ctx.lineTo(p[0], p[1]));
    ctx.lineTo(sunX + w * 0.06, h);
    ctx.lineTo(sunX - w * 0.06, h);
    ctx.closePath();
    ctx.fill();

    // foam crest line
    ctx.strokeStyle = 'rgba(232,244,242,0.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.stroke();

    // surfer rides the face at ~38% width; angle from local slope
    const sx = w * 0.38;
    const y0 = surfaceY((sx - 6) / w, horizon, crestSpace);
    const y1 = surfaceY((sx + 6) / w, horizon, crestSpace);
    const angle = Math.atan2(y1 - y0, 12);
    const scale = Math.max(0.85, Math.min(1.5, h / 320));
    drawSurfer(sx, surfaceY(sx / w, horizon, crestSpace) - 1, angle, scale);

    if (!reduce) {
      amp += (tAmp - amp) * 0.05;
      wlen += (tWlen - wlen) * 0.05;
      t += 0.018;
      requestAnimationFrame(frame);
    }
  }

  window.addEventListener('resize', resize);
  resize();
  if (reduce) {
    amp = tAmp; wlen = tWlen;
    // render a few settled frames then a static one
    frame();
    setTimeout(() => frame(), 50);
  } else {
    requestAnimationFrame(frame);
  }
  return { setTarget };
})();

/* ------------------------------------------------------------------ *
 * Wiring
 * ------------------------------------------------------------------ */
els.regions.addEventListener('click', e => {
  const card = e.target.closest('.card');
  if (!card) return;
  state.selected = Number(card.dataset.idx);
  document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  renderHero();
  const hero = document.querySelector('.hero');
  if (hero && hero.scrollIntoView) hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

async function refresh() {
  els.refresh.classList.add('spinning');
  els.banner.hidden = true;
  try {
    const data = await loadConditions();
    state.beaches = data;
    if (state.selected >= data.length) state.selected = 0;
    render();
    const now = new Date();
    els.updated.textContent = now.toLocaleTimeString('en-GB',
      { hour: '2-digit', minute: '2-digit' });
  } catch (err) {
    console.error(err);
    if (!state.beaches.length) showSkeleton();
    showBanner(navigator.onLine
      ? 'Could not reach the surf service. Tap ↻ to try again.'
      : 'You are offline. Showing the last loaded conditions where available.');
  } finally {
    els.refresh.classList.remove('spinning');
  }
}

els.refresh.addEventListener('click', refresh);

showSkeleton();
refresh();

/* Service worker for installability + offline shell */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW failed', e));
  });
}
