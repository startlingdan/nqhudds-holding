// Checks that the outline logo (logo/glyphs.json + NQ_LOGO in index.html) matches James Foster's
// canvas generator, which drew with the real fonts. Runs both in one browser:
//   1. each letter's measurements: canvas measureText at 1000px vs the outline's bounding box
//   2. the label size and position
//   3. the layout of all 400 N and Q pairings
//   4. pixel comparison of sample logos, plus a side-by-side image
// Usage: PORT=3998 node server.js &  then  node test/compare-with-fonts.cjs <outdir> http://127.0.0.1:3998/
let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = require('/data/workspace/node_modules/puppeteer'); }
const fs = require('fs');
const OUT = process.argv[2], BASE = process.argv[3] || 'http://127.0.0.1:3998/';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(BASE + '?fresh', { waitUntil: 'networkidle0' });

  const res = await page.evaluate(async () => {
    const G = window.NQ_LOGO.glyphs, LABEL_DATA = window.NQ_LOGO.label;
    // Load the real fonts the way the generator did (full fonts, one bold weight each).
    const fams = [...new Set(G.map(g => `family=${g.family.replace(/ /g, '+')}:wght@${g.weight}`))];
    for (let i = 0; i < fams.length; i += 20) {
      const l = document.createElement('link'); l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?' + fams.slice(i, i + 20).join('&') + '&display=block';
      document.head.appendChild(l); await new Promise(r => { l.onload = r; l.onerror = r; });
    }
    await Promise.all([document.fonts.load('700 100px Poppins', 'NORTHERN QUARTER'), ...G.map(g => document.fonts.load(`${g.weight} 100px "${g.family}"`, g.letter))]);

    // --- James's generator code, unchanged in substance ---
    const mctx = document.createElement('canvas').getContext('2d');
    const measureC = (g) => { mctx.font = `${g.weight} 1000px "${g.family}"`; const m = mctx.measureText(g.letter); return { a: m.actualBoundingBoxAscent, d: Math.max(0, m.actualBoundingBoxDescent), l: m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight }; };
    const labelSize = () => { mctx.font = '700 1000px Poppins'; const m = mctx.measureText('NORTHERN'); return 43.2 / ((m.actualBoundingBoxLeft + m.actualBoundingBoxRight) / 1000 + 7 * 0.01); };
    const LABEL = labelSize();
    const BOX = { left: 80, right: 920, top: 80, gap: 24 };
    function jamesLayout(nG, qG) {
      const fs = LABEL * 10, labelTop = 955 - 2.24 * fs;
      const n = measureC(nG), q = measureC(qG);
      const nw = (n.l + n.r) / n.a, qw = (q.l + q.r) / q.a, desc = Math.max(n.d / n.a, q.d / q.a);
      const bottom = labelTop - BOX.top, hardStop = labelTop - 26;
      const H = Math.min((BOX.right - BOX.left - BOX.gap) / (nw + qw), (bottom - BOX.top) / (1 + desc / 2), (hardStop - BOX.top) / (1 + desc));
      const x0 = BOX.left + (BOX.right - BOX.left - (H * (nw + qw) + BOX.gap)) / 2;
      const visual = H * (1 + desc / 2);
      const base = Math.min(labelTop / 2 + visual / 2 - H * desc / 2, hardStop - H * desc);
      const nSize = 1000 * H / n.a, qSize = 1000 * H / q.a;
      return { H, x0, base, nx: x0 + n.l * nSize / 1000, qx: x0 + H * nw + BOX.gap + q.l * qSize / 1000, nSize, qSize, labelTop, fs };
    }
    function jamesDraw(ctx, nG, qG) {
      const L = jamesLayout(nG, qG), fs = L.fs;
      ctx.clearRect(0, 0, 1000, 1000); ctx.fillStyle = '#fff';
      ctx.font = `700 ${fs}px Poppins`; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${0.01 * fs}px`;
      const rx = 940 + 0.01 * fs;
      ctx.fillText('NORTHERN', rx, L.labelTop + 0.91 * fs); ctx.fillText('QUARTER', rx, L.labelTop + 1.12 * fs + 0.91 * fs);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.textAlign = 'left';
      ctx.font = `${nG.weight} ${L.nSize}px "${nG.family}"`; ctx.fillText('N', L.nx, L.base);
      ctx.font = `${qG.weight} ${L.qSize}px "${qG.family}"`; ctx.fillText('Q', L.qx, L.base);
    }

    // 1. letters
    let letterMax = 0, worst = '';
    for (const g of G) {
      const c = measureC(g), o = window.NQ_LOGO.measure(g);
      const diffs = [c.a - o.a, c.d - o.d, c.l - o.l, c.r - o.r].map(Math.abs);
      const m = Math.max(...diffs); if (m > letterMax) { letterMax = m; worst = `${g.letter} ${g.family}`; }
    }
    // 2. label
    const labelDiff = { size: Math.abs(LABEL * 10 - LABEL_DATA.size), top: Math.abs((955 - 2.24 * LABEL * 10) - LABEL_DATA.top) };
    // 3. all pairings
    const Ns = G.filter(g => g.letter === 'N'), Qs = G.filter(g => g.letter === 'Q');
    const mx = { H: 0, x0: 0, base: 0, nx: 0, qx: 0, nScale: 0, qScale: 0 };
    for (const nG of Ns) for (const qG of Qs) {
      const J = jamesLayout(nG, qG), M = window.NQ_LOGO.layout(nG, qG);
      const d = { H: J.H - M.H, x0: J.x0 - M.x0, base: J.base - M.base, nx: J.nx - M.n.x, qx: J.qx - M.q.x, nScale: (J.nSize / nG.upm - M.n.s) * nG.upm, qScale: (J.qSize / qG.upm - M.q.s) * qG.upm };
      for (const k in d) mx[k] = Math.max(mx[k], Math.abs(d[k]));
    }
    // 4. pixels
    const toImg = s => new Promise(r => { const im = new Image(); im.onload = () => r(im); im.src = 'data:image/svg+xml,' + encodeURIComponent(s); });
    const A = document.createElement('canvas'); A.width = A.height = 1000; const a = A.getContext('2d');
    const B = document.createElement('canvas'); B.width = B.height = 1000; const b = B.getContext('2d');
    const pix = []; let side = null;
    for (let t = 0; t < 16; t++) {
      const nG = Ns[(t * 7) % 20], qG = Qs[(t * 11 + 3) % 20];
      jamesDraw(a, nG, qG);
      b.clearRect(0, 0, 1000, 1000); b.drawImage(await toImg(window.NQ_LOGO.svg(nG, qG)), 0, 0, 1000, 1000);
      const da = a.getImageData(0, 0, 1000, 1000).data, db = b.getImageData(0, 0, 1000, 1000).data;
      let ink = 0, off = 0;
      for (let i = 3; i < da.length; i += 4) { if (da[i] > 128 || db[i] > 128) ink++; if (Math.abs(da[i] - db[i]) > 128) off++; }
      pix.push({ pair: `${nG.family} + ${qG.family}`, inkPixels: ink, differing: off, pct: +(100 * off / ink).toFixed(3) });
      if (t === 0) {
        const S = document.createElement('canvas'); S.width = 2040; S.height = 1000; const s = S.getContext('2d');
        s.fillStyle = '#0F4336'; s.fillRect(0, 0, 2040, 1000); s.drawImage(A, 0, 0); s.drawImage(B, 1040, 0);
        side = S.toDataURL('image/png');
      }
    }
    return { LABEL, letterMax, worst, labelDiff, mx, pix, side };
  });

  fs.writeFileSync(`${OUT}/compare-side-by-side.png`, Buffer.from(res.side.split(',')[1], 'base64'));
  const r2 = v => +v.toFixed(3);
  console.log('All numbers in the 1000-unit logo square.');
  console.log(`1. Letters: largest difference in any measurement ${r2(res.letterMax)} (worst: ${res.worst})`);
  console.log(`2. Label: size differs by ${r2(res.labelDiff.size)}, top by ${r2(res.labelDiff.top)}`);
  console.log(`3. All 400 pairings, largest differences: ${Object.entries(res.mx).map(([k, v]) => `${k} ${r2(v)}`).join(', ')}`);
  console.log('4. Pixels (share of inked pixels that differ by more than half):');
  for (const p of res.pix) console.log(`   ${p.pct}%  ${p.pair}`);
  await browser.close();
})().catch(e => { console.error('COMPARE FAILED', e); process.exit(1); });
