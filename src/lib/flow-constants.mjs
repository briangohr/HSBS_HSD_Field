// Compares the Holidays and Closed_words arrays typed into a flow export with the one copy
// in `field-rules.mjs` (lean rebuild, unit U0). The CLI is `scripts/check-flow-constants.mjs`.
// Output names only which constant differs and the values that are missing or extra. It
// reads no list rows and no addresses.
import { CLOSED_WORDS, HOLIDAYS } from './field-rules.mjs';

/** Flow action name and the module copy it must equal. */
export const WATCHED = Object.freeze([
  { action: 'Holidays', expected: HOLIDAYS },
  { action: 'Closed_words', expected: CLOSED_WORDS },
]);

/**
 * Every Compose action with this name, at any depth.
 * @param {unknown} node
 * @param {string} name
 * @param {unknown[]} [found]
 */
function findCompose(node, name, found = []) {
  if (!node || typeof node !== 'object') return found;
  for (const [key, value] of Object.entries(node)) {
    if (key === name && value && typeof value === 'object' && /** @type {any} */ (value).type === 'Compose') {
      found.push(/** @type {any} */ (value).inputs);
    } else {
      findCompose(value, name, found);
    }
  }
  return found;
}

/**
 * @param {unknown} definition a parsed flow export (.definition.json) or the definition alone
 * @returns {{ constant: string, status: 'same' | 'missing' | 'differs', missing: string[], extra: string[] }[]}
 */
export function compareFlowConstants(definition) {
  return WATCHED.map(({ action, expected }) => {
    const copies = findCompose(definition, action);
    if (copies.length === 0) return { constant: action, status: 'missing', missing: [], extra: [] };
    const missing = new Set();
    const extra = new Set();
    for (const copy of copies) {
      const values = Array.isArray(copy) ? copy.map(String) : [];
      for (const word of expected) if (!values.includes(word)) missing.add(word);
      for (const word of values) if (!expected.includes(word)) extra.add(word);
    }
    const differs = missing.size > 0 || extra.size > 0;
    return {
      constant: action,
      status: differs ? 'differs' : 'same',
      missing: [...missing],
      extra: [...extra],
    };
  });
}
