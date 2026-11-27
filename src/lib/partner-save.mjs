// The partner page's save (sheet PU, piece A): check the answers, post one save to 7F and
// word the answer. Used by /api/partner-save. It never logs the key or a lead.

import { isSubmissionId } from './field-form.mjs';
import { PartnerFlowError, dealValueEnabled, officeCheckEnabled, parkedEnabled, saveUpdates } from './partner-flow.mjs';
import { SAVE_WORDS, checkUpdates, isPartnerKey, parkNoDateCount, saveResultWords, savedWords, withParkWords } from './partner-form.mjs';

/**
 * The day rules (meeting today or later, signed not after today) are left to the page and to
 * 7F, so a resend after midnight still reaches 7F's submission tag check (Codex P1 on #14).
 * @param {unknown} raw the parsed request body: { key, submissionId, updates }
 * @returns {Promise<{ status: number, body: Record<string, unknown> }>}
 */
export async function partnerSave(raw) {
  const b = raw && typeof raw === 'object' && !Array.isArray(raw) ? /** @type {Record<string, unknown>} */ (raw) : {};
  if (!isPartnerKey(b.key)) return { status: 404, body: { error: SAVE_WORDS.badLink } };
  if (!isSubmissionId(b.submissionId)) return { status: 400, body: { error: 'bad_value', id: null, field: 'submissionId' } };
  // With the deal value switch off, a sent dealValue is ignored and none reaches 7F. With the
  // parked switch off, a parked or unpark choice is refused and no park field reaches 7F.
  const checked = checkUpdates(b.updates, null, { dealValue: dealValueEnabled(), parked: parkedEnabled() });
  if (!checked.ok) {
    if (checked.field === 'none') return { status: 400, body: { error: 'none', message: SAVE_WORDS.nothing } };
    if (checked.field === 'tooMany') return { status: 400, body: { error: 'tooMany', message: SAVE_WORDS.tooMany } };
    return { status: 422, body: { error: 'bad_value', id: checked.id, field: checked.field } };
  }
  try {
    const sent = checked.updates.length;
    // With the office check off, no answer reaches 7F, so no lead can earn the group amount.
    const updates = officeCheckEnabled() ? checked.updates : checked.updates.map((u) => ({ ...u, offices: '' }));
    const saved = await saveUpdates(String(b.key), String(b.submissionId), updates);
    // saveUpdates refuses saved above sent, so the words are never null here.
    const noDate = parkNoDateCount(checked.updates);
    const message = withParkWords(saveResultWords(saved, sent) ?? savedWords(saved), saved, sent, noDate);
    const body = { ok: true, saved, sent, partial: saved < sent, message };
    // Parks with no revisit date, which 7F saved as Closed Lost. Only with the switch on.
    return { status: 200, body: parkedEnabled() ? { ...body, parkNoDate: noDate } : body };
  } catch (err) {
    const kind = err instanceof PartnerFlowError ? err.kind : 'failed';
    if (kind === 'unknown') return { status: 404, body: { error: SAVE_WORDS.badLink } };
    if (kind === 'expired') return { status: 410, body: { error: SAVE_WORDS.expired } };
    if (kind === 'reload' || kind === 'bad_value') {
      const id = err instanceof PartnerFlowError ? err.id : null;
      return { status: 422, body: { error: kind, id, field: '' } };
    }
    if (kind === 'config') console.error('partner-save: PARTNER_FLOW_URL is not set');
    else console.error('partner-save: flow', kind, err instanceof PartnerFlowError ? err.status : 0);
    return { status: kind === 'timeout' ? 504 : 502, body: { error: 'timeout', message: SAVE_WORDS.timeout } };
  }
}
