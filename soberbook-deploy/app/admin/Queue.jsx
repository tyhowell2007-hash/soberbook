'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { browserClient } from '../../lib/supabase-browser';

/* 0194: what Sage's label says in the queue. ⚠️ "danger" has no "Sage:"
   in front, because it is usually NOT Sage's call: a "worried about them"
   report and the danger-word check both set it before the model is asked. */
const LABEL = {
  danger: 'May be in danger',
  threat: 'Sage: threatens someone',
  selling: 'Sage: selling',
  harassment: 'Sage: harassment',
  routine: 'Sage: routine',
};

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
/* =====================================================================
   0204 — IMAGE ABUSE STEPS (13 Nov 2026).
   csam: report to the NCMEC CyberTipline, type the number, suspend. Never
   restored, never taken down here (the evidence must be kept 1 year).
   ncii: TAKE IT DOWN Act. 48 hours from the report to remove it for good
   or restore it. Not legal advice; the attorney should review.
   ===================================================================== */
function ImageSteps({ r, busy, act }) {
  const [no, setNo] = useState(r.cybertip_no || '');
  const [saved, setSaved] = useState(!!r.cybertip_no);
  const [err, setErr] = useState('');
  if (r.kind === 'csam') {
    async function saveNo() {
      setErr('');
      const { error } = await browserClient().rpc('mod_cybertip', { p_report: r.report_id, p_no: no });
      if (error) { setErr(error.message.includes('not allowed') ? 'That needs moderator rights.' : error.message); return; }
      setSaved(true);
    }
    return (
      <div className="mq-acts" style={{ display: 'block' }}>
        <ol style={{ margin: '0 0 10px', paddingLeft: 20, lineHeight: 1.5 }}>
          <li>Report it to the NCMEC CyberTipline at{' '}
            <a href="https://report.cybertip.org" target="_blank" rel="noopener noreferrer">report.cybertip.org</a>
            {' '}and follow its instructions. Never download, screenshot or forward it.</li>
          <li>Type the CyberTipline report number:
            <span style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input value={no} onChange={(e) => { setNo(e.target.value); setSaved(false); }} placeholder="Report number"
                     style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 10, border: '1.5px solid #C5CCEB', font: 'inherit' }} />
              <button type="button" className="btn" disabled={!no.trim() || saved} onClick={saveNo}>{saved ? 'Saved ✓' : 'Save'}</button>
            </span></li>
          <li>Suspend the account.</li>
        </ol>
        {err && <div className="err">{err}</div>}
        <p className="mq-prior">Kept locked away for 1 year, as the law requires, then deleted. Nobody can open it in the app.</p>
        {r.author_suspended
          ? <span className="mq-prior">Suspended ✓</span>
          : <button className="btn ghost mq-danger" disabled={busy}
                    onClick={() => act(r.report_id, 'mod_suspend', 'Suspend whoever posted this? Everything they have posted disappears from the app.')}>
              Suspend whoever posted it
            </button>}
      </div>
    );
  }
  const left = Math.max(0, 48 - Math.floor((Date.now() - new Date(r.created_at).getTime()) / 36e5));
  return (
    <div className="mq-acts" style={{ display: 'block' }}>
      <p className="mq-prior" style={{ fontWeight: 800, color: left <= 12 ? '#9A3412' : undefined }}>
        {left > 0 ? `${left} hours left to decide (TAKE IT DOWN Act: 48 hours)` : 'Past 48 hours: decide now'}
      </p>
      <p className="mq-prior">Check the wall for other copies of the same picture and report those too.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button className="btn" disabled={busy}
                onClick={() => act(r.report_id, 'mod_remove', 'Remove this post for good? This cannot be undone.')}>
          Remove for good
        </button>
        <button className="btn ghost" disabled={busy}
                onClick={() => act(r.report_id, 'mod_restore_media', 'Put the picture back? Only if it is not a private image of someone.')}>
          Not a match, restore
        </button>
        {!r.author_suspended && (
          <button className="btn ghost mq-danger" disabled={busy}
                  onClick={() => act(r.report_id, 'mod_suspend', 'Suspend whoever posted this?')}>
            Suspend them
          </button>
        )}
      </div>
    </div>
  );
}

