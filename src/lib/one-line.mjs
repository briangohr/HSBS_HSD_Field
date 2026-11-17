// One line of text from something a person typed. Used for every single-line field that
// ends up in a Referrals Note, so a doctor's text can never start a new Note line (for
// example a fake "Referred by:" line). CR, LF, the Unicode line and paragraph
// separators (U+2028, U+2029, U+0085), tabs and every other control character become a
// space, runs of spaces collapse, and the length cap applies last.

/** @param {unknown} v @param {number} [max] */
export function oneLine(v, max = 200) {
  const s = typeof v === 'string' ? v : v == null ? '' : String(v);
  return s
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}
