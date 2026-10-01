# Production deployment

The static site is hosted by DirectAdmin at `ic.agentqi.dev`. DNS is managed in
Telli's Lovable workspace under **Settings → Workspace domains → agentqi.dev →
DNS records**. Lovable is the DNS control surface; DirectAdmin serves the app.

Live site: <https://ic.agentqi.dev/>

## Hosting

- DirectAdmin: `https://vda3800.is.cc:2222`
- Hosting account: `adminagentqi`
- Hosting domain: `ic.agentqi.dev` (an independent domain entry for separate TLS management)
- Server IPv4: `104.37.190.58`
- Document root: `/home/adminagentqi/domains/ic.agentqi.dev/public_html`
- PHP and CGI are disabled for this static site.

The apex `agentqi.dev`, `www.agentqi.dev`, and `zh.agentqi.dev` keep their existing
Lovable project connections and DNS records.

## DNS

These A records use `104.37.190.58` with TTL 300 seconds:

| Host in the agentqi.dev zone | Purpose |
| --- | --- |
| `ic` | Production app |
| `www.ic` | DirectAdmin web alias |
| `mail.ic`, `ftp.ic`, `pop.ic`, `smtp.ic` | Standard hostnames included by DirectAdmin's automatic certificate plan |

No nameserver delegation was changed. The extra aliases support DirectAdmin's
certificate validation; no mailboxes or FTP credentials were created.

## Publishing updates

1. From `web`, run `npm ci`, `npm test`, and `npm run build`.
2. Archive the **contents** of `dist` so `index.html`, `assets/`, and `tutorials/`
   are at the ZIP root. Include all of `tutorials/`; the prebuild step generates it
   and the postbuild step validates the course files and links. Place `index.html`
   last in the archive so its new asset references are published after the files.
3. Upload the archive to `/domains/ic.agentqi.dev/`, outside `public_html`.
4. Extract into `/domains/ic.agentqi.dev/public_html/` with merge/overwrite enabled.
5. Verify HTTPS, the landing page, `/#/labs`, and at least one interactive lab.

The app uses hash routing and relative asset URLs, so no SPA rewrite rule is
required. Publish the build only, not source documents, the textbook PDF, or the
repository. Keep old hashed assets available during updates for already-open
browser sessions.

On machines that encounter a Rayon thread-allocation error while building, use
`$env:RAYON_NUM_THREADS='2'` in PowerShell before running the build.

## TLS

For **ic.agentqi.dev → SSL/TLS Certificates → ACME settings**, ACME is enabled and
**Prefer wildcard certificates** is disabled. DirectAdmin uses HTTP-01 validation
with the Let's Encrypt provider and ECDSA P-256 key type. Keep all DNS aliases
above pointed at this server for renewal. The parent domain's original ACME
preferences are preserved.

**Force SSL with https redirect** is enabled under the IC domain settings.
DirectAdmin reports the certificate as valid with automatic renewal.

## Initial release verification

The 2026-09-30 build contains 28 files. Every deployed file was retrieved from the
server and matched against the local build with SHA-256 (28 matches, zero
mismatches). Local verification evidence is stored in the ignored `.qa/` folder.

Final production checks passed:

- All six DNS names resolve publicly to `104.37.190.58`.
- HTTPS returns 200 with certificate verification enabled; its `index.html`
  matches the local production build's SHA-256.
- HTTP redirects to HTTPS with status 301.
- The landing page renders its three.js scene; layer selection and both themes work.
- The catalog lists 13 labs, and searching for `ladder` returns one experiment.
- The ladder-logic lab loads over HTTPS; pressing Start and completing a scan
  produces an ON command, ON feedback, and a RUNNING motor.
- No browser errors were observed in this smoke test. Three.js emitted a
  non-blocking `THREE.Clock` deprecation warning.
- The uploaded ZIP is outside the public document root; its public URL returns 404.

Screenshots are saved locally under `.qa/live-landing-light.png`,
`.qa/live-landing-dark.png`, `.qa/live-ladder-lab.png`, and
`.qa/directadmin-certificate-status.png`.

## Tutorial publication fix (2026-09-30)

The first release packaged the interactive app but omitted the written course.
The corrected build includes 61 files, with 33 tutorial assets: all 12 articles,
the handbook, combined and plain-text editions, supporting documents and the
offline study ZIP. `/#/tutorials` is linked from the main navigation and the labs.
The build checks all 878 local reading links and section anchors before release.
All 61 deployed files were retrieved over HTTPS and matched the release's SHA-256
manifest. Production browser checks verified the new navigation, the full handbook,
and the lab-to-article-to-catalog flow with no browser errors. Verification results
are in `.qa/tutorials-live-verification.json`; the live screenshot is
`.qa/live-tutorials.png`.


## Analytics release — 2026-09-30

Deployed `.qa/industrial-controls-analytics-20260930.zip` to the existing ic.agentqi.dev public_html root. All 62 files matched the local SHA-256 manifest over HTTPS. Five analytics behavior tests and the production build passed, including 893 local tutorial links/anchors. GA4 property 556927105 received separate lab and tutorial-directory pageviews in Realtime. Collection requires visitor opt-in. See ANALYTICS.md for configuration and the separately pending MCP authentication.
