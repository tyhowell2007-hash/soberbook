'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';

function ago(iso) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

/* =====================================================================
   THE QUEUE.

   ⚠️ WHAT IS NOT ON THIS SCREEN, AND WHY THAT'S THE POINT

   For an anonymous post there is no name, no handle, no id, no avatar.
   Not hidden by CSS — never sent. `report_queue` has no author_id column
   at all, so there is nothing in this browser to accidentally log,
   screenshot, or leave open on a table.

   Which raises the obvious question: how do you suspend someone you
   can't identify? You don't. You suspend a POST, and the database works
   out who wrote it on the other side of the wire. mod_suspend takes a
   report id and returns nothing.

   The cost is real: no "show me everything this person has posted", no
   ban-by-name. What you get instead is `prior_reports` — a count, which
   distinguishes a one-off from a pattern without naming anybody. That
   trade is the product. "Is it really anonymous?" — "Yes, including from
   me" is an answer worth more than the convenience it costs.
   ===================================================================== */
export default function Queue({ rows, urls }) {
  const supabase = browserClient();
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [err, setErr]   = useState('');

  const open = rows.filter((r) => r.status === 'open');
  const done = rows.filter((r) => r.status !== 'open');

  async function act(reportId, fn, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return;
    setErr(''); setBusy(reportId);
    try {
      const { error } = await supabase.rpc(fn, { p_report: reportId });
      if (error) throw error;
      router.refresh();
    } catch (e) {
      /* 42501 is Postgres for "insufficient privilege" — the guard inside
         the function firing. Worth translating, because the raw message
         reads like a crash rather than a rule. */
      setErr(String(e.message || '').includes('not allowed')
        ? 'That action needs moderator rights.'
        : e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="mast">
        <span className="lg">🌱 SOBER BOOK</span>
        <Link href="/wall" className="rt melink">back to the wall ›</Link>
      </div>
      <div className="bar">Reports · {open.length} waiting</div>

      <div className="pad">
        {err && <div className="err">{err}</div>}

        {open.length === 0 && (
          <div className="mq-empty">
            <h2>Nothing waiting.</h2>
            {/* ⚠️ Says what it MEANS, not just that it's empty. An empty
                queue and a broken queue look identical, and on a
                moderation screen the difference matters — silence here
                could mean "nobody reported anything" or "reports stopped
                arriving three weeks ago and nobody noticed". */}
            <p>
              Every report members have filed has been dealt with.
              {rows.length > 0 && ` ${done.length} handled so far.`}
            </p>
          </div>
        )}

        {open.map((r) => (
          <article key={r.report_id} className="mq">
            <div className="mq-top">
              <span className={'mq-kind ' + r.kind}>
                {r.kind === 'concern' ? 'Worried about them' : 'Against the rules'}
              </span>
              <span className="mq-when">{ago(r.created_at)}</span>
            </div>

            <div className="mq-who">
              {r.content_is_anonymous
                ? <span className="mq-anon">🤫 posted anonymously — author not shown</span>
                : <span>@{r.author_handle || 'unknown'}</span>}
              {r.prior_reports > 0 && (
                <span className="mq-prior">
                  {r.prior_reports} other report{r.prior_reports === 1 ? '' : 's'} against
                  {r.content_is_anonymous ? ' whoever wrote this' : ' them'}
                </span>
              )}
              {r.also_reported_by > 0 && (
                <span className="mq-prior">
                  {r.also_reported_by} other member{r.also_reported_by === 1 ? '' : 's'} flagged this same post
                </span>
              )}
              {r.author_suspended && <span className="mq-susp">already suspended</span>}
            </div>

            {r.content_gone
              ? <p className="mq-gone">The post has already been deleted.</p>
              : <>
                  <p className="mq-body">{r.body}</p>
                  {r.photo_url && urls[r.photo_url] && (
                    <div className="mq-photo">
                      <img src={urls[r.photo_url]} alt="Reported photo" />
                    </div>
                  )}
                </>}

            {r.reason && <p className="mq-reason">“{r.reason}”</p>}

            {/* ⚠️ 988 shown on the concern lane, always. A report filed
                because somebody is FRIGHTENED FOR the poster is not a
                moderation task and must not be treated as one — there is
                nothing to remove and nobody to suspend. The useful action
                is reaching the person, so the number is right here rather
                than in a document. */}
            {r.kind === 'concern' && (
              <p className="mq-988">
                This was filed out of worry, not a rule break. If someone may be in
                danger: <strong>988</strong> (call or text, US) is the Suicide &amp;
                Crisis Lifeline. Removing the post is rarely the right answer here.
              </p>
            )}

            <div className="mq-acts">
              <button className="btn ghost" disabled={busy === r.report_id}
                      onClick={() => act(r.report_id, 'mod_dismiss')}>
                Nothing wrong here
              </button>
              {!r.content_gone && (
                <button className="btn ghost" disabled={busy === r.report_id}
                        onClick={() => act(r.report_id, 'mod_remove',
                          'Delete this post? The photo goes with it and this cannot be undone.')}>
                  Take the post down
                </button>
              )}
              <button className="btn ghost mq-danger" disabled={busy === r.report_id}
                      onClick={() => act(r.report_id, 'mod_suspend',
                        'Suspend whoever wrote this? Every post and comment they have made disappears from the app immediately.')}>
                Suspend whoever wrote it
              </button>
            </div>
          </article>
        ))}

        {done.length > 0 && (
          <>
            <h2 className="sec">Already handled</h2>
            {done.slice(0, 20).map((r) => (
              <div key={r.report_id} className="mq mq-done">
                <span className="mq-when">{ago(r.created_at)}</span>
                <span className={'mq-kind ' + r.kind}>{r.status}</span>
                <p className="mq-body">{r.body || '(content deleted)'}</p>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}
