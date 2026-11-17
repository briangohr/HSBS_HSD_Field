# Field two-track app: sheet LD, link delivery to roster-loaded people

> Moved from `briangohr/HSBS` on 11/17/2026. Read `docs/build/README.md` first: the field contract wins, and the other team's exact list and column names are only in the old repo's copy.

Builder: BB2. Written 11/15/2026 by Claude for BB2 and Brian.
Status: draft for Brian's approval. Step R4 in `docs/build/field-two-track-remaining-work.md`.

## Why

The roster load (sheet F5) creates 590 Rep Roster rows, each with a personal link, and sends
no email (F5, "What must not change"). So the 30 RGMs and 560 FSCs have links they have never
seen. F5 says a welcome or link email to loaded people is a later step that needs Brian's go.
This is that step.

## What it uses, and what it adds

- **It uses the paced welcome sender.** BB1's sheet 1 addendum v2.1
  (`/HSBS_BOT/build/2026-11-09_BB1_Build_Sheet_1_Addendum_Welcome_Sender_v2.1.md`) designs
  "HSBS 1J welcome sender". It reads Link Resends rows with Send Status Pending, oldest first,
  15 a minute, and sends each person their personal link. For Kind Welcome it reads the Rep
  Roster first, so a loaded person gets their new Rep Roster link, not an older link from the other team's roster or the FSC
  Roster. It also has the alarm flow and the gap check lines.
- **LD adds one small flow, "HSBS LD queue welcomes".** It creates the Pending rows on Link
  Resends for one team at a time. It sends nothing itself. The sender does the sending.
- **LD builds no second sender**, and changes nothing in 1J or the sender.

## Decisions Brian makes before LD is built

Claude asks these one at a time.

1. **The welcome words for loaded people, and the mailbox.** Decision 9 is open: do loaded
   people get their own welcome ("Brian set up your HSBS app") or the same welcome as `/join`?
   The rep app spec's open item 1 asks which mailbox sends (Brian's or an HSBS shared mailbox).
   The sender's 30-a-minute limit counts against whichever account's connection sends.
   Claude's recommendation: their own short welcome, from the same mailbox the field intros
   already use, so replies reach one place.
2. **The resend order for people on two rosters.** A loaded RGM still has an other-team roster row,
   and a pilot FSC still has an FSC Roster row (F5 leaves both in place). If one of them signs
   up at `/join`, 1J queues a Kind Resend, and the sender reads the other team's roster, then the FSC
   Roster, then the Rep Roster. They get their old link back. The choices:
   - A. Leave it. They use the welcome LD sends. A `/join` resend gives the old link until the
     old rows are retired (a later sheet, after Brian says the new app is staying).
   - B. The sender reads the Rep Roster first when the Rep Roster row's Source is
     `Brian's roster`. A change to BB1's sender, so BB1 is asked first.
   - Claude recommends A for launch week: it changes no live flow, and LD's welcome reaches
     everyone loaded.

## Rules for this sheet

1. TEST rows and TEST people only until Brian's go. While the sender's TestMode is on, every
   email goes to Brian only, whatever the row says.
2. Never paste a Referral Key or a link anywhere. A key appears only inside the email the
   sender sends.
3. LD reads the Rep Roster and the Team Roster and writes only Link Resends. It never writes
   any roster.
4. One team per run. Never queue more than one team, and never more than 200 rows at once
   (the sender's alarm line).
5. A welcome goes only to a person who is live (Test = No). A person still on test would open
   an app that sends TEST rows, which is not a real start.
6. Managers first, matching F5's going-live order: the RGM's welcome before their FSCs'.

## Before you build (each is pass or fail)

1. **R0 says the sender is built** and its tests 1 to 9 in addendum v2.1 passed. If not, stop.
2. **Link Resends has** Kind, Send Status, Send Tries and Send Note, and Email is set to
   enforce unique values. **Rep Roster has** Welcome Sent On.
3. **Brian has answered** both decisions above, and the welcome text is in the sender
   (approved by Brian before the first live send, per the rep app spec).
4. **The live sender is Off** while you test, and the Link Resends view filtered to Pending
   shows no real rows.

## Build: "HSBS LD queue welcomes"

1. **An instant cloud flow with the "Manually trigger a flow" trigger.** One text input:
   the RGM's Rep Email. No HTTP trigger, no email action, no Teams action.
2. **Find the team.**
   - Get items on the Rep Roster: Filter Query on the lowercased Rep Email equal to the input,
     Top Count 1. No row, or Role not `RM`, or Test not No: stop the run and write nothing.
   - Get items on the Team Roster: Active Yes and Manager Email equal to the input
     (lowercased). Pagination on.
3. **Build the list to check**, RGM first, then each team member. A person goes on to step 4
   only when every check passes:
   - Their Rep Roster row exists (Filter Query on the lowercased email, Top Count 1).
   - Status is not Disabled.
   - Test is No.
   - For a team member: the RGM's own Rep Roster row has Test = No (F5's order rule).

   Welcome Sent On is not used to decide. The sender also sets it when it sends a resend, and
   a resend to someone on two rosters carries their old link (decision 2 above).
