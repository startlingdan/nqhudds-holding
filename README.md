# nqhudds.org.uk holding page

One page, no dependencies, no build step. `server.js` is a plain Node http server that
serves `index.html` on every path. Deployed on Railway, in Dan's own Railway workspace
(`startlingdan's Projects`), served at the apex `nqhudds.org.uk` with no www.

Run locally:

    node server.js     # then open http://localhost:3000

## The look: a random logo and a random colour (since 6 Oct 2026)

A proof of concept for the new site's theme, on the live holding page. The logo system
and the palette are James Foster's "NQ Generator", a Claude artifact he shared on
6 Oct 2026. Dan, the same day: it is "both the next pallette and the new approach", a
randomly generated logo across the website and in branding, and the palette "will do for
now". The site behaviour around it was Dan's brief, built the same evening.

- **Logo**: a square drawn on a canvas. White N and Q side by side at one cap height, with
  NORTHERN over QUARTER in Poppins Bold in the bottom right. The N comes from one list of
  20 display fonts and the Q from a different 20 (`NS` and `QS` in the script). The layout
  rules are copied from the generator unchanged, so the logos match it.
- **Colour**: 20 RAL paint colours (`NQ_PALETTE` in the head script). The whole page takes
  the colour, and so do the browser bar (`theme-color`) and the email button's text.
- **Fonts**: Google Fonts. The 40 logo fonts are requested with `text=NQ`, so each file
  holds only those two letters. Measured 6 Oct 2026: 51 KB for all 40 on an iPhone, 81 KB on
  desktop Chrome, plus 15 KB of stylesheets and 23 KB of Poppins (latin, three weights).
  (Correction: this line first said "about 1 KB each, about 40 KB for all 40", which came
  from a sample of five files on an iPhone.) Poppins for the rest. The script only draws
  with fonts that actually arrived, and waits at most 3 s.
- **Licences**: all 41 fonts are open licences that allow logo use: 38 SIL Open Font
  Licence (including Poppins), 3 Apache 2.0 (Chewy, Fontdiner Swanky, Roboto Slab).
  Checked against the folders of the google/fonts repository, 6 Oct 2026.

What it does:

- **First visit**: colour and logo change together, then the colour settles (about 2.7 s),
  then a few more logos before the logo settles (about 5.6 s in all).
- **Every later page load in the visit**: same colour; three logos, then it settles
  (about 1.3 s).
- **Rotate button** (bottom left of the logo): three logos, then it settles. The colour
  stays.
- A visit is the browser tab's session (`sessionStorage`, key `nq-colour`). Adding `?fresh`
  to the address starts a new visit, which replays the first-visit sequence.
- Never more than about three changes a second: the whole screen changes colour, and
  faster full-screen flashing can trigger seizures (WCAG 2.3.1).
- With the reduced motion setting on, nothing cycles: a colour and a logo are picked once.
- The footer shows the colour and the two fonts in use, and the browser tab icon is redrawn
  from the settled logo. Both are proof-of-concept extras.

**Known gap, not yet decided:** small white text falls below the usual contrast standard
(WCAG AA, 4.5:1) on three of the 20 colours: RAL 1027 Curry 3.69, RAL 2009 Traffic orange
3.82, RAL 3017 Rose 4.04. Large and bold text (the logo, the headline, the email button)
passes on all 20.

Browser test (first visit, reload, rotate, `?fresh`, reduced motion, desktop; screenshots
go to the output folder): `PORT=3998 node server.js &` then
`node test/browser.cjs <outdir> http://127.0.0.1:3998/`.

## Copy

Unchanged from the first holding page, except that the "Northern / Quarter" wordmark
heading is now the logo (the heading stays in the page for screen readers and search).

Placeholder, written 19 Sep 2026. Deliberately makes no claim about a reopening date,
because at the time of writing the tenancy was not signed and the opening had already
slipped. It names the CIC because that is on the public record. It does NOT link the
Instagram or Facebook accounts, because ownership of those was never formalised and they
were still controlled by the outgoing operators.

## Deploying a change

**Push alone does NOT deploy.** The service was created through the Railway API with the
repo as its source, which builds once but does not create a push trigger: `repoTriggers`
on the service is empty, and there is no `repoTriggerCreate` in Railway's public GraphQL
schema, so it cannot be added from a session. Until someone connects the repo in the
Railway UI (service, Settings, Source), every deploy has to be triggered explicitly:

    mutation { serviceInstanceDeployV2(
      serviceId: "927941d9-a685-4eea-9d6b-42777e4e9f93",
      environmentId: "9981b05f-6063-44f7-a5fd-c0ac2733a47d",
      commitSha: "<sha>") }

against `https://backboard.railway.com/graphql/v2` with `RAILWAY_USER_TOKEN`.

Verify afterwards by comparing the served byte count to the local file, because Cloudflare
sits in front and a stale response looks identical to a successful deploy:

    curl -s "https://nqhudds.org.uk/?v=$(date +%s)" -o /tmp/l.html -w "%{size_download}\n"
    stat -c%s index.html

## Cloudflare email obfuscation

The zone proxies this site (Cloudflare flipped the apex record to proxied on its own,
despite being created with `proxied: false`). With `email_obfuscation` on, Cloudflare
rewrote the mailto link to `[email protected]` plus a decoder script. It looked fine in a
browser but was wrong in the source and for anything without JavaScript.

Fixed twice over: the zone setting is now off, AND the link is wrapped in
`<!--email_off-->...<!--email_on-->`, which is Cloudflare's per-element opt-out. The
wrapper travels with the code, so it survives the setting being turned back on or the
site moving to another Cloudflare zone.
