# Partner update window: 2 business days (field leads)

Status: draft for Brian's OK, 11/19/2026, revised the same day after review. Field build
only. Nothing on the PVA side changes except the two filters in O8, if Brian approves them.
Start: Mon 11/23/2026. If T2 has not passed by Fri 11/20 at 3:00 PM ET, the start moves to
the second business day after it passes. No date is promised to partners before T2 passes.

## Schedule (Eastern)

| When | What | Who |
|---|---|---|
| Thu 11/19, by 1:00 PM | Open decisions answered in one sitting | Brian |
| Thu 11/19, by 3:00 PM | Piece 1 trace. Read 7C's lead query and its 11/13 run; do not wait for Friday's run | BB2 |
| Thu 11/19, by 6:00 PM | Piece 2 build sheet as a draft PR. BB2 may build from the branch before merge | Claude Code |
| Fri 11/20, by noon | Piece 3 on TEST copies | BB2 |
| Fri 11/20, by 3:00 PM | T2 passes. Brian approves the merge and sends the partner note | Brian |
| Mon 11/23, 8:00 AM | First field daily email (piece 6) | Brian, with BB2 |

## Goal

Field partners update each lead within 2 business days of being asked, and reps see the
update in Track without anyone chasing it. Runs at least through 12/31/2026.

## Decided

- Brian, 11/19: each open field lead carries its own due date, 2 business days out. A daily
  weekday check emails each field partner only the leads that are due or overdue. Nothing
  due, no email.
- For field cases only, this replaces the line "Next Update Due, 7C (Friday) and 7D
  (overdue) rules" in "What must not change" in `docs/build/field-two-track-deal-value-stages.md`.
- O1, Brian, 11/19: two emails. A partner with PVA and field leads gets the field daily
  email on its own, labeled as field. Decide again if trace question 2 shows a shared key.
- O2, Brian, 11/19: keep 2 business days after 12/31. No review date is set.
- O3, Brian, 11/19: Brian is not copied on the field daily emails. He gets only the
  2-missed-updates escalation.
- O4, Brian, 11/19: escalate to Brian at 2 missed updates, about 4 business days.
- O5, Brian, 11/19: Track keeps the 7-day stale line. Piece 4 is skipped unless reps ask.
- O6, Brian, 11/19: holiday list through 1/31/2027 is Thu 11/26/2026, Fri 11/27/2026,
  Thu 12/24/2026, Fri 12/25/2026, Fri 1/1/2027 and Mon 1/18/2027. Not checked against the
  Henry Schein list; Brian can add or drop a date later.
- O7, Brian, 11/19: on go-live day, every open field lead's due date is set to the go-live
  date (Mon 11/23 if the start holds), so each partner gets one full list, then the 2-day
  rhythm.
- O8, Brian, 11/19: yes. If trace questions 1 or 4 show 7C or 7D touching field leads, each
  gets one filter so it skips them, with its rollback recorded first and its owner told.
  Brian makes the live change. The 7D filter goes in before the first field daily email;
  the 7C filter may follow go-live by up to a week.

## How it works

1. A business day is Monday to Friday, Eastern date, minus the dates on the holiday list.
2. Next Update Due:
   - New field lead: 2 business days after the intro (3F field copy).
   - Partner save that leaves the lead open: 2 business days after the save (7B field copy).
   - Meeting set: 1 business day after the meeting date.
   - Signed, Not moving forward, Hand back: cleared, as today.
   - A standalone qualify save leaves it alone, as today (F2.9 rule 2).
3. The field daily email runs weekdays at 8:00 AM ET and skips holidays. One run does two
   steps, in this order:
   - a. Count misses. Each open field lead whose due date is before today gets one more
     Missed Update, and its due date moves to 2 business days after today. Today's 7D does
     this with 7 days.
   - b. Build the lists. For each field partner: the open field leads with Missed Updates
     above 0, or a due date of today or earlier, overdue first. One email per partner with
     the update page link. Nothing listed: no email.
   The list reads Missed Updates, not only the due date, because step a has already moved an
   overdue lead's due date into the future. A rule on the due date alone would never list an
   overdue lead. Both steps sit in one flow, so no two flows depend on running in order.
