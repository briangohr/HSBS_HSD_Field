# HSBS field app

The HSBS app for the field: AEs, FSCs and RGMs (the TSM app). People sign up at `/join`
and get a personal link, `/refer/<key>`, to send HealthFirst and Direct Dental referrals,
track them, and see their team.

- Rules for anyone building here: `CLAUDE.md`. Review rules: `AGENTS.md`.
- What the site sends to its two flows (HSBS 1J and HSBS 1F): `docs/field-flow-contract.md`.
- Everything answers 404 unless `REP_APP_ENABLED=true` in Vercel.

```bash
npm ci
npm test
npm run check
npm run build
npm run e2e
```
