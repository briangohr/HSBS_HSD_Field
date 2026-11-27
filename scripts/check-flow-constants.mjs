// Usage: node scripts/check-flow-constants.mjs <flow export .definition.json> [more files]
// Exit 0 when every flow's Holidays and Closed_words equal src/lib/field-rules.mjs, 1 when one
// differs, 2 on a bad file. A flow with no such action reports "missing", which is not a
// failure (7F, 7G and 7H type them, most flows do not). Prints no row data.
import { readFileSync } from 'node:fs';
import { compareFlowConstants } from '../src/lib/flow-constants.mjs';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: node scripts/check-flow-constants.mjs <definition.json> [more]');
  process.exit(2);
}

let failed = false;
for (const file of files) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    console.error(`${file}: cannot read as JSON`);
    process.exit(2);
  }
  for (const row of compareFlowConstants(parsed)) {
    const extra = row.status === 'differs' ? `  missing: [${row.missing.join(', ')}]  extra: [${row.extra.join(', ')}]` : '';
    console.log(`${file}: ${row.constant}: ${row.status}${extra}`);
    if (row.status === 'differs') failed = true;
  }
}
process.exit(failed ? 1 : 0);
