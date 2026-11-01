'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/* RecoveryMap's small moving parts: the phone menu, the Español button
   and Quick exit. */

export function MenuButton({ label }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const el = document.getElementById('rm-links');
    if (el) el.classList.toggle('open', open);
  }, [open]);
  return (
    <button type="button" className="menubtn" aria-expanded={open} aria-controls="rm-links"
            onClick={() => setOpen((o) => !o)}>{label}</button>
  );
}

/* ⚠️ A cookie, not localStorage: the pages are drawn on the server, so the
   server has to know the language before it writes a word. */
export function LangButton({ lang }) {
  const router = useRouter();
  const flip = () => {
    const next = lang === 'es' ? 'en' : 'es';
    document.cookie = `rm_lang=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };
  return <button type="button" className="lang" onClick={flip} lang={lang === 'es' ? 'en' : 'es'}>
    {lang === 'es' ? 'English' : 'Español'}
  </button>;
}

/* =====================================================================
   QUICK EXIT. For somebody searching where a partner or parent might
   walk in. One tap, or Esc twice, and the page becomes the weather.

   🔴 location.replace, NOT location.href: replace takes RecoveryMap out
   of the Back button, so pressing Back doesn't bring it straight back.
   ⚠️ It can't erase browser history — nothing on a web page can. The
   privacy page says so plainly, with how to use a private window.
   ===================================================================== */
export function QuickExit({ label }) {
  useEffect(() => {
    let last = 0;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      const now = Date.now();
      if (now - last < 800) go();
      last = now;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <button type="button" className="qexit" onClick={go}
            title="Leaves this site right away. You can also press Esc twice.">
      {label} <span>Esc Esc</span>
    </button>
  );
}
function go() {
  try { document.body.style.display = 'none'; } catch {}
  window.location.replace('https://weather.com/');
}