4. **Apply to each over the list, concurrency 1.** For each person, Get items on Link Resends
   (Filter Query on the lowercased email, Top Count 1), then act on what it finds. Only a
   Welcome counts as delivery, because only a Welcome is sure to carry the Rep Roster link.

   | Link Resends row | Action | Log line |
   |---|---|---|
   | None | Create item: Email (lowercased), Kind Welcome, Send Status Pending, Send Tries 0, Send Note blank, Last Sent blank | `queued` |
   | Kind Welcome, Pending, Sending or Sent | Write nothing | `skipped,welcome already queued or sent` |
   | Kind Welcome, Failed | Write nothing. Brian reads the Send Note first, because "May have sent" means it may already have gone | `skipped,welcome failed: Brian checks` |
   | Kind Resend, Pending or Sending | Write nothing. Changing a row the sender may be about to send could race it | `skipped,resend in flight: run LD again later` |
   | Kind Resend, Sent or Failed | Update item: Kind Welcome, Send Status Pending, Send Tries 0, Send Note blank | `queued` |

   If Create item fails because the email exists (two runs at once), read the row and act on
   it by the table.
5. **Write a run note** to `/HSBS_BOT/build/LD_queue_log.csv`, one line per person:
   `<date>,<RGM email>,<person email>,queued` or `skipped,<reason>`. Emails only, never a key.
6. **Settings.**

   | Where | Setting | Value |
   |---|---|---|
   | Every Rep Roster and Team Roster read | Secure outputs | On |
   | Every SharePoint action | Retry policy | Exponential, Count 3 |
   | Apply to each | Concurrency | 1 (the default) |
   | The flow | Name | Starts with "HSBS" |

7. Keep the flow Off except while a check or a go-live sitting runs.

Learn rows this sheet relies on (`docs/claude-code/MS-LEARN-REFERENCES.md`): Manual trigger,
Apply to each concurrency, SharePoint Get items, Pagination limit, Secure inputs and outputs.

## How a team goes live with LD (part of R7)

In one sitting, after Brian's go for that team:

1. Brian runs F5's order check. It lists nobody.
2. Brian sets the RGM's Rep Roster row to Test = No.
3. Brian sets the team's FSCs to Test = No (all, or some).
4. Brian runs F5's order check again. It lists nobody.
5. BB2 runs "HSBS LD queue welcomes" with the RGM's email. Only people set live in steps 2
   and 3 are queued.
6. The live sender sends them at up to 15 a minute. A team of 20 takes about two minutes.
7. If the run note has any `resend in flight` line, BB2 runs LD again for the same team a few
   minutes later. The resend will have gone by then, and the person gets their Welcome.
8. The next day's gap check shows no welcome lines for that team. If it shows one, Brian
   follows addendum v2.1 step 9.

## TEST checks (each is pass or fail)

On TEST people only, with the sender's TestMode on, so every email reaches Brian only.

- **L1. One TEST team.** A TEST RGM and two TEST FSCs, all Test = No, paired on the Team
  Roster. Run LD with the RGM's email: three Link Resends rows, Kind Welcome, Pending. Within
  five minutes Brian gets three welcomes, and each row says Sent, with Welcome Sent On set on
  the Rep Roster.
- **L2. The right link.** The TEST RGM also has a TEST other-team roster row. Brian opens the RGM's
  welcome link: it opens the rep app (Send, Track, Earnings, Team), not the old field app. No
  key is read out or written down.
- **L3. Run twice.** Run LD again for the same team: no new rows, no row changed, no email.
- **L4. Skips.** Add a TEST FSC with Test = Yes, one with Status Disabled, and one whose Link
  Resends row is Kind Welcome, Sent. Run LD: none of the three is queued, the first two are
  not checked further, and the third has the line `skipped,welcome already queued or sent`.
- **L4a. A resend in flight.** Give a TEST FSC a Link Resends row Kind Resend, Pending, and
  turn the sender Off. Run LD: nothing changes, and the line reads `resend in flight`. Turn
  the sender On, let the resend go, and run LD again: the row becomes Kind Welcome, Pending,
  and Brian gets the welcome with the Rep Roster link.
- **L4b. An old resend.** Give a TEST FSC on two rosters a Link Resends row Kind Resend, Sent,
  with Welcome Sent On set. Run LD: the row becomes Kind Welcome, Pending, and the welcome
  goes.
- **L5. Managers first.** Set the TEST RGM back to Test = Yes and run LD: nothing is queued and
  the run stops. Put the RGM back to Test = No.
- **L6. Wrong input.** Run LD with a TEST FSC's email instead of an RGM's: nothing is queued.
- **L7. LD wrote only Link Resends.** In every LD run from L1 to L6, run history shows no
  Create item, Update item or Delete item on the other team's roster, FSC, Rep or Team Roster. Roster changes
  made by others during the checks are expected: the sender sets Welcome Sent On (L1), opening
  a link sets First Opened On and Status (L2), and Brian changes Test values (L5). No email
  went to anyone but Brian, the alarm flow sent nothing, and run history shows "Content not
  shown" on every roster read.

## Rollback

- Before the sender picks them up: set the team's Pending rows to Failed with Send Note
  "Held by Brian". The sender only reads Pending rows.
- After a send: an email cannot be recalled. Brian decides what to tell the person.
- The flow itself: turn it Off. It holds no data.

## What must not change

- HSBS 1J, the welcome sender and the alarm flow.
- The other team's roster and the FSC, Rep and Team Rosters. LD only reads them.
- Recipients. LD adds none, and the sender's TestMode stays on until Brian's go.
