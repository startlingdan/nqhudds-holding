const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
// Railway sets this for deploys from GitHub; it shows which commit is live.
const BUILD = (process.env.RAILWAY_GIT_COMMIT_SHA || 'local').slice(0, 12);

// The logo outlines (see tools/build-glyphs.cjs) go into the page, so the logo needs no fonts
// and no second request. "<" is escaped so nothing in the data can close the script tag.
const glyphs = fs.readFileSync(path.join(__dirname, 'logo', 'glyphs.json'), 'utf8');
const page = Buffer.from(
  fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8')
    .replace('/*NQ_GLYPHS*/null', glyphs.replace(/</g, '\\u003c'))
);

const common = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-NQ-Build': BUILD
};

const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];

  if (url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain', ...common });
    return res.end('ok ' + BUILD);
  }

  if (url === '/robots.txt') {
    res.writeHead(200, { 'Content-Type': 'text/plain', ...common });
    return res.end('User-agent: *\nAllow: /\n');
  }

  if (url === '/logo/glyphs.json') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300', ...common });
    return res.end(glyphs);
  }

  // Holding site: every other path serves the one page.
  res.writeHead(url === '/' ? 200 : 404, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
    ...common
  });
  res.end(page);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Northern Quarter holding page listening on ' + PORT + ' (build ' + BUILD + ')');
});
