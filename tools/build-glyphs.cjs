// Builds logo/glyphs.json: the N and Q outlines for the logo, and NORTHERN QUARTER as outlines.
//
// The logo fonts and weights are James Foster's NQ Generator lists (6 Oct 2026). Each letter is
// taken from Google Fonts with text=N or text=Q, so the download is only that one letter.
// Measurements are kept in font units, so the page can repeat the generator's spacing maths
// exactly (it used the canvas measureText of each letter at 1000px; here that is
// bbox * 1000 / unitsPerEm).
//
// Run: node tools/build-glyphs.cjs   (needs network; fontkit is a dev dependency)
const fs = require('fs');
const path = require('path');
const fontkit = require('fontkit');

const NS = ["Black Ops One:400", "Gravitas One:400", "Labrada:900", "Fraunces:900", "Cinzel:900", "Roboto Slab:800", "Peralta:400", "Corben:700", "Calistoga:400", "Righteous:400", "Audiowide:400", "Big Shoulders:900", "Saira Stencil:900", "Space Mono:700", "Patua One:400", "Krona One:400", "Zen Dots:400", "Fruktur:400", "Protest Guerrilla:400", "Vollkorn:900"];
const QS = ["Bodoni Moda:900", "EB Garamond:800", "Texturina:900", "Montenegrin Gothic One:400", "Bigshot One:400", "Staatliches:400", "Rowdies:400", "Tilt Warp:400", "Fontdiner Swanky:400", "Cherry Swash:700", "Stick No Bills:800", "Courier Prime:700", "Spectral:800", "Unbounded:600", "Chewy:400", "Space Grotesk:700", "Podkova:800", "Londrina Solid:900", "Days One:400", "Alegreya:800"];
const LABEL_FONT = 'https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Bold.ttf';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0 Safari/537.36';
const OUT = path.join(__dirname, '..', 'logo', 'glyphs.json');

const get = async (url, as = 'buffer') => {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return as === 'text' ? r.text() : Buffer.from(await r.arrayBuffer());
};
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const round = (v, dp) => { const m = 10 ** dp; const r = Math.round(v * m) / m; return Object.is(r, -0) ? 0 : r; };

// Which licence folder of the google/fonts repository holds the family.
async function licenceFor(family) {
  const dir = family.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [folder, name] of [['ofl', 'SIL Open Font Licence'], ['apache', 'Apache 2.0'], ['ufl', 'Ubuntu Font Licence']]) {
    const r = await fetch(`https://raw.githubusercontent.com/google/fonts/main/${folder}/${dir}/METADATA.pb`, { method: 'HEAD' });
    if (r.ok) return name;
  }
  return 'unknown: check before use';
}

// fontkit path commands to an SVG path string, rounded.
function toD(commands, dp, map = (x, y) => [x, y]) {
  const out = [];
  for (const { command, args } of commands) {
    const pts = [];
    for (let i = 0; i < args.length; i += 2) { const [x, y] = map(args[i], args[i + 1]); pts.push(round(x, dp), round(y, dp)); }
    const c = { moveTo: 'M', lineTo: 'L', quadraticCurveTo: 'Q', bezierCurveTo: 'C', closePath: 'Z' }[command];
    out.push(c + pts.join(' '));
  }
  return out.join('');
}

