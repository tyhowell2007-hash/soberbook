/* =====================================================================
   PROBLEM TICKETS — the shared words. 0202, 13 Nov 2026.
   ⚠️ The ids must match the CHECK on tickets.category (0202).
   ===================================================================== */

import { isIosApp } from './is-ios-app';

export const CATS = [
  { id: 'load',     label: 'Won’t load',     long: 'A page won’t load' },
  { id: 'messages', label: 'Messages',       long: 'Messages' },
  { id: 'posting',  label: 'Posting',        long: 'Posting' },
  { id: 'button',   label: 'Button missing', long: 'A button or screen is missing' },
  { id: 'signin',   label: 'Signing in',     long: 'Signing in' },
  { id: 'alerts',   label: 'Alerts',         long: 'Alerts' },
  { id: 'other',    label: 'Something else', long: 'Something else' },
];

export function catLabel(id) {
  return (CATS.find((c) => c.id === id) || { long: 'Something else' }).long;
}

/* What the MEMBER sees. */
export const MEMBER_STATUS = {
  new:     { text: 'Sent',            cls: 'tk-st-new' },
  working: { text: 'Looking into it', cls: 'tk-st-prog' },
  fixed:   { text: 'Fixed',           cls: 'tk-st-fix' },
  notbug:  { text: 'Closed',          cls: 'tk-st-done' },
};

export const ticketNo = (n) => `SB-${String(n).padStart(4, '0')}`;

/* The phone details a ticket carries. Shown to the member on the form
   before they send it — nothing here is collected silently. */
export function deviceLine() {
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent || '';
  const ios = ua.match(/(?:iPhone|CPU) OS (\d+)[_.](\d+)/);
  const android = ua.match(/Android (\d+(?:\.\d+)?)/);
  const inApp = isIosApp();
  const where = inApp ? 'iPhone app'
    : /iPhone|iPad/.test(ua) ? 'iPhone browser'
    : android ? 'Android browser'
    : /Mac OS X/.test(ua) ? 'Mac browser'
    : /Windows/.test(ua) ? 'Windows browser' : 'Browser';
  const os = ios ? `iOS ${ios[1]}.${ios[2]}` : android ? `Android ${android[1]}` : '';
  const size = typeof window !== 'undefined' ? `${window.innerWidth}×${window.innerHeight}` : '';
  return [where, os, size].filter(Boolean).join(', ');
}
