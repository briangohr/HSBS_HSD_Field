# HSBS field app: agent rules

Read this first on every task, then `docs/field-flow-contract.md` and `AGENTS.md`.

This repo is the HSBS field app (the TSM app) for AEs, FSCs and RGMs: GitHub
`briangohr/HSBS_HSD_Field`, Vercel project `hsbs-hsd-field`. It was split out of the HSBS
repo on 11/17/2026 because Brian wants the field build entirely separate (Brian, 11/16:
"The Field build is supposed to be entirely separate.").

## Scope

- `/join`: sign-up. Posts to HSBS 1J (`REGISTER_FLOW_URL`).
- `/refer/<key>`: each person's own app link (Send, Track, My Earnings, My Team). Every
  read and send posts to HSBS 1F (`FIELD_FLOW_URL`), the field app's own flow.
- `/update/<key>`: a field partner's lead update page (sheet PU). Reads and saves post to
  HSBS 7F Field partner (`PARTNER_FLOW_URL`). Off (404) unless `PARTNER_PAGE_ENABLED=true`.
- `/refer/manifest/<key>`: the install manifest for that person's link.
- `/j`: the sign-up QR short link, a 302 to `/join?src=qr`. It answers even with the app
  off; `/join` itself is then 404.
- `/confirm/<token>`: kept in code, off (404) unless `REP_CONFIRM_ENABLED=true`.
- Everything except `/j` answers 404 unless `REP_APP_ENABLED=true`.

The field build talks to no flow but 1J, 1F and 7F, and to no other team's lists. Field
work, desk files, status updates and questions to Brian stay on the field side only. A
field flow that still touches another team's flow or list is a defect to remove, not a feature to keep.

## Folder layout and imports

- `src/pages/`: routes and APIs. Pages may import components and lib.
- `src/components/`: page UI. Components may import lib, not API routes.
- `src/lib/`: server and shared logic, with tests beside the module. Lib must not import
  pages or components. `field-flow.mjs` is the only module that posts to 1F;
  `register-flow.mjs` the only one that posts to 1J; `partner-flow.mjs` the only one that
  posts to 7F.
- `docs/`: the contract. A change to what a route sends to or expects from a flow updates
  `docs/field-flow-contract.md` in the same PR. `docs/build/` holds the flow-side build
  sheets moved from the old repo; read its README first.
- `scripts/`: the secret scan, the test loader and the browser tests. Browser tests use a
  local fake flow, never a live one.

## Hard rules

- No secrets, signed flow URLs, keys, tokens or production data in the repo, logs,
  prompts or client bundle. They belong in Vercel env or SharePoint.
- The site never calls SharePoint or Salesforce. It posts to Power Automate HTTP flows.
- Claude makes field live changes itself, without asking (see "Live changes" below).
  Brian is the last resort, not the operator.
- Name, email and role on a submit come from the 1F lookup, never from the browser body.
- Unknown or expired keys fail closed. A lookup answer whose role is not `Rep` is an
  unknown key.
- Nothing writes back to Salesforce. Do not add Smartsheet or Airtable.
- Success is HTTP 200 with `{"ok":true}` after the row exists. A 202, timeout or non-JSON
  is not success. A retry reuses the same `submissionId`.
- No live sends while testing. Use TEST people. The site does not send mail. A flow
  recipient who is a real partner or rep is added only with Brian's go.
- Customer-facing copy uses the approved partner spellings (HealthFirst, Direct Dental,
  GoTu), does not name HSPA, HSRA or NumbersIQ, and uses no em dashes or arrow
  characters.
- One ask per PR. A logic change comes with a test. New feature UI stays behind its flag.
- Push once per round of fixes, after the checks below pass locally. Add no CI job,
  matrix, schedule or paid runner without Brian.
- Claude merges its own PR, as a merge commit, once CI is green on the head and the Codex
  review of that same head is clean (no open P0 or P1). No separate yes from Brian is
  needed. If Brian says to hold a PR, hold it. Never approve a PR or turn on auto-merge.
- Ask Brian one question at a time, with a recommendation. Give times in Eastern time.

## Live changes

Brian, 11/21/2026 7:22 PM and 9:14 PM ET: Claude owns the field build and runs it on its
own. Brian is the last resort.

Claude does these itself, without asking, on field flows, lists and settings only:

- Power Automate: import packages, edit flows, Save, turn flows On or Off, run them.
- SharePoint: list and column changes on the field site, TEST rows and TEST saves.
- Vercel: environment settings for `hsbs-hsd-field`.
- GitHub: merges, under the merge rule above.

Claude asks Brian first, one question at a time, only for:

- Signing in, and any password. Brian signs in himself. Claude never types a password.
- The first email a new flow sends to a real partner or rep, and any new real recipient.
- Deleting data: list rows, lists, columns, flows or files.
- Anything PVA. Claude never reads, changes or reports on a PVA flow, list, email or
  receipt.

Safety rules that still hold for every live change:

- TEST before live. Prove a change on TEST people or TEST rows before it touches real
  ones.
- Back up first: export the flow package or Save As a copy, so the change can be undone.
- Secrets stay out of chat, the repo, logs and prompts. A signed flow URL moves from one
  flow or setting to another without being written down.
- Field and PVA stay separate: no shared flow, list or process.
- Record each live change (what, when in ET, how to undo it) in the PR, the build sheet or
  the thread's handoff file.

## Checks before a PR is ready

From the repo root, after `npm ci`:

    node scripts/scan-secrets.mjs --diff origin/main
    npm test
    npm run check
    npm run build
    npm run e2e

`npm run e2e` may be skipped for a docs-only PR (`docs/`, `.claude/`, top-level
Markdown). Right after opening a draft PR, post one comment, `@codex review`. CI
(`.github/workflows/ci.yml`) runs the secret scan, tests, type check and build on every
PR and push to `main`, and the browser tests on PRs that change more than docs.

## Verify the live result matches the intent

After CI is green, open the Vercel preview (not production) and check the changed screen
against the task and the contract. A green build does not prove the live flow or the
SharePoint row is right. Check the live result with TEST people or TEST rows only. Never
submit a live form with real data.
