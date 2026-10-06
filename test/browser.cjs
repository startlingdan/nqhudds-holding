// Browser test for the nqhudds.org.uk logo proof of concept.
// Usage: PORT=3998 node server.js &  then  node test/browser.cjs <outdir> http://127.0.0.1:3998/
let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = require('/data/workspace/node_modules/puppeteer'); } // PortaClaude keeps Puppeteer here
const OUT = process.argv[2];
const BASE = process.argv[3] || 'http://127.0.0.1:3998/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function sample(page, ms, every = 40) {
  const t0 = Date.now(); const log = []; let lastC = null, lastL = null;
  while (Date.now() - t0 < ms) {
    const s = await page.evaluate(() => {
      const now = document.getElementById('now').textContent;
      return {
        c: getComputedStyle(document.documentElement).getPropertyValue('--nq').trim(),
        logo: now.split(' · ').slice(1).join(' · '),
        name: now.split(' · ')[0],
        busy: document.getElementById('rotate').classList.contains('busy'),
      };
    });
    const t = Date.now() - t0;
    if (s.c !== lastC) { log.push({ t, kind: 'colour', v: s.c }); lastC = s.c; }
    if (s.logo !== lastL) { log.push({ t, kind: 'logo', v: s.logo }); lastL = s.logo; }
    await sleep(every);
  }
  const end = await page.evaluate(() => ({
    busy: document.getElementById('rotate').classList.contains('busy'),
    stored: (() => { try { return sessionStorage.getItem('nq-colour'); } catch (e) { return 'ERR'; } })(),
    caption: document.getElementById('now').textContent,
    theme: document.getElementById('theme-color').getAttribute('content'),
    favicon: document.getElementById('favicon').href.slice(0, 22),
  }));
  return { log, end };
}

function summarise(label, { log, end }) {
  const colours = log.filter(e => e.kind === 'colour');
  const logos = log.filter(e => e.kind === 'logo' && e.v);
  const gaps = (arr) => arr.slice(1).map((e, i) => e.t - arr[i].t);
  console.log(`\n== ${label}`);
  console.log(`colour changes: ${colours.length} (incl. initial), last at ${colours.at(-1)?.t} ms; gaps ${JSON.stringify(gaps(colours))}`);
  console.log(`logo changes: ${logos.length}, first at ${logos[0]?.t} ms, last at ${logos.at(-1)?.t} ms; gaps ${JSON.stringify(gaps(logos))}`);
  console.log(`end: ${JSON.stringify(end)}`);
}

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const errors = [];
  const watch = (page, tag) => {
    page.on('console', m => { if (['error', 'warn', 'warning'].includes(m.type())) errors.push(`${tag} ${m.type()}: ${m.text()}`); });
    page.on('pageerror', e => errors.push(`${tag} pageerror: ${e.message}`));
    page.on('requestfailed', r => errors.push(`${tag} requestfailed: ${r.url().slice(0, 90)} ${r.failure()?.errorText}`));
  };
  const phone = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

  // 1. First visit on a phone
  const c1 = await browser.createBrowserContext();
  const p = await c1.newPage(); watch(p, '[phone]');
  const fontFiles = [];
  p.on('request', r => { if (r.url().startsWith('https://fonts.gstatic.com/')) fontFiles.push(r.url()); });
  await p.setViewport(phone);
  await p.goto(BASE, { waitUntil: 'domcontentloaded' });
  const shots = [];
  const first = await (async () => {
    const run = sample(p, 8000);
    await sleep(1200); await p.screenshot({ path: `${OUT}/phone-1-mid.png` });
    return run;
  })();
  summarise('FIRST VISIT (phone)', first);
  await p.screenshot({ path: `${OUT}/phone-2-settled.png` });
  console.log('font files downloaded on first visit:', fontFiles.length, fontFiles.map(u => u.replace(/^https:\/\/fonts\.gstatic\.com\//, '').slice(0, 40)).join(' | '));
  const fonts = await p.evaluate(() => {
    const st = {}; document.fonts.forEach(f => { st[f.status] = (st[f.status] || 0) + 1; });
    return { st, scrollW: document.documentElement.scrollWidth, innerW: innerWidth };
  });
  console.log('fonts by status:', JSON.stringify(fonts.st), '| scrollWidth', fonts.scrollW, 'innerWidth', fonts.innerW);

  // 2. Reload: same colour, three logos then settle
  await p.reload({ waitUntil: 'domcontentloaded' });
  summarise('RELOAD (phone)', await sample(p, 3500));

  // 3. Rotate button
  await p.tap('#rotate');
  summarise('ROTATE TAP (phone)', await sample(p, 3000));
  await p.screenshot({ path: `${OUT}/phone-3-after-rotate.png`, fullPage: true });

  // 4. ?fresh replays the first visit
  await p.goto(BASE + '?fresh', { waitUntil: 'domcontentloaded' });
  summarise('?fresh (phone)', await sample(p, 7500));

  // 5. Reduced motion: no cycling at all
  const c2 = await browser.createBrowserContext();
  const q = await c2.newPage(); watch(q, '[still]');
  await q.setViewport(phone);
  await q.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await q.goto(BASE, { waitUntil: 'domcontentloaded' });
  summarise('REDUCED MOTION first visit', await sample(q, 3500));
  await q.reload({ waitUntil: 'domcontentloaded' });
  summarise('REDUCED MOTION reload', await sample(q, 2500));

  // 6. Desktop
  const c3 = await browser.createBrowserContext();
  const d = await c3.newPage(); watch(d, '[desktop]');
  await d.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await d.goto(BASE, { waitUntil: 'domcontentloaded' });
  await sleep(7500);
  await d.screenshot({ path: `${OUT}/desktop-settled.png` });

  console.log('\nERRORS/WARNINGS:', errors.length ? '\n' + errors.join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAILED', e); process.exit(1); });