4. After go-live, today's 7C sends no field leads and today's 7D does not touch field cases.
   Trace questions 1 and 4 say whether they do today. If they do, O8 decides the fix.
5. The window length is one setting (2), not a number typed into each flow.
6. The daily email reuses the partner's current link key. A key is replaced only when fewer
   than 3 days remain before it expires. Test: yesterday's link still opens.
7. No field flow changes a key a PVA-side flow uses, and the reverse. Trace question 2 says
   whether that is true today.

## Today's rules (so no session has to open the old repo)

Read 11/19 from `briangohr/hsbs`: `docs/partner-status-flow.md`, `docs/fsc-flow-contracts.md`.

- 7B save: Missed Updates = 0. Next Update Due = meeting date + 1 day for Meeting set;
  cleared for Signed, Not moving forward and Hand back; otherwise save date + 7 days.
- 7C: Fridays 8:00 AM ET. For each active Partner Links row: a new 40-character Link Key
  that expires in 14 days, then one email with the open leads and a link to `/leads/<key>`.
  To the partner, CC the CC Email and Brian. Skipped when there are no open leads.
- 7D: weekdays 7:00 AM ET. Open, non-Test items past Next Update Due: Missed Updates goes up
  once per due date and the due date moves out 7 days. Mondays: one nudge per partner. At 2
  missed updates, Brian gets an email.
- Site: Track shows "No update in N days" after 7 calendar days (`staleText` in
  `src/lib/track.mjs`). 1F sends no due date, so the site cannot see one
  (`docs/field-flow-contract.md`).
- 3F: stamps Next Update Due on the intro. The value is trace question 3.

## Done tests

**T1, the loop.** Done when a TEST field partner gets the email listing a TEST field lead,
opens its link, saves "Meeting set", and that status shows on the Service Case, on the TEST
rep's Track tab and on the Power BI Field Board after its next refresh. No mail goes anywhere
but the TEST inbox and Brian.

**T2, the window.** On TEST, in one sitting:
- a. The due date step gives: saved Mon 11/30, due Wed 12/2. Saved Fri 12/4, due Tue 12/8.
  Saved Wed 11/25, due Tue 12/1, with 11/26 and 11/27 on the holiday list.
- b. A manual run emails the TEST partner only the TEST leads due today or overdue, overdue
  first.
- c. A TEST partner with nothing due gets no email.
- d. The link from the previous run still opens the page.
- e. No mail goes anywhere but the TEST inbox and Brian.
- f. A TEST lead whose due date was yesterday is listed today, first, with Missed Updates 1.
  If it is still unsaved, it is listed again on the next business day.

## Pieces

| # | Piece | Who | Done when | Budget |
|---|---|---|---|---|
| 1 | Trace today's loop. Read only | BB2 | The trace table below is filled in with evidence (run IDs, row IDs, screenshots) | 2 to 5M |
| 2 | Build sheet for the flow changes | Claude Code, one docs PR | `docs/build/field-update-window.md` gives each flow's change, TEST check and rollback, written from the trace. Codex finds no P0 or P1 | 3 to 6M |
| 3 | Flow changes on TEST copies, plus the O8 filters if approved | BB2, from the sheet | T2 passes | 8 to 16M |
| 4 | Track's stale line (optional, per O5) | Claude Code, one code PR | Only if O5 says change it | 0 to 3M |
| 5 | Partner note | Claude drafts, Brian sends | A two-line note to each field partner, sent after T2 passes. The first daily email also carries one line explaining the new rhythm | under 0.5M |
| 6 | Go live, Mon 11/23 | Brian, with BB2 | T1 and T2 b to f pass on production with TEST rows. Friday's 7C still goes out for PVA leads and lists no field lead (or O8 is scheduled) | 1 to 3M |

Pieces run in order, on the schedule above. The O8 filter on 7C may follow go-live by up to a
week: until then a field partner may also get Friday's list, which is noise, not harm. The
O8 filter on 7D may not wait: if 7D touches field cases, it would push their due dates out 7
days and double count misses, so it goes in before the first field daily email.

