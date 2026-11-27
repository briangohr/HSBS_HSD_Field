// Lean rebuild U1: the intro mail, as a pure function. Same fields, same order and same styles
// as the Intro_a and Intro_b compose actions in HSBS 3F (S1b exports 11/26/2026), with every
// value HTML escaped. No address is typed here: recipients come from the Routing row and the
// Field Settings rows the caller passes in.
//
// Left out on purpose: 3F adds "Needs: ..." for one partner when the note names two older
// labels. That partner has no Routing row today. Add it back with the partner, if it is routed.

import { oneLine } from './one-line.mjs';

const LOGO = 'https://hsbs-hsd-field.vercel.app/logos/hsbs-email-logo.png';

/** @param {unknown} v */
export const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const LABEL = 'padding:7px 0;color:#5a6676;width:38%;border-bottom:1px solid #edf0f4';
const VALUE = 'padding:7px 0;border-bottom:1px solid #edf0f4';
const row = (label, value, last = false) =>
  `<tr><td style="${last ? 'padding:7px 0;color:#5a6676;width:38%;' : LABEL}">${label}</td><td style="${last ? 'padding:7px 0;' : VALUE}">${value}</td></tr>`;
const SECTION = 'font-size:12px;font-weight:700;color:#0b3b6f;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #0b3b6f;padding-bottom:4px';

/**
 * @typedef {ReturnType<import('./intro-plan.mjs').readReferral>} Referral
 * @typedef {ReturnType<import('./intro-plan.mjs').readRoute>} Route
 * @param {{
 *   referral: Referral,
 *   service: string,
 *   route: Route,
 *   referrerLabel?: string,
 *   settings: { mailOwner: string, introCc: string, replyTo: string, signatureEmail: string },
 * }} input `referrerLabel` is the rep's role, RM shown as RGM. Settings hold the addresses.
 * @returns {{ to: string[], cc: string[], replyTo: string, subject: string, html: string }}
 */
export function buildIntroMail({ referral: r, service, route, referrerLabel = '', settings }) {
  const test = r.test;
  const prodTo = route.routable ? route.email : settings.mailOwner;
  const prodCc = [r.repEmail, settings.introCc].filter(Boolean);
  const to = [test ? settings.mailOwner : prodTo];
  const cc = test ? [] : prodCc;

  const jde = r.jde;
  const subject =
    (test ? '[TEST] ' : '') +
    (route.routable ? '' : 'NOT SENT, forward manually: ') +
    `New ${oneLine(service, 80)} referral: ${oneLine(r.practice, 120)}` +
    (jde ? ` (JDE ${oneLine(jde, 40)})` : '');

  const greeting = route.greeting || `Hi ${route.contact || 'there'}`;
  const callFirst = r.instructions.toLowerCase().includes('contact first: yes');
  const phone = r.cell || r.phone;
  const label = referrerLabel === 'RM' ? 'RGM' : referrerLabel;

  const head =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5"><tr><td style="padding:16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #d5dbe3;border-collapse:collapse;font-family:Segoe UI,Arial,sans-serif;color:#1b2430"><tr><td style="background:#ffffff;padding:16px 20px 12px;border-bottom:4px solid #0072BC"><img src="${LOGO}" alt="Henry Schein Business Solutions" width="240" height="55" style="display:block;border:0"></td></tr>` +
    (test
      ? `<tr><td style="padding:10px 20px 0;font-size:12px;color:#8a3b00"><b>[TEST MODE] Production To would be: ${esc(prodTo)}<br>[TEST MODE] Production CC would be: ${esc(prodCc.join('; '))}</b></td></tr>`
      : '') +
    (route.routable
      ? ''
      : '<tr><td style="padding:10px 20px 0;font-size:13px"><b>Not sent to the partner.</b> This company has no verified email in the Routing list. Forward this email to the right contact, or fix the Routing row.</td></tr>') +
    `<tr><td style="padding:20px 20px 4px"><div style="font-size:12px;color:#5a6676;text-transform:uppercase;letter-spacing:.05em;font-weight:700">New referral for ${esc(service)}</div><div style="font-size:22px;font-weight:700;margin-top:4px">${esc(r.practice)}</div><div style="font-size:14px;color:#3a4656;margin-top:4px">Referred by <b>${esc(r.rep)}</b>${label ? `, ${esc(label)}` : ''} &nbsp;|&nbsp; Reference ${esc(r.ref)}</div></td></tr>` +
    (callFirst
      ? `<tr><td style="padding:12px 20px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7d6;border:1px solid #e6c84a;border-collapse:collapse"><tr><td style="padding:10px 12px;font-size:14px"><b>Call the rep first.</b> ${esc(r.rep)} (${esc(r.repEmail)}) asked to speak with you before you contact the office.</td></tr></table></td></tr>`
      : '') +
    `<tr><td style="padding:14px 20px 0;font-size:14px;line-height:1.55">${esc(greeting)},<br>${esc(r.rep)} (${esc(r.repEmail)}) is referring this practice to ${esc(service)}.</td></tr>`;

  const body =
    `<tr><td style="padding:16px 20px 0"><div style="${SECTION}">Doctor and practice</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse">` +
    row('Doctor', `<b>${esc(r.customerName)}</b>`) +
    row('Account number (JDE)', `<b style="font-size:16px">${jde ? esc(jde) : 'not yet assigned'}</b>`) +
    row('Best phone', esc(phone)) +
    row('Preferred contact', esc(r.preferredContact) + (r.instructions ? `. ${esc(r.instructions)}. <br>` : '')) +
    row('Email', esc(r.customerEmail || 'Not provided')) +
    (route.showState ? row('State', esc(r.state || 'Not provided')) : '') +
    row('Doctor OK to be contacted', r.doctorOk ? 'Yes' : 'No', true) +
    `</table></td></tr><tr><td style="padding:16px 20px 0"><div style="${SECTION}">Needs and notes</div><div style="background:#f4f6f9;border-left:4px solid #0b3b6f;padding:10px 12px;margin-top:8px;font-size:14px;line-height:1.5">${esc(r.note).replace(/\r/g, '').replace(/\n/g, '<br>')}</div></td></tr>` +
    `<tr><td style="padding:16px 20px 0;font-size:14px;line-height:1.55"><b>Please reach the doctor by the next business day.</b></td></tr>` +
    `<tr><td style="padding:8px 20px 20px;font-size:14px;line-height:1.5">Thank you,<br>Brian Gohr<br>Henry Schein Business Solutions<br>${esc(settings.signatureEmail)}</td></tr>` +
    `<tr><td style="background:#f4f6f9;padding:10px 20px;font-size:11px;color:#6a7686">Sent by the Henry Schein Business Solutions field referral app.</td></tr></table></td></tr></table>`;

  return { to, cc, replyTo: settings.replyTo, subject, html: head + body };
}
