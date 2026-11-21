# Lessons

What a plan missed, found by comparing it with what shipped. One line per miss: the miss, its
category, and the check that would have caught it. When a category shows up twice, it goes
into the design checklist in the thread-kickoff skill (section 3b), so the next plan catches it
before review.

## Partner update window (plan 11/19/2026, shipped 11/20/2026 as sheet PU)

Plan: `docs/plans/partner-update-window.md`. What shipped: `docs/build/field-partner-updates.md`
(sheet PU) and PRs 13, 14 and 15.

| Miss | Category | Check that catches it |
|---|---|---|
| The plan assumed field partners used the old partner page and the old 7C and 7D. The field lists moved to `sites/HSBSField` on 11/18, so those flows could not reach field cases, and field partners got an intro and nothing after it | Stale premise | Map status from the live system (site and list IDs, flow On or Off, row counts, last run), not from docs |
| The plan wrote decided rules (O8 filters, link reuse, shared Partner Links rows) on assumptions the trace later voided | Plan deeper than evidence | Unconfirmed items stay open questions until a trace confirms them |
| The plan covered page updates only. Direct Dental replies to the intro email, and those replies sat in Brian's inbox (now 7H) | Real behavior | Map where requests and updates actually arrive today |
| No guard against overlapping runs erasing each other's Status Log lines (Codex P1, PR 13) | Concurrency | Etag (If-Match) writes with a retry on conflict |
| A resent save could write twice, and a failed email could be marked done and never retried (Codex P1s, PRs 13 and 14) | Retries | A submission ID or log tag; mark work done only after the write or email succeeds |
| Case reads assumed a small list (Codex P1, PR 13) | Volume | Filter on the server and page past 5,000 items |
| A TEST run could mail a real partner or change a real case (Codex P1s, PR 13) | TEST isolation | A TEST-only switch, real rows that start inactive, TEST links that go to the preview |
| Miss-count writes changed Modified, which Track reads as the update date (Codex P1, PR 13) | Other readers | List every screen and flow that reads a field before writing to it |
| Due dates lived on the Referrals row, not the case, and moved referrals keep `HSBS-A` refs beside new `HSBS-F` refs (Codex P1, PR 13; live list read) | Data history | Check where each value is stored and every identifier format after a move |
| Misses counted once per day past due instead of once per missed window (Codex P1, PR 13) | Rules | Write each counting rule as a dated example, like T2a, before review |
| A save resent after midnight Eastern hit a date rule before the duplicate check (Codex P1, PR 14) | Time and order of checks | Run the duplicate check first; test a resend that crosses midnight |
| Power Automate refused a run limit on 7F, a Request trigger with Response actions | Platform limits | Confirm what the tool refuses before designing around it |
| The plan dated go-live Mon 11/23 for about 1.5 days of work; the build merged on 11/20 | Calendar padding | Date pieces in hours; cut checks that wait on calendar events |

Categories seen twice so far: Retries (PRs 13 and 14). Already in the checklist.
