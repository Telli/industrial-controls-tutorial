# Google Analytics

Production: https://ic.agentqi.dev

- Account: Personal Site (`347544389`).
- Dedicated GA4 property: Industrial Controls — ic.agentqi.dev (`556927105`).
- Web stream: Industrial Controls website (`15909998523`).
- Public measurement ID: `G-GLF0GGX9RJ`.
- Reporting time zone: America/Los_Angeles; currency USD.
- Cloud project for MCP access, selected by the owner: AgriOne (`agrione-430400`).

## Collection

`public/analytics.js` is shared by the app and every generated reading HTML page.
Collection starts only after a visitor allows analytics. The choice is saved locally,
can be changed using the Analytics button, and respects browser Do Not Track and
Global Privacy Control. Localhost never loads Google Analytics. Advertising storage,
ad user data, ad personalization, and Google signals are disabled.

React route changes emit one manual page view, with titles and content groups for
Overview, Lab directory, Labs and Tutorials. Reading documents record their own
page view. URLs exclude query strings, and external referrers are reduced to their
origin. No search text, answers or lab input values are sent by the integration.
Enhanced measurement handles scrolling, outbound links, video engagement and file
downloads. Site search, form interactions and automatic history page views are off.
`send_page_view: false` prevents automatic initial page views from duplicating ours.

Reports measure visitors who opt in; browser blocking and privacy preferences can
reduce counts. Test visits made during deployment also appear in the reports.

## Validation and deployment

Run `node --test scripts/analytics.test.mjs` for consent, withdrawal, privacy signal,
route deduplication, URL filtering and reading-page checks. Run `npm run build` to
build and validate all relative reading links. The build intentionally retains a
classic, public analytics script shared with static reading pages.

2026-09-30: five analytics tests passed; production build passed; 893 local links
and anchors checked. All 62 HTTPS deployment files matched their SHA-256 manifest.
GA4 Realtime confirmed a test visitor and separate tutorial-directory/lab views.

## Local MCP

Official `analytics-mcp` version 0.7.0 is installed using uv in the user tool environment.
Codex configuration registers `C:/Users/telli/.local/bin/analytics-mcp.exe` as the
`google-analytics` server. Its stdio handshake and nine tool definitions were verified.

Report authentication is not yet completed. The Analytics Data and Admin APIs must
be enabled in AgriOne, followed by a local OAuth connection with the
`https://www.googleapis.com/auth/analytics.readonly` scope. Google API terms and
the OAuth User Data Policy require owner confirmation before continuing. The OAuth
app form is prepared as AgentQI Analytics MCP, external/testing, using the signed-in
owner's support/contact email. No new Cloud project was created or billing linked.

Never publish OAuth client secrets, refresh tokens, service account keys or ADC files
in this repository or the hosting document root. The measurement ID alone is public.
