import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CLOSED_WORDS, HOLIDAYS } from './field-rules.mjs';
import { compareFlowConstants } from './flow-constants.mjs';

/** A flow export shaped like the S1b files, with the arrays nested one level down. */
const flow = (holidays, closed) => ({
  properties: {
    definition: {
      actions: {
        Holidays: { type: 'Compose', inputs: holidays },
        Wrapper: { type: 'Scope', actions: { Closed_words: { type: 'Compose', inputs: closed } } },
        Other: { type: 'Compose', inputs: ['x'] },
      },
    },
  },
});

describe('compareFlowConstants', () => {
  test('same arrays are same, in any order', () => {
    const rows = compareFlowConstants(flow([...HOLIDAYS].reverse(), [...CLOSED_WORDS]));
    assert.deepEqual(rows.map((r) => [r.constant, r.status]), [['Holidays', 'same'], ['Closed_words', 'same']]);
  });

  test('a missing and an extra holiday are named', () => {
    const [holidays] = compareFlowConstants(flow([...HOLIDAYS.slice(1), '2027-02-15'], [...CLOSED_WORDS]));
    assert.equal(holidays.status, 'differs');
    assert.deepEqual(holidays.missing, ['2026-11-26']);
    assert.deepEqual(holidays.extra, ['2027-02-15']);
  });

  test('a closed word typed differently differs', () => {
    const [, closed] = compareFlowConstants(flow([...HOLIDAYS], ['Signed', 'Not moving forward']));
    assert.equal(closed.status, 'differs');
    assert.ok(closed.missing.includes('Close won'));
  });

  test('a flow without the actions reports missing, not differs', () => {
    const rows = compareFlowConstants({ properties: { definition: { actions: {} } } });
    assert.deepEqual(rows.map((r) => r.status), ['missing', 'missing']);
  });

  test('a Compose that is not an array differs, and a non-Compose of the same name is ignored', () => {
    const rows = compareFlowConstants({ actions: { Holidays: { type: 'Compose', inputs: 'nope' }, Closed_words: { type: 'Scope' } } });
    assert.equal(rows[0].status, 'differs');
    assert.equal(rows[1].status, 'missing');
  });
});
