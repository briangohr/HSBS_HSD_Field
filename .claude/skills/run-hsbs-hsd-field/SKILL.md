---
name: run-hsbs-hsd-field
description: Run, start, drive or screenshot the HSBS field app (/join, /refer/<key>, /update/<key>) locally against fake HSBS 1J, 1F and 7F flows. Use to see a UI change working, click through Send, Track, My Earnings, My Team or the partner update page, check what the site posts to a flow, or test a flag like REP_PAY_ENABLED.
---

# Run the HSBS field app

Astro site (Vercel adapter) with no home page. Every screen needs a flow behind it, so the
agent path is `driver.mjs`: it starts `astro dev` on :4410 plus one fake flow server on
:4411 that answers as HSBS 1J (`/1j`), 1F (`/1f`) and 7F (`/7f`) with TEST people only,
then drives the pages with Playwright. Nothing leaves the machine.

Paths below are relative to the repo root. `D` is the driver:

```bash
D=.claude/skills/run-hsbs-hsd-field/driver.mjs
```

## Prerequisites

Node 22 and the pre-installed Playwright Chromium. No apt packages, no xvfb (headless).

```bash
npm ci
```

## Run (agent path)

```bash
node $D up                       # ~2s. Prints the TEST links below.
node $D tour /tmp/shots          # ~20s. Clicks every screen, 10 phone screenshots.
node $D down
```

`up` prints:

```
join:     http://localhost:4410/join
rep:      http://localhost:4410/refer/RunRep_rrrrrrrrrrrrrrrrrrrrrrrr
manager:  http://localhost:4410/refer/RunMgr_mmmmmmmmmmmmmmmmmmmmmmmm
partner:  http://localhost:4410/update/a1a1...a1   ("a1" x 20, a TEST key)
```

`tour` fills and sends `/join`, picks HealthFirst on the rep link, fills the referral
(state typeahead included), sends it, opens Track and My Earnings, opens My Team on the
manager link, then sets Meeting set on the first partner lead and saves. It ends with a
count of what reached each fake flow, e.g.
`posted: 1j=1 1f submit=1 list=2 earnings=1 team=1 7f save=1`. Look at the PNGs.

One screen, one shot:

```bash
node $D shot /refer/RunRep_rrrrrrrrrrrrrrrrrrrrrrrr /tmp/track.png --tab=track
node $D shot /join /tmp/join-nojs.png --nojs --phone
```

Flags: `--phone` (iPhone 13), `--nojs`, `--nofull` (viewport only), `--tab=track|earnings|team`.

What the site sent to a flow (one JSON line per post, newest last):

```bash
node $D bodies submit            # 1F submits; also: lookup, list, earnings, team, save
node $D bodies /1j               # every sign-up post
```

### Flags and env

Defaults: `REP_APP_ENABLED=true REP_PAY_ENABLED=true REP_APP_COMPANIES=HealthFirst,Staffing
REP_ASK_STATE=true PARTNER_PAGE_ENABLED=true`. Override on `up` (it restarts):

```bash
node $D up REP_APP_ENABLED=false     # every page 404, /j still redirects
```

Fake data lives in `answer()` in the driver: rep key gets 3 referrals (2 HealthFirst, 1
Direct Dental) and 3 ledger rows; manager key gets a 2-person team; partner key gets 2
leads. Edit there to test another 1F answer shape.

## Direct invocation (lib code)

Most PRs touch `src/lib/`. Call a module without the site. The `--import` hook resolves
extensionless imports the way Astro does:

```bash
node --import ./scripts/test-register.mjs --input-type=module -e "const f = await import('./src/lib/field-form.mjs'); console.log(f.isReferralKey('RunRep_rrrrrrrrrrrrrrrrrrrrrrrr'))"
node --import ./scripts/test-register.mjs --test src/lib/rep-pay-plan.test.mjs
```

## Test

```bash
npm test          # 517 lib tests, ~20s
```

`npm run e2e` is the full browser suite with its own fake flows (ports 4400-4405). Run
`node $D down` first; see Gotchas.

## Run (human path)

`npm run dev` serves on :4321, but with no flow URLs every page is a 404 or a flow error.
Use the driver.

## Gotchas

- **Astro's dev toolbar eats clicks.** `<astro-dev-toolbar>` sits over the bottom tab bar
  and the partner Save button, so Playwright clicks time out ("intercepts pointer events").
  The driver hides it with a style tag after every load. Users never see it.
- **`addStyleTag` hangs with JavaScript off.** So the driver skips it for `--nojs`. The
  toolbar does not render without JS anyway.
- **State is a typeahead, not a select, with JS on** (`REP_ASK_STATE=true`). The real
  `<select name=practiceState>` is hidden; `selectOption` leaves the button reading "Pick
  the state". Type into `#rep-form [data-state-input]`, then click
  `#rep-state-list [role=option]`.
- **Full-page shots paint the tab bar mid-page.** It is `position: fixed`. Use `--nofull`
  when the bar position matters.
- **One `astro dev` per repo.** `npx astro dev stop` (used by `down` and by every e2e
  script) kills whatever dev server this project started, on any port. Running
  `npm run e2e` while the driver is up kills the driver's site; `up` kills an e2e run's.
- **`/j` answers 301 in dev**, not the 302 in `astro.config.mjs`. Do not "fix" it from a
  dev check.
- **1F lookup must see `activate: true`.** The fake 1F, like the real contract (#52),
  treats any other lookup as an unknown key, and the page then 404s.
- **Track, Earnings and Team load on first tab open**, from the fake 1F. The driver waits
  1.5s after a tab click.
- **The secret scan flags any 40-hex string**, TEST or not (it looks like a partner link
  key). That is why the partner key is built as `'a1'.repeat(20)` in the driver and cut
  short above. Get the full link from `node $D keys`.
- Logs: `/tmp/hsbs-field-run/dev.log` (Astro) and `flow.log`. Set `HSBS_RUN_DIR`,
  `HSBS_SITE_PORT`, `HSBS_FLOW_PORT` to move them.

## Troubleshooting

- `TimeoutError ... <astro-dev-toolbar> intercepts pointer events`: a raw Playwright script
  without the toolbar style. Add
  `page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' })` after
  each `goto`.
- Send button stays "Pick the state": state set with `selectOption` while JS is on. Use the
  typeahead (above).
- `shot ... --nojs` never returns: an older driver that called `addStyleTag` with JS off.
- Site gives `000` / connection refused after an e2e run: e2e stopped it. `node $D up`.
