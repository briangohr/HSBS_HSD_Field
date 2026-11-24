# RT: rep thank-you mails and the sharp partner intro (live 11/24/2026, WinEmailOn No)

Brian, 11/24/2026 3:15 to 3:46 PM ET: a rep who refers a lead gets a thank-you mail when the lead qualifies
and again when it signs, and the intro the partner gets uses the same sharper layout. Mockup approved:
"Looks great. Let's do it."

No site change. The site never calls these flows, and no request or answer in
`docs/field-flow-contract.md` changes. Flows touched: HSBS 10 (writes the mail rows), HSBS 7N (sends
them) and the HSBS 3F Field copy (the intro body). Field only.

Status: built and tested offline. Nothing is live, no mail went to anyone. The live steps are at the end.

## What a rep gets

| Stage | Trigger | Subject | Amount shown |
|---|---|---|---|
| Qualified | HSBS 10 sees Qualified Yes and a rep amount of 1 or more | `Good news, Dr. <name> qualified with <Company>` | The Reached amount (Ledger Settings, or the Group amount) |
| Signed | HSBS 10 sees a signed case that paid or would pay | `Congratulations, Dr. <name> signed with <Company>` | The rep Signed amount. Zero today, so the pay row is left out and the thank-you still goes |

- `<name>` is the Referrals Customer Name. `Dr.` is added unless the name already starts with `Dr `
  or `Dr.`. A blank name falls back to the practice name. Open point for Brian: the form also takes
  office managers, so this can print "Dr." before a manager's name.
- `<Company>` is HealthFirst or Direct Dental. Direct Dental adds "for staffing".
- The body names the practice, the account number (JDE, left out when blank), the stage and its date, and
  "Payout for this stage" with the amount and Awaiting payment. A promo name adds "Part of <name>." to
  that row. It carries the Henry Schein Business Solutions logo, no app key and no link. The amount is
  read from the ledger amounts at run time, so a promo or a future commission changes Ledger Settings
  only. The sign-off is Henry Schein Business Solutions.
- Every value from a list is HTML-encoded. The subject is one plain line.
- The logo is `public/logos/hsbs-email-logo.png`, served at
  `https://hsbs-hsd-field.vercel.app/logos/hsbs-email-logo.png` once this PR is on production. Outlook may
  ask a recipient to download pictures. The alt text names the company until they do.

## How HSBS 10 makes the mail

- After the pay rules and the Result, so a mail problem never blocks a ledger row. A failed mail write
  fails the run (error row, as for any step) and the next save of the case makes the mail.
- One Field Notify Outbox row per stage: NotifyKind `Rep thanks`, Title `thanks|<Award Key>` (for example
  `thanks|42|Reached|Rep`), State Pending, Expires in 7 days, LastWriter stamped. HSBS 10 looks the Title up
  first, so a rerun or a second save makes no second mail.
- Eligible: not blocked, not No pay, Qualified Yes, the stage amount at least 1 (Qualified) or the case
  signed (Signed), and the rep's Reached row not Void.
- TEST case (the same Is_test_case rule the ledger uses): always makes its row, To Brian only, Test Yes,
  subject starts `[TEST] `. Needs no setting.
- Real case: needs Ledger Settings `WinEmailOn` Yes and the lead qualified (row created) or signed on or after
  `WinEmailFrom`. A blank `WinEmailFrom` means no real mail. An older row from before `WinEmailFrom` never
  gets a mail on a later save. To the rep, Cc Brian, Test No.
- New Ledger Settings columns on the `Live` row: `WinEmailOn` (Yes/No, No), `WinEmailFrom` (date and time),
  `PromoName` (text, blank for no promo line). The setup flow also creates them on a fresh site.
- New Outbox choice: NotifyKind gets `Rep thanks` (SharePoint refuses a value not on the list).

## How HSBS 7N sends it (version 6)

- A real row of kind `Rep thanks` may mail the one address it names when that address is on the Rep Roster
  and is not a Test row, has no `test` in it, and the Cc is empty or on `Real_to` (Brian). Any other kind,
  any TEST row and any second address stays under the old rule: To must be on `Real_to`.
- Send-time switch: before it sends a real `Rep thanks` row, 7N reads Ledger Settings `Live` and sends only when
  exactly one Live row has `WinEmailOn` Yes. While it says No, or the row is missing, the row waits Pending
  (not parked, no tries used) and goes Expired after its 7 days. Turning the switch back on sends what is
  still queued. TEST rows to Brian and every other kind of mail ignore the switch.
- A failed Rep Roster or Ledger Settings read leaves the row Pending and flags the run, so nothing sends by mistake.
- 7N still writes no content. It sends the stored To, Cc, Subject and Body. The 11/22 writer stamp on the
  Outbox writes is kept (the generator now applies it, same 7 steps as live).