/* 0204 — take-down requests from the Support page (TAKE IT DOWN Act).
   A request that named a post already hid it and sits in the queue below;
   this list is the request itself, so it can be closed and the person told. */
function Takedowns({ list }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState('');
  if (!list?.length) return null;
  async function close(id, status) {
    setBusy(id); setErr('');
    const r = await fetch('/api/takedown/act', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    setBusy(null);
    if (!r.ok) { setErr('Couldn’t do that. Try again.'); return; }
    router.refresh();
  }
  return (
    <>
      <h2 className="sec">Take-down requests · 48-hour clock</h2>
      {err && <div className="err">{err}</div>}
      {list.map((t) => {
        const left = Math.max(0, 48 - Math.floor((Date.now() - new Date(t.created_at).getTime()) / 36e5));
        return (
          <article key={t.id} className="mq mq-urgent">
            <div className="mq-top">
              <span className="mq-kind mq-red">{left > 0 ? `${left}h left` : 'Past 48 hours'}</span>
              <span className="mq-kind">TD-{String(t.num).padStart(4, '0')}</span>
              <span className="mq-when">{t.post_id ? 'Picture already hidden (report below)' : 'Find it and report it as a private image'}</span>
            </div>
            <p className="mq-body">{t.where_text}</p>
            <p className="mq-prior">Signed: {t.signature} · {t.email}</p>
            <div className="mq-acts">
              <button className="btn" disabled={busy === t.id} onClick={() => close(t.id, 'removed')}>It&rsquo;s removed, tell them</button>
              <button className="btn ghost" disabled={busy === t.id} onClick={() => close(t.id, 'not_match')}>Couldn&rsquo;t find it, tell them</button>
            </div>
          </article>
        );
      })}
    </>
  );
}

export default function Queue({ rows, urls, takedowns = [] }) {
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
      {/* 0202 — the problem-ticket board lives next door. */}
      <p style={{ margin: '10px 16px 0', textAlign: 'right' }}>
        <Link href="/admin/tickets" className="melink">Problem tickets ›</Link>
        {' · '}
        <Link href="/admin/accounts" className="melink">Accounts ›</Link>
        {' · '}
        <Link href="/admin/live" className="melink">Live now ›</Link>
      </p>

      <div className="pad">
        {err && <div className="err">{err}</div>}
        <Takedowns list={takedowns} />

        {open.some((r) => r.urgent) && (
          <p className="mq-sum">
            {open.filter((r) => r.urgent).length} urgent, at the top. Every button
            below is still yours. Sage only sorts.
          </p>
        )}

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
          <article key={r.report_id} className={'mq' + (r.urgent ? ' mq-urgent' : '')}>
            <div className="mq-top">
              {r.urgent && <span className="mq-kind mq-red">Urgent</span>}
              <span className={'mq-kind ' + r.kind}>
                {r.kind === 'csam' ? 'Image of a minor'
                  : r.kind === 'ncii' ? 'Private image'
                  : r.auto ? 'Flagged by the app'
                  : r.kind === 'concern' ? 'Worried about them' : 'Against the rules'}
              </span>
              {r.sage_label && LABEL[r.sage_label] && (
                <span className="mq-kind mq-sage">{LABEL[r.sage_label]}</span>
              )}
              <span className="mq-when">{ago(r.created_at)}</span>
            </div>

            <div className="mq-who">
              {/* 0201 🔴 A private message: no words, no name, ever. Reach out
                  still reaches them — the database finds the sender. */}
              {r.in_private
                ? <span className="mq-anon">🔒 in a private message — words and name not shown</span>
                : r.content_is_anonymous
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

            {/* 0204 — image abuse. The picture was moved off the post the moment
                this was filed; it is NEVER shown here, not even blurred. */}
            {(r.kind === 'csam' || r.kind === 'ncii') && (
              <div className="mq-gone" style={{ background: '#1B1F3B', color: '#C9CFF5', borderRadius: 12, padding: '18px 12px', textAlign: 'center', fontWeight: 800 }}>
                {r.kind === 'csam' ? 'Image hidden · do not open' : 'Hidden from everyone'}
              </div>
            )}
            {r.in_private
              ? <p className="mq-body">Someone wrote something in a private message that reads like
                  they may need support. They saw the 988 card.</p>
              : r.content_gone
              ? <p className="mq-gone">The post has already been deleted.</p>
              : <>
                  <p className="mq-body">{r.body}</p>
                  {/* ⚠️ ALL of them, stacked, not a grid (0065). A grid is
                      for browsing; this is evidence, and a moderator needs
                      to see each picture at a size they can actually judge.
                      Numbered so a note can say which one. */}
                  {(Array.isArray(r.photo_urls) && r.photo_urls.length
                    ? r.photo_urls
                    : (r.photo_url ? [r.photo_url] : [])
                  ).filter((s) => urls[s]).map((s, i, all) => (
                    <div className="mq-photo" key={s}>
                      <img src={urls[s]}
                           alt={all.length > 1
                             ? `Reported photo ${i + 1} of ${all.length}`
                             : 'Reported photo'} />
                    </div>
                  ))}
                </>}

            {r.reason && <p className="mq-reason">“{r.reason}”</p>}

            {/* ⚠️ 988 shown on the concern lane, always. A report filed
                because somebody is FRIGHTENED FOR the poster is not a
                moderation task and must not be treated as one — there is
                nothing to remove and nobody to suspend. The useful action
                is reaching the person, so the number is right here rather
                than in a document. */}
            {r.auto && r.kind === 'concern' && (
              <p className="mq-988">
                Nobody reported this. The app spotted crisis words in their own post and
                showed them the 988 card. The post stayed up. Reach out, or mark it handled.
              </p>
            )}
            {r.kind === 'concern' && !r.auto && (
              <p className="mq-988">
                This was filed out of worry, not a rule break. If someone may be in
                danger: <strong>988</strong> (call or text, US) is the Suicide &amp;
                Crisis Lifeline. Removing the post is rarely the right answer here.
              </p>
            )}

            {(r.kind === 'csam' || r.kind === 'ncii')
              ? <ImageSteps r={r} busy={busy === r.report_id} act={act} />
              : <div className="mq-acts">
              {/* 0194, "Reach out". Sends the author a fixed, kind check-in
                  with 988 on it (/checkin). You never learn who they are:
                  the database finds them, the same way mod_suspend does.
                  Shown when there is a person to reach and something that
                  suggests they might need it. */}
              {!r.content_gone && (r.urgent || r.kind === 'concern') && (
                r.reached_out_at
                  ? <span className="mq-prior">Checked in on them ✓</span>
                  : <button className="btn" disabled={busy === r.report_id}
                            onClick={() => act(r.report_id, 'mod_reach_out',
                              'Send them a private check-in from Sober Book, with 988 on it? They are not told they were reported, and you are not told who they are.')}>
                      Reach out
                    </button>
              )}
              <button className="btn ghost" disabled={busy === r.report_id}
                      onClick={() => act(r.report_id, 'mod_dismiss')}>
                {r.auto ? 'Mark as handled' : 'Nothing wrong here'}
              </button>
              {/* 0201: an app flag is somebody reaching out, not a rule break, so
                  there is nothing to take down and nobody to suspend. */}
              {!r.auto && <>
              {/* 🔴 NOT SHOWN ON A MEMBER REPORT. A report filed against a
                  person has no content attached, so there is nothing to
                  take down — and until 0094 this button quietly marked
                  the report "actioned" having done absolutely nothing.
                  The function refuses now; the button leaving is what
                  stops a moderator meeting that refusal. */}
              {!r.content_gone && !['profile', 'talk_seat', 'message'].includes(r.target_type) && (
                <button className="btn ghost" disabled={busy === r.report_id}
                        onClick={() => act(r.report_id, 'mod_remove',
                          r.target_type === 'room_message'
                            ? 'Take this message out of the room? Any pictures on it are deleted for good.'
                            : 'Delete this post? The photo goes with it and this cannot be undone.')}>
                  {r.target_type === 'room_message' ? 'Take the message down' : 'Take the post down'}
                </button>
              )}
              <button className="btn ghost mq-danger" disabled={busy === r.report_id}
                      onClick={() => act(r.report_id, 'mod_suspend',
                        r.target_type === 'profile'
                          ? 'Suspend this member? Every post and comment they have made disappears from the app immediately.'
                          : 'Suspend whoever wrote this? Every post and comment they have made disappears from the app immediately.')}>
                {r.target_type === 'profile' ? 'Suspend them' : 'Suspend whoever wrote it'}
              </button>
              </>}
            </div>}
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
