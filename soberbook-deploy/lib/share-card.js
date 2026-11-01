import QRCode from 'qrcode';

/* =====================================================================
   SHARE MY PROFILE — shared bits for /share (mine) and /card (public).
   1 Nov 2026 (0199). Ty: "build that now with the QR code."

   The public address is soberbook.app/@handle. middleware.js rewrites it
   to /card/<handle>, which is open to people who aren't signed in.
   ===================================================================== */
export const SITE = 'https://soberbook.app';
export function cardUrl(handle) { return `${SITE}/@${handle}`; }
export function cardLabel(handle) { return `soberbook.app/@${handle}`; }

/* The QR code is drawn on the SERVER as an SVG string: no picture file,
   no outside service, nothing fetched when someone opens the page.
   Margin 1 because the card already gives it a white tile to sit on. */
export async function qrSvg(text) {
  return QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M',
    color: { dark: '#16201B', light: '#FFFFFF' } });
}

export function dayLine(days) {
  if (days == null) return null;
  if (days === 0) return 'Day one';
  return `Day ${Number(days).toLocaleString('en-US')}`;
}
