// Lean rebuild U1: the intro mail. Same fields as 3F, every value escaped. TEST data only.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildIntroMail, esc } from './intro-mail.mjs';
import { readReferral, readRoute } from './intro-plan.mjs';

const SETTINGS = {
  mailOwner: 'owner@example.invalid',
  introCc: 'cc@example.invalid',
  replyTo: 'reply@example.invalid',
  signatureEmail: 'sign@example.invalid',
};
const referral = (over = {}) =>
  readReferral(90, {
    Title: 'HSBS-F90',
    PracticeName: 'TEST North Side Dental',
    Referring_x0020_Rep: 'Test Rep',
    Referring_x0020_Rep_x0020_Email: 'rep@example.invalid',
    CustomerName: 'Dr. TEST',
    JDEAccount: '12345',
    Doctor_x0020_Cell: '555-0100',
    CustomerPhone: '555-0199',
    Preferred_x0020_Contact: 'Phone',
    CustomerEmail: 'dr@example.invalid',
    State: 'NY',
    PVApermission: true,
    Note: 'Line one\nLine two',
    Test: false,
    ...over,
  });
const HF = readRoute({ Title: 'HealthFirst', Primaryemail: 'hf@example.invalid', Verified: true, Greeting: 'Hello HealthFirst team', ShowState: true });
const STAFF = readRoute({ Title: 'Staffing', Primaryemail: 'staff@example.invalid', Primaryname: 'Pat', Verified: true });
const NONE = readRoute({ Title: 'Co', Primaryemail: '', Verified: false });
const build = (over = {}) => buildIntroMail({ referral: referral(), service: 'HealthFirst', route: HF, settings: SETTINGS, ...over });

describe('recipients and subject', () => {
  test('a real routable row goes to the partner, CC the rep and the intro CC, reply-to from settings', () => {
    const m = build();
    assert.deepEqual(m.to, ['hf@example.invalid']);
    assert.deepEqual(m.cc, ['rep@example.invalid', 'cc@example.invalid']);
    assert.equal(m.replyTo, 'reply@example.invalid');
    assert.equal(m.subject, 'New HealthFirst referral: TEST North Side Dental (JDE 12345)');
  });

  test('a TEST row goes only to the mail owner, no CC, with the TEST subject and banner', () => {
    const m = build({ referral: referral({ Test: true }) });
    assert.deepEqual(m.to, ['owner@example.invalid']);
    assert.deepEqual(m.cc, []);
    assert.ok(m.subject.startsWith('[TEST] New HealthFirst referral'));
    assert.ok(m.html.includes('[TEST MODE] Production To would be: hf@example.invalid'));
    assert.ok(m.html.includes('Production CC would be: rep@example.invalid; cc@example.invalid'));
  });

  test('a row with no verified Routing email goes to the mail owner as NOT SENT, forward manually', () => {
    const m = build({ route: NONE, service: 'Co' });
    assert.deepEqual(m.to, ['owner@example.invalid']);
    assert.ok(m.subject.startsWith('NOT SENT, forward manually: New Co referral'));
    assert.ok(m.html.includes('Not sent to the partner.'));
  });

  test('the subject is one line and has no JDE part when the account is blank', () => {
    const m = build({ referral: referral({ PracticeName: 'A\r\nB', JDEAccount: '  ' }) });
    assert.equal(m.subject, 'New HealthFirst referral: A B');
  });

  test('a rep CC of nobody leaves no empty address', () => {
    const m = build({ referral: referral({ Referring_x0020_Rep_x0020_Email: '' }), settings: { ...SETTINGS, introCc: '' } });
    assert.deepEqual(m.cc, []);
  });
});

describe('body', () => {
  test('carries every field 3F carries, in order', () => {
    const { html } = build();
    const order = ['New referral for HealthFirst', 'TEST North Side Dental', 'Referred by', 'Reference HSBS-F90', 'Hello HealthFirst team', 'Doctor', 'Dr. TEST', 'Account number (JDE)', '12345', 'Best phone', '555-0100', 'Preferred contact', 'Phone', 'Email', 'dr@example.invalid', 'State', 'NY', 'Doctor OK to be contacted', 'Yes', 'Needs and notes', 'Line one<br>Line two', 'Please reach the doctor by the next business day.', 'sign@example.invalid'];
    let at = -1;
    for (const piece of order) {
      const next = html.indexOf(piece, at + 1);
      assert.ok(next > at, `${piece} comes after the one before it`);
      at = next;
    }
  });

  test('every value is escaped', () => {
    const { html } = build({ referral: referral({ PracticeName: '<script>x</script>', Note: 'a & <b>', CustomerName: '"Q" <i>' }) });
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;script&gt;x&lt;/script&gt;'));
    assert.ok(html.includes('a &amp; &lt;b&gt;'));
    assert.equal(esc(undefined), '');
  });

  test('blank values read as 3F does', () => {
    const { html } = build({ referral: referral({ JDEAccount: '', CustomerEmail: '', State: '', Doctor_x0020_Cell: '', PVApermission: false }) });
    assert.ok(html.includes('not yet assigned'));
    assert.ok(html.includes('Not provided'));
    assert.ok(html.includes('555-0199'), 'falls back to the customer phone');
  });

  test('the State row shows only when the Routing row asks for it', () => {
    assert.ok(build().html.includes('>State<'));
    assert.ok(!build({ route: STAFF, service: 'Staffing' }).html.includes('>State<'));
  });

  test('greeting: the Routing greeting, else Hi and the contact name, else Hi there', () => {
    assert.ok(build({ route: STAFF, service: 'Staffing' }).html.includes('Hi Pat,'));
    assert.ok(build({ route: readRoute({ Title: 'Y', Primaryemail: 'y@example.invalid', Verified: true }) }).html.includes('Hi there,'));
  });

  test('call the rep first shows only when the instructions say so, in any case', () => {
    assert.ok(!build().html.includes('Call the rep first'));
    assert.ok(build({ referral: referral({ Contact_x0020_Instructions: 'CONTACT FIRST: YES' }) }).html.includes('Call the rep first'));
  });

  test('RM shows as RGM beside the rep', () => {
    assert.ok(build({ referrerLabel: 'RM' }).html.includes('</b>, RGM'));
    assert.ok(build({ referrerLabel: 'AE' }).html.includes('</b>, AE'));
  });

  test('no partner name from the older labels is added to the copy', () => {
    assert.ok(!/hsra|hspa|numbersiq/i.test(build().html));
  });
});