- Turning this on is the new real recipient decision: Brian's written OK is needed before `WinEmailOn`
  goes to Yes. Importing 7N and HSBS 10 with `WinEmailOn` No sends nothing real.

## The sharp partner intro (HSBS 3F Field copy)

- Same facts as today's intro in a new layout: logo header, practice name as the headline, the rep and role,
  an optional call-first banner, a Doctor and practice block (doctor, account number large, phone, preferred
  contact, email, state, doctor OK), a notes box, the same ask and sign-off. The subject adds the account
  number: `New <Partner> referral: <Practice> (JDE <jde>)`.
- The body is two Composes, `Intro_a` and `Intro_b`, because one expression is capped at 8192 characters.
  The send action reads `concat(outputs('Intro_a'), outputs('Intro_b'))`.
- The expressions read the live 3F column names. Both live `Send_intro` actions were read from fresh exports on
  11/24 and the generator has one source table each: HealthFirst (greeting `Hello HealthFirst team`, State row)
  and Staffing (greeting `Hi <routed contact>`, no State row, routed address in the TEST banner). Kept from
  the old mail: the Unitas "PPO fees AND HSRA" note line and the `NOT SENT, forward manually: ` subject prefix.

## Tests (offline, all pass)

- Mail shell: 44 checks (subjects, amounts, $0 stage, promo line, blank JDE, Direct Dental wording, HTML
  encoding, balanced markup, intro banners, no em dash or arrow, no HSPA, HSRA or NumbersIQ).
- HSBS 10: 129 of 129 (the earlier 108 plus 21 for these mails: TEST and real, WinEmailOn and WinEmailFrom,
  older rows, void and repeat office, Direct Dental, the Group amount, a signed amount above 0, hostile
  values, and a mail failure that never blocks the ledger row). 10D 49 of 49.
- HSBS 7N: 73 of 73 (18 new: real rep, not on the roster, Test rep, other kinds, bad Cc, two addresses,
  TEST row, read failure, and the send-time switch held, released, missing, expired, TEST and other mail).
- Flow lint: 0 problems in both. Generators and tests live in the project files under `win-email/build` and
  `partner-updates/build`, not in this repo.

## Live steps (TEST first, `WinEmailOn` stays No)

1. Back up: export HSBS 10, HSBS 7N and the 3F Field copy (saved rollbacks are in the project files).
2. Add the three Ledger Settings columns and the `Rep thanks` Outbox choice. Leave `WinEmailOn` No.
3. Import HSBS 10 and HSBS 7N as Update (both arrive Off, turn On). Re-check the 10S address is kept.
4. TEST proof, TEST people only, mail to Brian only: a HealthFirst qualify, a Direct Dental Group qualify and
   a sign each make one `[TEST]` mail with the right stage and amount. Save twice and see no second mail.
5. Read the Field copy's `Send_intro`, apply the intro, send one TEST intro to Brian, compare with the mockup.
6. Brian's go (written), then set `WinEmailFrom` to that moment and `WinEmailOn` to Yes.

## Live record (11/24/2026, ET)

- 4:00 PM SharePoint: Ledger Settings `WinEmailOn` (No), `WinEmailFrom`, `PromoName`; Outbox choice `Rep thanks`.
- 4:11 PM HSBS 10 imported as Update (On 4:12 PM). 4:17 PM HSBS 7N imported as Update (On 4:18 PM).
- TEST proof, all mail to Brian only, `WinEmailOn` No: HealthFirst qualify, a second save with no second row,
  signed, and a Direct Dental Group qualify each made one `[TEST]` mail with the right stage and amount.
- 4:43 PM HSBS 3F Staffing (new site) and 4:47 PM HSBS 3F HealthFirst (new site) imported as Update (On 4:44 and
  about 4:48 PM). Change: new Composes `Intro_a` and `Intro_b`, `Intro_body` joins them, `Send_intro` Subject
  replaced. TEST referrals 706 and 707 each made one `[TEST]` intro to Brian only at 4:49 PM.
- Undo for the intro: delete `Intro_a` and `Intro_b`, restore the old `Intro_body` and Subject text (saved with
  an exact hash in the project files under `win-email/intro/rollback`), or import an export taken before.
- Not proven live yet: a real-looking case with `WinEmailOn` No (offline tests cover it; the next real qualify
  shows a ledger row and no thanks row).

## Undo

- Quick: `WinEmailOn` No. New rows stop at once and 7N holds every queued real rep row (the send-time switch above),
  so no real rep mail goes out. Queued rows can also be set to Cleared.
- Full: import the saved HSBS 10 and 7N packages as Update. The Outbox rows stay as a record.

## Not built yet

- Partner copy (an amount-free mail to the partner) and a manager copy of the signed mail. Brian has not
  answered the partner copy question.
- An in-app Signed banner and payout field on Track (separate flagged PR).
