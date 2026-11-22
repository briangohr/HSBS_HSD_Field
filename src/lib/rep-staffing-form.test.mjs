import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  PRACTICE_TYPES,
  STAFFING_CONSENT,
  STAFFING_STAR,
  staffingFlowPayload,
  staffingPayLine,
  staffingReceipt,
  staffingSendLabel,
  staffingTerms,
  validateStaffingReferral,
} from './rep-staffing-form.mjs';

const good = { contactName: 'TEST Contact', practiceName: 'TEST Practice', jde: '1234', officePhone: '555-0100', preferredContact: 'Call', practiceType: 'Group', permission: true };
const PLAN = { reachedPrivate: 100, reachedGroup: 200 };

describe('staffing form rules (field two-track spec, section 4)', () => {
  test('the two stored values and the words on the screen', () => {
    assert.deepEqual([...PRACTICE_TYPES], ['Private practice', 'Group']);
    assert.equal(STAFFING_CONSENT, 'The customer gave permission for Direct Dental to contact them about staffing.*');
    assert.equal(STAFFING_STAR, '* Direct Dental may void this referral if the customer did not give permission to be contacted about this service.');
  });

  test('a missing practice type or an unticked box blocks the send', () => {
    assert.equal(validateStaffingReferral(good).ok, true);
    for (const practiceType of [undefined, '', 'group', 'Group (3 or more locations)', 'Other']) {
      const r = validateStaffingReferral({ ...good, practiceType });
      assert.equal(r.ok, false);
      assert.equal(r.errors.some((e) => e.field === 'practiceType'), true);
    }
    const r = validateStaffingReferral({ ...good, permission: false });
    assert.equal(r.ok, false);
    assert.equal(r.errors.some((e) => e.field === 'permission'), true);
    assert.equal(validateStaffingReferral({ ...good, permission: 'yes' }).ok, false);
  });

  test('the button walks what is missing and ends in Send to Direct Dental', () => {
    assert.equal(staffingSendLabel(good), 'Send to Direct Dental');
    assert.equal(staffingSendLabel({ ...good, practiceType: '' }), 'Pick the practice type');
    assert.equal(staffingSendLabel({ ...good, permission: false }), "Check the customer's OK");
  });

  test('the body: needs Staffing, the saved consent is the words on the screen, practice type kept', () => {
    const b = staffingFlowPayload(good, { referralKey: 'k', submissionId: 's' });
    assert.deepEqual(b.needs, ['Staffing']);
    // The field app sends no other team's permission field.
    assert.equal('PVApermission' in b, false);
    assert.deepEqual(b.companies, ['HS Staffing / Recruiting Services (including GoTu)']);
    assert.equal(b.consentText, STAFFING_CONSENT);
    assert.equal(b.practiceType, 'Group');
    assert.equal(/OSHA|HIPAA|HealthFirst/.test(JSON.stringify(b)), false);
  });

  test('the receipt names Direct Dental, never HealthFirst; dollars only with a plan, by practice type', () => {
    const none = staffingReceipt({ contactName: 'TEST Contact', practiceType: 'Group', plan: null });
    assert.deepEqual(none, { title: 'Sent to Direct Dental', calls: "Direct Dental's team will call TEST Contact.", money: '' });
    const priv = staffingReceipt({ contactName: 'TEST Contact', practiceType: 'Private practice', plan: PLAN });
    const group = staffingReceipt({ contactName: 'TEST Contact', practiceType: 'Group', plan: PLAN });
    assert.equal(priv.money, "You'll earn $100 when Direct Dental reaches TEST Contact and confirms the lead qualifies.");
    assert.equal(group.money, "You'll earn $200 when Direct Dental reaches TEST Contact and confirms the lead qualifies.");
    for (const r of [none, priv, group]) assert.equal(/HealthFirst/.test(JSON.stringify(r)), false);
    // A plan that is not usable promises nothing.
    assert.equal(staffingReceipt({ contactName: 'x', practiceType: 'Group', plan: { reachedPrivate: 0, reachedGroup: 0 } }).money, '');
    assert.equal(staffingReceipt({ contactName: 'x', practiceType: 'other', plan: PLAN }).money, '');
  });

  test('the staffing terms mark: empty with no plan, else the two amounts', () => {
    assert.equal(staffingTerms(null), '');
    assert.equal(staffingTerms({ reachedPrivate: 0, reachedGroup: 5 }), '');
    assert.equal(staffingTerms(PLAN), '100,200');
    assert.equal(staffingTerms({ ...PLAN, manager: 50 }), '100,200');
  });

  test('the pay line is worded from the plan, and empty with none', () => {
    assert.equal(
      staffingPayLine(PLAN),
      'You earn $100 for a private practice, or $200 for a group with 3 or more locations, when Direct Dental reaches the customer and confirms the lead qualifies.',
    );
    assert.equal(staffingPayLine(null), '');
  });

  test('a flat plan names one amount and no practice type (pay sheet R11)', () => {
    assert.equal(
      staffingPayLine({ reachedPrivate: 100, reachedGroup: 100 }),
      'You earn $100 when Direct Dental reaches the customer and confirms the lead qualifies.',
    );
  });
});