## Trace table (piece 1)

| Step | Check on a TEST field lead | Pass or fail | Evidence |
|---|---|---|---|
| 1 | Friday's 7C email lists the lead with a working link | | |
| 2 | The page shows the lead (field 7A copy) | | |
| 3 | A save writes Partner Status, Last Partner Update and Next Update Due on the Service Case | | |
| 4 | Track shows the new status | | |
| 5 | The Power BI Field Board shows it after refresh | | |
| 6 | 7D's run history shows it handled a past-due field case (read only; "not seen" is an answer) | | |

Trace questions:
1. Does today's 7C email include field leads, and for which partners?
2. Which Partner Links rows do field partners use? Does any PVA-side flow replace those keys?
3. What does the 3F field copy set Next Update Due to?
4. Does today's 7D touch field cases?

## Open decisions (ask Brian one at a time, before the piece that needs it)

| # | Question | Recommendation | Before |
|---|---|---|---|
| O1 | A partner with PVA and field leads: one email or two? | Two, the field one labeled. Decide again if trace question 2 shows a shared key | Piece 2 |
| O2 | After 12/31: keep 2 business days or go back to 7 days? | Decide in the week of 12/28 from the on-time rate. It's one setting either way | Piece 6 |
| O3 | Copy Brian on every daily email? | No. Brian gets the 2-missed-updates email only | Piece 2 |
| O4 | Still escalate at 2 missed updates (now 4 business days)? | Yes | Piece 2 |
| O5 | When does Track flag a lead as stale? | Keep 7 days for now. Using the due date means a 1F and contract change. Skip piece 4 unless reps ask | Piece 4 |
| O6 | Holiday dates through 1/31/2027 | Brian gives the Henry Schein list | Piece 3 |
| O7 | Open field leads on go-live day | Set each one's due date to the go-live date, so every partner gets one full list, then the 2-day rhythm | Piece 3 |
| O8 | If trace questions 1 or 4 show 7C or 7D touching field leads: add one filter to each so it skips them? | Yes. They are PVA-side flows, so each needs your OK and its owner, with a rollback recorded first. Without it, field partners get two lists on Fridays and field leads get counted twice | Piece 2 |

## Out of scope

- The redesigned status email to reps and PVAs (BB3's build, `briangohr/hsbs`
  `docs/partner-status-email-design.md`).
- Deal value in the partner email. The qualify question stays off.
- Any PVA-side flow, list or page, other than the O8 filters once approved. If a step needs
  one, stop and ask Brian.
- A Power BI measure for the on-time rate. Count it by hand weekly until a later piece.

## Rules for every session on this plan

- Read `CLAUDE.md`, then only this file. Open a `docs/build/` sheet only at a section this
  plan names.
- One piece per session. Its row in Pieces is the task and its done test.
- Found more work? Add it under Later at the bottom of this file. Don't do it.
- If the piece grows past its row, or Brian calls the budget, stop and write
  `docs/plans/HANDOFF.md`: piece, done test, what passed, what is left, files and flows
  touched, next step. The next session starts from that file.
- Hand back the evidence the done test names. Done without evidence is not done.

## Session openers

Piece 1:

```
Read CLAUDE.md, then docs/plans/partner-update-window.md. Do piece 1 only.
Read only: change no flow, list, row or setting.
Done when the trace table and the four trace questions are filled in with evidence.
Hand back the filled table as a desk report. Write no key or link into it.
```

Piece 2:

```
Read CLAUDE.md, then docs/plans/partner-update-window.md, then the piece 1 desk report.
Do piece 2 only: write docs/build/field-update-window.md.
For each flow (the 3F and 7B field copies, the field daily email, and the O8 filters
if approved): the change, its TEST check, its rollback. Follow "How it works" and the
decided open questions.
Ask Brian any still-open question needed for piece 2, one at a time, with a recommendation.
Done when every flow is covered and each T2 line maps to a check. Open one docs PR.
```

## Later

(nothing yet)
