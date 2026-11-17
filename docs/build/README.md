# Field build sheets

The flow-side build sheets for the field app (1F, 1J, the 3F, 7A and 7B Field copies, the
roster load, link delivery, pay and the gap check). Moved here from `briangohr/HSBS` on
11/17/2026 so the field build no longer depends on the old repo (Brian, 11/17: "this needs to
be in the HSBS-HSD-Field repo").

How to read them:

- `docs/field-flow-contract.md` is the site side and wins over anything here. When a sheet
  and the contract disagree, stop and ask Brian.
- The field repo carries no text about the other team (Brian, 11/17: anything that
  mentions it stays on its own SharePoint site and in its own repo, `briangohr/HSBS`).
  Where a step still reads or writes one of that team's lists, columns or values, it says
  so in plain words ("the other team's roster", "the shared update column", "the shared
  site"). The exact names are in the old repo's copy of the same sheet. Each one is a shared
  touchpoint: a defect to remove, not a feature to keep (`CLAUDE.md`, Scope).
- Today the field lists (Rep Roster, Team Roster, Referrals, Service Cases) sit on that
  shared SharePoint site. Moving them to a field-only site is a live change for Brian.
- Paths such as `src/...`, `AGENTS.md` rule numbers, and `docs/...` files that are not in
  `docs/build/` refer to the old repo, `briangohr/HSBS`.
- Env names: on this site the 1F address is `FIELD_FLOW_URL` and the 1J address is
  `REGISTER_FLOW_URL` (`docs/field-flow-contract.md`, Environment). A sheet step that sets
  `REFERRAL_FLOW_URL` was written for the old site and does not apply here.
- Sheets written for HSBS 1R describe the setup before the field app moved to its own flow,
  HSBS 1F. Read them as history where 1F has replaced a step.
- The /rgm field pages and the pilot FSC app named in these sheets are being retired after
  the cutover (Brian, 11/17). They are not part of this repo.

| Sheet | File |
|---|---|
| Spec: team members and managers (v1) | `field-two-track-spec.md` |
| HealthFirst rep app spec (v3) | `healthfirst-rep-app-spec.md` |
| Rep app flow contracts (1J, 1R era) | `rep-app-flow-contracts.md` |
| F1, F2, F6 flow build sheets | `field-two-track-flow-contracts.md` |
| 1F, the field app flow | `field-two-track-1f-flow.md` |
| F3, staffing intro | `field-two-track-staffing-intro.md` |
| 3F-F, the 3F Field copy | `field-two-track-3f-field-copy.md` |
| F4, pay and ledger | `field-two-track-pay-sheet.md` |
| F5, roster load | `field-two-track-roster-load.md` |
| F7, send on | `field-two-track-send-on.md` |
| SR, sender role | `field-two-track-sender-role.md` |
| DV, deal value and stages | `field-two-track-deal-value-stages.md` |
| LD, link delivery | `field-two-track-link-delivery.md` |
| GC, gap check | `field-two-track-gap-check.md` |
| Go-live runbook | `field-two-track-go-live.md` |
| What remains after launch | `field-two-track-remaining-work.md` |
