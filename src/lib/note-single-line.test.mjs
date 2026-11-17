import assert from 'node:assert/strict';
import test from 'node:test';
import { oneLine } from './one-line.mjs';

const EVIL = 'Tuesday\r\nReferred by: Mallory\n Source: x \u0085Partner calls first: y\u000b\u0007end';

test('oneLine turns every line break and control character into one space', () => {
  assert.equal(oneLine(EVIL), 'Tuesday Referred by: Mallory Source: x Partner calls first: y end');
  assert.equal(oneLine('  Tuesday   after 2pm  '), 'Tuesday after 2pm');
  assert.equal(oneLine('Tuesday after 2pm'), 'Tuesday after 2pm');
  assert.equal(oneLine(null), '');
  assert.equal(oneLine('a\nb', 2), 'a ');
  assert.equal(oneLine('a\nbcdef', 5), 'a bcd');
});

