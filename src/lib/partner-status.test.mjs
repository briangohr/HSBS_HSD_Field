import assert from 'node:assert/strict';
import test from 'node:test';
import { decorateReferrals } from './track.mjs';
import { STAND_WORDS, choiceGroupsFor, displayStatus, isHandedBackStatus, isQualifiedStatus } from './partner-status-words.mjs';

test('status words are the same stored values everywhere, and old values still display', () => {
  assert.deepEqual(STAND_WORDS, [
    'Meeting set',
    'Proposal or agreement sent',
    'Signed',
    'Not moving forward',
    'Hand back to HSBS',
    'No change this week',
  ]);
  for (const word of STAND_WORDS) assert.equal(displayStatus(word), word);
  assert.equal(displayStatus('Complete'), 'Meeting held');
  assert.equal(displayStatus('Scheduled'), 'Meeting set');
  assert.equal(displayStatus('Handed back to HSBS'), 'Hand back to HSBS');
  assert.equal(displayStatus('Returned to HSBS'), 'Hand back to HSBS');
  assert.equal(displayStatus('Hand back to HSBS'), 'Hand back to HSBS');
  assert.equal(displayStatus('Reached'), 'Reached the doctor');
  assert.equal(displayStatus('Return to HSBS'), 'Return to HSBS');

  const view = decorateReferrals(
    [
      {
        id: 'c',
        doctorName: 'Complete Case',
        practiceName: 'Old Dental',
        sentOn: '2026-11-01',
        route: 'Partner',
        lines: [{ company: 'Unitas', status: 'Complete', detail: 'Met', updatedOn: '2026-11-02' }],
        history: [{ on: '2026-11-02', text: 'Unitas: Handed back to HSBS' }],
      },
      {
        id: 'h',
        doctorName: 'Handed Case',
        practiceName: 'Old Dental',
        sentOn: '2026-10-01',
        route: 'Partner',
        lines: [{ company: 'WeCare', status: 'Returned to HSBS', detail: '', updatedOn: '2026-10-02' }],
        history: [],
      },
    ],
    '2026-11-03',
  );
  assert.equal(view.referrals[0].lines[0].status, 'Meeting held');
  assert.equal(view.referrals[0].bucket, 'inProgress');
  assert.equal(view.referrals[0].history[0].label, 'Nov 2. Unitas: Hand back to HSBS');
  assert.equal(view.referrals[1].lines[0].status, 'Hand back to HSBS');
  assert.equal(view.referrals[1].bucket, 'closed');
  assert.equal(isHandedBackStatus('Returned to HSBS'), true);
  assert.equal(isHandedBackStatus('Hand back to HSBS'), true);
  assert.equal(isHandedBackStatus('Return to HSBS'), false);

});

test('once qualified, the Qualifying group is frozen and only the later steps are offered', () => {
  const codes = (status) => choiceGroupsFor(status).flatMap((g) => g.choices.map((c) => c.code));
  // No change is not in either group: the page shows it as its own check-in box.
  const all = ['qualified', 'trying', 'dq_noanswer', 'meeting', 'proposal', 'signed', 'lost'];
  for (const open of ['', 'Trying to reach', 'Sent']) {
    assert.equal(isQualifiedStatus(open), false, open);
    assert.deepEqual(codes(open), all, open);
    assert.ok(choiceGroupsFor(open).every((g) => g.done === ''), open);
  }
  for (const qualified of ['Reached', 'Meeting set', 'Scheduled', 'Complete', 'Proposal or agreement sent', 'Signed']) {
    assert.equal(isQualifiedStatus(qualified), true, qualified);
    assert.deepEqual(codes(qualified), ['meeting', 'proposal', 'signed', 'lost'], qualified);
    assert.deepEqual(choiceGroupsFor(qualified).map((g) => g.done), ['Reached the customer', ''], qualified);
  }
});
