# nqhudds.org.uk holding page

One page, no dependencies, no build step. `server.js` is a plain Node http server that
serves `index.html` on every path. Deployed on Railway, in Dan's own Railway workspace
(`startlingdan's Projects`), served at the apex `nqhudds.org.uk` with no www.

Run locally:

    node server.js     # then open http://localhost:3000

## Colours

Option 2 from the palette, chosen by Gabby on 19 Sep 2026.

    --green     #1F3D2C   footer
    --ink       #131A16   page background
    --bone      #F2EADC   body text
    --sandstone #A89878   secondary text, rules
    --acid      #C4D44A   top rule, "QUARTER", the email button

## Copy

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