async function letterFrom(spec, letter) {
  const [family, weight] = spec.split(':');
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${weight}&text=${letter}`;
  const css = await get(cssUrl, 'text');
  const src = (css.match(/src:\s*url\(([^)]+)\)/) || [])[1];
  if (!src) throw new Error(`no font file in CSS for ${spec}`);
  let font = fontkit.create(await get(src));
  const axes = font.variationAxes || {};
  if (axes.wght) font = font.getVariation({ wght: Number(weight) });
  const g = font.glyphForCodePoint(letter.codePointAt(0));
  if (!g || !g.path.commands.length) throw new Error(`no ${letter} outline in ${spec}`);
  const b = g.bbox;
  return {
    id: `${letter.toLowerCase()}-${slug(family)}-${weight}`,
    letter, family, weight: Number(weight),
    licence: await licenceFor(family),
    source: `Google Fonts (${cssUrl})`,
    variable: Boolean(axes.wght),
    upm: font.unitsPerEm,
    advance: g.advanceWidth,
    bbox: [b.minX, b.minY, b.maxX, b.maxY],
    d: toD(g.path.commands, 1)
  };
}

// NORTHERN over QUARTER, laid out exactly as the generator's canvas did, in the 1000-unit square:
// label size from the ink width of NORTHERN (no letter spacing), Poppins Bold, right aligned at
// 940 + 1% of the size with 1% letter spacing, line height 1.12, bottom inset 4.5%.
async function label() {
  const font = fontkit.create(await get(LABEL_FONT));
  const upm = font.unitsPerEm;
  const run = t => { const r = font.layout(t); return r.glyphs.map((g, i) => ({ g, adv: r.positions[i].xAdvance, dx: r.positions[i].xOffset })); };
  const north = run('NORTHERN');
  // Chrome's measureText reports each letter's edges in steps of 1/64 of the font size, rounded
  // outwards; the generator's label size came from that, so the same rounding is used here.
  const step = upm / 64, down = v => Math.floor(v / step + 1e-9) * step, up = v => Math.ceil(v / step - 1e-9) * step;
  let x = 0, lo = Infinity, hi = -Infinity;
  for (const { g, adv, dx } of north) { lo = Math.min(lo, x + dx + down(g.bbox.minX)); hi = Math.max(hi, x + dx + up(g.bbox.maxX)); x += adv; }
  const ink1000 = (hi - lo) * 1000 / upm;
  const LABEL = 43.2 / (ink1000 / 1000 + 7 * 0.01);
  const fsz = LABEL * 10, top = 955 - 2.24 * fsz, ls = 0.01 * fsz, rx = 940 + 0.01 * fsz, s = fsz / upm;
  const parts = [];
  for (const [text, baseline] of [['NORTHERN', top + 0.91 * fsz], ['QUARTER', top + 1.12 * fsz + 0.91 * fsz]]) {
    const glyphs = run(text);
    const W = glyphs.reduce((w, { adv }) => w + adv * s + ls, 0);
    let ox = rx - W;
    for (const { g, adv, dx } of glyphs) {
      const gx = ox + dx * s;
      parts.push(toD(g.path.commands, 2, (px, py) => [gx + px * s, baseline - py * s]));
      ox += adv * s + ls;
    }
  }
  return { font: 'Poppins Bold', licence: 'SIL Open Font Licence', source: LABEL_FONT, size: round(fsz, 4), top: round(top, 4), d: parts.join('') };
}

(async () => {
  const glyphs = [];
  for (const [list, letter] of [[NS, 'N'], [QS, 'Q']]) {
    for (const spec of list) {
      const g = await letterFrom(spec, letter);
      glyphs.push(g);
      console.log(`${letter} ${g.family.padEnd(24)} upm ${String(g.upm).padEnd(5)} adv ${String(g.advance).padEnd(5)} bbox ${g.bbox.join(',').padEnd(22)} ${g.variable ? 'variable ' : ''}${g.licence}  path ${g.d.length} chars`);
    }
  }
  const data = { version: 1, built: new Date().toISOString(), note: "N and Q fonts and the layout rules are James Foster's NQ Generator (6 Oct 2026).", label: await label(), glyphs };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data));
  console.log(`\nlabel: size ${data.label.size}, top ${data.label.top}, path ${data.label.d.length} chars`);
  console.log(`wrote ${OUT}: ${fs.statSync(OUT).size} bytes, ${glyphs.length} letters`);
})().catch(e => { console.error('BUILD FAILED:', e.message); process.exit(1); });
