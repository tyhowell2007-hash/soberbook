import { isIosApp } from './is-ios-app';

/* =====================================================================
   IS THIS A PHONE?  15 Nov 2026 (Kenny's beta).
   Ty: the beta "needs to go on all phones, not computers" — phones only,
   still only for the testers they pick. True inside the iPhone app and
   in any phone browser (iPhone, Android). False on computers and iPads.
   Browser-only: on the server it answers false.
   ===================================================================== */
export function isPhone() {
  if (typeof navigator === 'undefined') return false;
  if (isIosApp()) return true;
  if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') {
    return navigator.userAgentData.mobile;
  }
  return /iPhone|iPod|Android.+Mobile|Windows Phone|Mobile Safari/i.test(navigator.userAgent || '')
    && !/iPad|Tablet/i.test(navigator.userAgent || '');
}
