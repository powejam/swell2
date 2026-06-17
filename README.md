# Swell — UK surf conditions

An installable PWA showing live surf conditions for 20 of the UK's best-known
surf beaches, grouped by region. Built as a static site; deploys to GitHub Pages
at **https://powejam.github.io/swell2/**.

## What it shows

Per beach: significant wave height, wave period, swell height/period/direction,
wind direction and speed, sea-surface (water) temperature, air temperature and
current weather. A live hero animation draws a swell whose amplitude tracks the
selected beach's wave height and whose wavelength/speed track its period, with a
backlit surfer riding the face. Tap any beach card to ride it in the hero.

## Beaches (20 across 5 regions)

- **South West England** (8): Fistral, Watergate Bay, Polzeath, Porthtowan, Sennen Cove, Widemouth Bay, Croyde Bay, Woolacombe
- **Wales** (4): Rhossili Bay, Llangennith, Freshwater West, Whitesands Bay
- **North East & Yorkshire** (3): Tynemouth Longsands, Saltburn, Scarborough South Bay
- **Scotland** (3): Thurso East, Pease Bay, Belhaven Bay
- **South Coast** (2): Kimmeridge Bay, Compton Bay

## Data source

Free, key-less, CORS-enabled [Open-Meteo](https://open-meteo.com/) APIs, fetched
client-side as two batched multi-location requests:

- Marine API \`/v1/marine\` — \`wave_height\`, \`wave_period\`, \`wave_direction\`,
  \`swell_wave_height\`, \`swell_wave_period\`, \`swell_wave_direction\`,
  \`sea_surface_temperature\` (with \`cell_selection=sea\`).
- Forecast API \`/v1/forecast\` — \`temperature_2m\`, \`weather_code\`,
  \`wind_speed_10m\`, \`wind_direction_10m\` (\`wind_speed_unit=mph\`).

Wave height is significant wave height. Sea/air temperatures are °C; wind is mph.

## Files

| File | Purpose |
| --- | --- |
| \`index.html\` | App shell and PWA metadata |
| \`styles.css\` | Styling (cold North-Atlantic palette) |
| \`app.js\` | Beach data, fetch/merge, rendering, hero animation |
| \`sw.js\` | Service worker: offline shell, network-first data, runtime font cache |
| \`manifest.webmanifest\` | Install manifest (relative paths for \`/swell2/\` subpath) |
| \`icons/\` | Generated app icons (any + maskable) |
| \`tools/make_icons.py\` | Regenerates the icons (Pillow) |
| \`tools/smoke.mjs\` | jsdom smoke test of the render/data logic |
| \`.nojekyll\` | Stops Pages' Jekyll build from touching the static assets |

All asset paths are relative because the site is served from the \`/swell2/\`
subpath, not a domain root.

## Develop / verify

\`\`\`sh
python3 tools/make_icons.py        # regenerate icons
node --check app.js sw.js          # syntax
npm install jsdom && node tools/smoke.mjs   # logic smoke test
\`\`\`

To preview locally, serve the directory over HTTP (a service worker will not
register from file://), e.g. \`python3 -m http.server\`.
