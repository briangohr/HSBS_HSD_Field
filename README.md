# HSBS field app

The HSBS app for the field: AEs, FSCs and RGMs (the TSM app). People sign up at `/join`
and get a personal link, `/refer/<key>`, to send HealthFirst referrals (and Direct Dental
when `REP_APP_COMPANIES` names `Staffing`), track them, and see their team. Field partners
update their leads at `/update/<key>`, off unless `PARTNER_PAGE_ENABLED=true`.

- Rules for anyone building here: `CLAUDE.md`. Review rules: `AGENTS.md`.
- What the site sends to its three flows (HSBS 1J, HSBS 1F and HSBS 7F): `docs/field-flow-contract.md`.
- Everything answers 404 unless `REP_APP_ENABLED=true` in Vercel, except `/j`, which
  always redirects to `/join?src=qr`.

```bash
npm ci
npm test
npm run check
npm run build
npm run e2e
```
