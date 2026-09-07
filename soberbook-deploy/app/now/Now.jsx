'use client';

import { useState } from 'react';
import Link from 'next/link';
import Practice, { PRACTICES } from '../quiet/Practice';

/* =====================================================================
   RIGHT NOW — the panel.  7 Sept.  See page.jsx for the hard rules.

   ⭐ THE PRACTICES ARE IMPORTED FROM /quiet, NOT COPIED.

   The same component and the same PRACTICES array that /quiet renders.
   A copy would be a second implementation of five pieces of health
   guidance, and the second one drifts — which in this particular file
   means one screen quietly telling somebody in trouble something the
   other screen has already corrected. (0046 -> 0047 -> 0049, three
   times in this schema, and those were only database rules.)

   ⚠️ THAT MAKES A CROSS-SEGMENT IMPORT, AND IT ONLY WORKS BECAUSE OF
   THE STYLESHEET. Practice.jsx renders .pr-* classes (pr-wrap, pr-mark,
   pr-when, pr-title, pr-steps, pr-breath, pr-circle, pr-cue, pr-note,
   pr-back, pr-stop, pr-done) and every one of them lives in quiet.css —
   so app/now/layout.jsx imports quiet.css as well as its own. Drop that
   import and this page renders the practices as naked unstyled text: no
   error, nothing in the build, just a page that looks broken at the
   worst possible moment.
   ===================================================================== */

/* The three that belong here, by what somebody is actually feeling.

   ⚠️ NOT ALL FIVE. /quiet is a page you browse; this is a page you are
   on because something is wrong, and a list of five is a decision to
   make when you have no capacity to decide.

   🔴 THESE IDS WERE READ OUT OF Practice.jsx, NOT REMEMBERED. The first
   version of this line said ['sigh','urge','ground'] and there is no
   practice called 'ground' — the real five are sigh, urge, kind, body,
   review. filter() on a missing id throws nothing and logs nothing: it
   would have rendered TWO buttons where three were intended, and looked
   completely fine. Same shape as the palette that silently lost a row
   on 4 Sept. If you add or reorder anything here, open that file.

   What's left out and why:
     body    'I can't sleep', 10 minutes — a real 3am problem, but this
             screen is for the ten minutes when something might happen,
             not the night after. Judgement call, worth revisiting.
     review  'Looking back on the day' — belongs to the evening review
             on the pledge card, not here. */
const HERE = ['sigh', 'urge', 'kind'];

export default function Now({ plan }) {
  const [practice, setPractice] = useState(null);

  /* A practice takes over the whole screen — same as /quiet. Nothing
     about opening one is written down anywhere. */
  if (practice) {
    return <Practice p={practice} onDone={() => setPractice(null)} />;
  }

  const has = plan && plan.has_plan;
  const list = PRACTICES.filter((p) => HERE.includes(p.id));

  return (
    <>
      {/* ⚠️ No back chevron in the masthead and no nav highlight. This
          is not a room you live in, it is a door you came through. The
          bottom bar is still there — see layout.jsx — so there is
          always a way out that isn't this page's job to provide. */}
      <div className="nw-top">
        <p className="nw-head">It passes. Let&apos;s get through it.</p>
        {/* 🔴 SAID FIRST, BEFORE ANYTHING IS ASKED OF THEM. Somebody
            deciding whether to open this at all needs to know it leaves
            no trace at the moment they decide, not after. Same reason
            the pledge says "Only you ever see this" above the box and
            not under it. */}
        <p className="nw-sub">Nothing here is recorded.</p>
      </div>

      <div className="pad nw-pad">
        {/* ---------------- 1 · YOUR OWN WORDS, FIRST ---------------- */}
        {has ? (
          <section className="nw-sec">
            <h2 className="nw-lbl">What works for you</h2>
            {plan.what_works && (
              <div className="nw-card nw-big">{plan.what_works}</div>
            )}
            {plan.who_to_call && (
              <>
                <h2 className="nw-lbl">Who you said you&apos;d call</h2>
                <div className="nw-card">{plan.who_to_call}</div>
              </>
            )}
            {plan.why_im_here && (
              <>
                <h2 className="nw-lbl">Why you&apos;re doing this</h2>
                <div className="nw-card">{plan.why_im_here}</div>
              </>
            )}
            {plan.if_it_happens && (
              <>
                <h2 className="nw-lbl">If it happens anyway</h2>
                <div className="nw-card">{plan.if_it_happens}</div>
              </>
            )}
            <Link href="/plan" className="nw-editplan">Change what it says ›</Link>
          </section>
        ) : (
          /* ⚠️ NOT AN EMPTY STATE AND NOT A SCOLDING. Somebody who is
             here right now and has no plan must not be met with "you
             should have prepared." One line, and it steps out of the
             way so the practices are the next thing they see. */
          <section className="nw-sec">
            <div className="nw-card nw-none">
              <p>You haven&apos;t written anything down yet — that&apos;s fine, it isn&apos;t
                 for right now.</p>
              <Link href="/plan" className="nw-editplan">Write it for next time ›</Link>
            </div>
          </section>
        )}

        {/* ---------------- 2 · THREE THINGS TO DO ---------------- */}
        <h2 className="nw-lbl">Something to do with your hands</h2>
        <div className="nw-prac">
          {list.map((p) => (
            <button key={p.id} type="button" className="nw-pbtn"
                    onClick={() => setPractice(p)}>
              <span className="nw-pmark" aria-hidden="true">{p.mark}</span>
              <span className="nw-ptxt">
                <b>{p.when}</b>
                <i>{p.length}</i>
              </span>
            </button>
          ))}
        </div>

        {/* ---------------- 3 · PEOPLE ---------------- */}
        <h2 className="nw-lbl">People</h2>
        <div className="nw-rows">
          <Link href="/meetings" className="nw-row">
            <b>A meeting running now</b>
            <i>Someone is always in one</i>
          </Link>
          <Link href="/friends" className="nw-row">
            <b>Say it in the room</b>
            <i>You don&apos;t have to explain the start</i>
          </Link>
          <Link href="/chat" className="nw-row">
            <b>Message somebody</b>
            <i>Goes straight to their inbox</i>
          </Link>
        </div>

        {/* ---------------- 4 · LAST, NOT FIRST ---------------- */}
        {/* 🔴 988 IS AT THE BOTTOM ON PURPOSE. Leading with a crisis
            line tells somebody having a rough Tuesday that the app
            thinks they are an emergency, and that is how you teach
            people not to open it. It is unmissable when it is needed
            and quiet when it isn't.

            ⚠️ tel: and sms: — a real dial, not a page about dialling.
            988 is the US Suicide & Crisis Lifeline and takes calls and
            texts. It is stated as what it is, with no promise about
            what happens on the other end. */}
        <a className="nw-988" href="tel:988">
          <b>988</b>
          <i>Call or text. Free, any hour.</i>
        </a>
      </div>
    </>
  );
}
