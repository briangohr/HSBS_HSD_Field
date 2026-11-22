// G2 (11/22/2026): 1F sends each case's Status Log as `statusLog`; the site turns it into
// Track history. These pin what a rep can and cannot see from it.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { HISTORY_MAX, referralHistory, statusLogHistory, statusLogLine } from './status-log.mjs';
import { attachCases } from './field-flow.mjs';
import { leadViews } from './rep-lead.mjs';
import { repFeed } from './rep-track.mjs';

const LOG = [
  '2026-11-20 HealthFirst: Trying to reach. Left a voicemail [s:9f1c2e]',
  '2026-11-21 escalated to Brian [esc:2026-11-20]',
  '2026-11-21 HealthFirst: replied by email. [r:20261121143000]',
  '',
  '2026-11-22 HealthFirst: Qualified. Wants a demo [s:77aa01]',
].join('\n');

describe('statusLogLine', () => {
  test('reads the date and drops the tag', () => {
    assert.deepEqual(statusLogLine('2026-11-20 HealthFirst: Trying to reach. Left a voicemail [s:9f1c2e]'), {
      on: '2026-11-20',
      text: 'HealthFirst: Trying to reach. Left a voicemail',
    });
    assert.deepEqual(statusLogLine('2026-11-21 HealthFirst: replied by email. [r:20261121143000]'), {
      on: '2026-11-21',
      text: 'HealthFirst: replied by email.',
    });
  });

  test('an escalation line, a blank line or a tag alone is no entry', () => {
    assert.equal(statusLogLine('2026-11-21 escalated to Brian [esc:2026-11-20]'), null);
    assert.equal(statusLogLine('2026-11-21 escalated to Brian [esc:never]'), null);
    assert.equal(statusLogLine('2026-11-21 escalated to Brian'), null);
    assert.equal(statusLogLine('   '), null);
    assert.equal(statusLogLine('2026-11-21 [s:abc]'), null);
  });

  test('a line with no date keeps its text with a blank date; a US date reads too', () => {
    assert.deepEqual(statusLogLine('Unitas: Talked with the doctor'), { on: '', text: 'Unitas: Talked with the doctor' });
    assert.deepEqual(statusLogLine('11/9/2026 HealthFirst: Reached'), { on: '2026-11-09', text: 'HealthFirst: Reached' });
    assert.deepEqual(statusLogLine('2026-02-30 HealthFirst: Reached'), { on: '', text: 'HealthFirst: Reached' });
  });
});

describe('statusLogHistory', () => {
  test('oldest first, internal lines gone, CRLF read', () => {
    assert.deepEqual(statusLogHistory(LOG.replace(/\n/g, '\r\n')), [
      { on: '2026-11-20', text: 'HealthFirst: Trying to reach. Left a voicemail' },
      { on: '2026-11-21', text: 'HealthFirst: replied by email.' },
      { on: '2026-11-22', text: 'HealthFirst: Qualified. Wants a demo' },
    ]);
  });

  test('not text is no history', () => {
    for (const v of [undefined, null, 7, {}, [], '']) assert.deepEqual(statusLogHistory(v), []);
  });

  test('keeps the newest lines when a log runs long', () => {
    const lines = Array.from({ length: HISTORY_MAX + 10 }, (_, i) => `2026-11-${String((i % 28) + 1).padStart(2, '0')} HealthFirst: No change this week. n${i}`);
    const out = statusLogHistory(lines.join('\n'));
    assert.equal(out.length, HISTORY_MAX);
    assert.equal(out[0].text, 'HealthFirst: No change this week. n10');
    assert.equal(out.at(-1).text, `HealthFirst: No change this week. n${HISTORY_MAX + 9}`);
  });
});

describe('referralHistory', () => {
  test('merges two cases by date, one day keeps log order', () => {
    const out = referralHistory([
      { statusLog: '2026-11-22 HealthFirst: Qualified [s:a]\n2026-11-22 HealthFirst: Demo set [s:b]' },
      { statusLog: '2026-11-21 Direct Dental: Trying to reach [s:c]' },
      { company: 'HealthFirst' },
      null,
    ]);
    assert.deepEqual(out.map((h) => h.text), ['Direct Dental: Trying to reach', 'HealthFirst: Qualified', 'HealthFirst: Demo set']);
  });
});

describe('Track with Status Log lines from 1F', () => {
  const ref = { id: 64, title: 'HSBS-F64', practice: 'TEST Practice', doctor: 'TEST Contact', created: '2026-11-19T15:00:00Z' };
  const line = { referralId: 64, company: 'HealthFirst', partnerStatus: 'Qualified', updated: '2026-11-22', statusLog: LOG };

  test('history is filled and the raw log is left off the line', () => {
    const [row] = attachCases([ref], [line]);
    assert.equal(row.history.length, 3);
    assert.equal('statusLog' in row.cases[0], false);
    assert.equal(line.statusLog, LOG, 'input not changed');
  });

  test('history 1F already sent wins', () => {
    const [row] = attachCases([{ ...ref, history: [{ on: '2026-11-01', text: 'Sent' }] }], [line]);
    assert.deepEqual(row.history, [{ on: '2026-11-01', text: 'Sent' }]);
  });

  test('the lead timeline shows each step with its date, no tag, no escalation', () => {
    const [lead] = leadViews(attachCases([ref], [line]), '2026-11-22');
    const text = JSON.stringify(lead.steps);
    assert.deepEqual(lead.steps.map((s) => s.label), ['Sent to HealthFirst', 'HealthFirst is reaching out', 'HealthFirst sent an update by email', 'HealthFirst qualified the lead']);
    assert.deepEqual(lead.steps.map((s) => s.on), ['Nov 19', 'Nov 20', 'Nov 21', 'Nov 22']);
    assert.ok(lead.steps.some((s) => s.label === 'HealthFirst qualified the lead' && s.on === 'Nov 22'));
    assert.ok(!/\[s:|\[r:|\[esc:|escalated|Brian/.test(text), text);
  });

  test("a manager's view keeps only mapped steps", () => {
    const [lead] = leadViews(attachCases([ref], [line]), '2026-11-22', { team: true });
    const text = JSON.stringify(lead.steps);
    assert.ok(!/voicemail|Wants a demo/.test(text), text);
    assert.ok(/HealthFirst sent an update by email/.test(text), text);
  });

  test('the feed reads the dated lines', () => {
    const feed = repFeed(attachCases([ref], [line]), '2026-11-22');
    const text = feed.map((f) => f.label).join(' | ');
    assert.ok(/Nov 20\. TEST Practice: HealthFirst is reaching out\./.test(text), text);
    assert.ok(!/\[s:|escalated/.test(text), text);
  });
});
