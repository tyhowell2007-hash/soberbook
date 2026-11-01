'use client';

import { useEffect, useState } from 'react';
import { browserClient } from '../../../lib/supabase-browser';
import { telHref } from '../../../lib/rm/words';

/* Filters apply the moment you tick a box (the form still works without
   JavaScript through its <noscript> button). */
export function AutoSubmit({ form }) {
  useEffect(() => {
    const f = document.getElementById(form);
    if (!f) return;
    const on = () => f.requestSubmit ? f.requestSubmit() : f.submit();
    f.addEventListener('change', on);
    return () => f.removeEventListener('change', on);
  }, [form]);
  return null;
}

/* A tap on a phone number = +1 for that town today (rm_tap). No person,
   no device, no IP — see 0198. Fire-and-forget: the call is what matters. */
export function TapLink({ id, dial, className, children }) {
  const tap = () => { try { browserClient().rpc('rm_tap', { p_center: id }).then(() => {}, () => {}); } catch {} };
  return <a className={className} href={telHref(dial)} onClick={tap}>{children || dial}</a>;
}

/* "Send this to a phone." No account. On a phone it opens a text with
   the places and numbers already written; anywhere else, copy it.
   ⚠️ The sms: link may do nothing on a desktop; the Copy button always
   works, and the page never claims a message was sent. */
export function smsText(rows, lang) {
  const head = lang === 'es' ? 'Lugares para llamar (de RecoveryMap por la Dra. Nicole Labor):' : 'Places to call (from RecoveryMap by Dr. Nicole Labor):';
  const foot = lang === 'es' ? 'En crisis: llame o envíe un texto al 988.' : 'In crisis: call or text 988.';
  return `${head}\n\n${rows.map((r) => `${r.n}, ${r.c}\n${r.dial}${r.ext ? ` ext. ${r.ext}` : ''}`).join('\n\n')}\n\n${foot}`;
}

export function SendList({ rows, label, lang }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const text = smsText(rows, lang);
  const es = lang === 'es';
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setMsg(es ? 'Copiado. Péguelo en un mensaje.' : 'Copied. Paste it into a text.'); }
    catch { setMsg(es ? 'Selecciónelo y cópielo.' : 'Select it and copy it from your phone’s menu.'); }
  };
  useEffect(() => {
    if (!open) return;
    const k = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open]);
  return (
    <>
      <button type="button" className="rm-btn ghost sm" onClick={() => { setMsg(''); setOpen(true); }}>{label}</button>
      {open && (
        <div className="modal" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="mbox" role="dialog" aria-modal="true" aria-labelledby="rm-sms-t">
            <h3 id="rm-sms-t">{es ? 'Enviar a un teléfono' : 'Send to a phone'}</h3>
            <p className="small">{es ? 'Sin cuenta. Su teléfono abre un mensaje ya escrito.' : 'No account. Your phone opens a text with this already written. Send it to yourself or someone you love.'}</p>
            <pre className="smsprev">{text}</pre>
            <div className="actions">
              <a className="rm-btn sm" href={`sms:?&body=${encodeURIComponent(text)}`}>{es ? 'Abrir mensajes' : 'Open Messages'}</a>
              <button type="button" className="rm-btn ghost sm" onClick={copy}>{es ? 'Copiar' : 'Copy text'}</button>
              <button type="button" className="rm-btn ghost sm" onClick={() => setOpen(false)}>{es ? 'Cerrar' : 'Close'}</button>
            </div>
            <p className="small" aria-live="polite">{msg}</p>
          </div>
        </div>
      )}
    </>
  );
}
