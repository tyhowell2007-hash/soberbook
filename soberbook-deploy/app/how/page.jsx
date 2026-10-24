import Link from 'next/link';
import './how.css';

/* =====================================================================
   /how — HOW THIS WORKS.  23 Sept 2026.

   Ty: "There's a lot of people not understanding this app. And I can
   understand, with so much being packed into it. We need to make a
   professional tutorial on how to use this whole app for people that
   has never seen this."

   🔴 WHY A PAGE AND NOT ANOTHER VIDEO. The 3½ minute walkthrough already
   exists at /tour, it is already linked from More and from MastMenu, and
   it is good. What it cannot do is answer one question. Somebody who is
   sitting in the app right now wondering what the Front Room is will not
   scrub a video to find out — they will close the app. This page is the
   reference the video cannot be: skimmable, linkable, and searchable by
   eye in about four seconds.

   ⭐ THE FIRST CARD IS THE WHOLE PAGE FOR MOST PEOPLE. Four lines, and
   they can use Sober Book. Everything below it is there for whenever
   they want it, and somebody who never scrolls past the card has still
   got what they came for. Do not let that card grow.

   ⚠️ THE TWO KINDS OF PRIVACY GET THEIR OWN SECTION and it is not
   padding. A handle is not anonymity, and somebody who believes it is
   may post something they would never have posted. That confusion is
   the most expensive misunderstanding available on this app, so it is
   spelled out on its own rather than mentioned in passing.

   ⚠️ NO SCREENSHOTS, and that is deliberate. A screenshot of the wall
   freezes three members' real posts into a page every member can open,
   out of context, for as long as the page exists. Nothing on here shows
   anybody's words but ours.

   ⚠️ IF THIS PAGE MOVES OR IS RENAMED, FIX BOTH MENUS. The row lives in
   app/more/page.jsx AND app/components/MastMenu.jsx. A row in only one
   of them is the "everything built except the way in" bug.
   ===================================================================== */

export const metadata = { title: 'How this works · Sober Book' };

export default function HowPage() {
  return (
    <>
      <div className="mast">
        <Link href="/more" className="back" aria-label="Back to more">←</Link>
        <span className="lg">how this works</span>
      </div>
      <div className="bar">There is a lot in here. You do not have to learn it all.</div>

      <div className="pad hw-wrap">

        <p className="hw-lede">
          This page walks through every part of Sober Book, one at a time, in plain words.
          Read the first box and you know enough to use it today.
        </p>

        <div className="hw-first">
          <h2>The first five minutes</h2>
          <p className="hw-sub">If you only read this much, you are fine.</p>
          <ol className="hw-q">
            <li><span><b>Your handle is your name here.</b> Nobody sees your real one unless
              you put it there yourself.</span></li>
            <li><span><b>The wall is the front page.</b> Read it. Say something when you want
              to. Nobody asks you to explain yourself.</span></li>
            <li><span><b>The row of buttons at the bottom is the whole app</b> — Home, Chat,
              Meetings, People, You, More.</span></li>
            <li><span><b>Every post has a ⋯ on it.</b> That is where reply, report and block
              live. You are never stuck with something you do not want to see.</span></li>
          </ol>
        </div>

        <Link href="/tour" className="hw-tour">
          <span className="hw-tt">Would you rather watch it?</span>
          <span className="hw-ts">
            There is a walkthrough of the whole app — 3½ minutes, video, so not one for a
            tight data plan.
          </span>
        </Link>

        {/* ---------------------------------------------------------- */}
        <p className="hw-sec">The main screen</p>
        <h2 className="hw-h">The wall</h2>
        <p className="hw-note">Where everybody talks.</p>
        <p className="hw-p">
          This is what opens when you come in. People post how their day went, what they are
          struggling with, what they are proud of, or nothing to do with recovery at all. You
          can write, add a photo, or just read for a week first. Plenty of people do.
        </p>
        <div className="hw-do">
          <span className="hw-dot">To post</span>
          <ul>
            <li>Tap the <b>+</b> at the top of the wall</li>
            <li>Type. Add a photo if you want one</li>
            <li>Flip <b>Post anonymously</b> if you would rather your handle not show</li>
            <li>Tap Post</li>
          </ul>
        </div>

        {/* ---------------------------------------------------------- */}
        <p className="hw-sec">The two ways to be private</p>
        <h2 className="hw-h">Nobody has to know who you are</h2>
        <p className="hw-note">And they are two different things, which trips people up.</p>
        <p className="hw-p">
          <b>The first is your handle.</b> When you signed up you picked one. That is the name
          everyone sees — not your real name, unless you decide to put your real name in. You
          can use a photo, or pick an emoji instead of a photo.
        </p>
        <p className="hw-p">
          <b>The second is per-post anonymity.</b> Any single post can be sent with your handle
          hidden. It shows as <i>Anonymous</i> and something — Anonymous Sparrow, Anonymous
          Ember. Even people who know your handle cannot tell it was you. You can post normally
          for months and make one post anonymous on the hard day. That is what it is for.
        </p>

        {/* ---------------------------------------------------------- */}
        <p className="hw-sec">The number in the corner</p>
        <h2 className="hw-h">Your day count</h2>
        <p className="hw-note">The number that never resets.</p>
        <p className="hw-p">
          Set your date once and the app counts from it. It sits in the top corner of every
          screen. There is a second number underneath it — the days you have shown up here,
          which counts the days you turned up rather than the days you were perfect. That one
          does not go backwards.
        </p>
        <div className="hw-do">
          <span className="hw-dot">To set it</span>
          <ul>
            <li>Tap <b>You</b>, then <b>Edit your profile</b></li>
            <li>Put in your date. Change it whenever you need to — nobody is notified</li>
          </ul>
        </div>

        {/* ---------------------------------------------------------- */}
        <p className="hw-sec">Talking to one person</p>
        <h2 className="hw-h">Chat, and the rooms</h2>
        <p className="hw-note">Two different things behind the same button.</p>
        <p className="hw-p">
          <b>Chat</b> is one to one. You pick somebody and write to them, and nobody else can
          read it. That is where most of the real conversation on here happens.
        </p>
        <p className="hw-p">
          <b>Rooms</b> are group conversations that stay open. The Front Room is the main one,
          always there. There are others, including one for the families of people who are
          still using — because they need somewhere too.
        </p>

        {/* ---------------------------------------------------------- */}
        <p className="hw-sec">When you need a meeting at 3am</p>
        <h2 className="hw-h">Meetings</h2>
        <p className="hw-note">Online, any hour, join from where you are.</p>
        <p className="hw-p">
          These are real AA and NA meetings pulled from the public listings — not ours, and not
          run by us. Each one shows the time and has the dial-in number right there. Tap the
          number and your phone calls it. You do not have to register, and you do not have to
          speak.
        </p>

        {/* ---------------------------------------------------------- */}
        <p className="hw-sec">When you do not want to talk</p>
        <h2 className="hw-h">Quiet, and the readings</h2>
        <p className="hw-note">Two places with no conversation in them at all.</p>
        <p className="hw-p">
          <b>Quiet</b> is a page where people write down what gets them through — and nobody is
          allowed to reply. No comments, no arguing. You read it, or you add to it, and that is
          all that happens there.
        </p>
        <p className="hw-p">
          <b>The readings</b> are short, one a day. They are not preachy and they do not belong
          to any one program.
        </p>

        {/* ---------------------------------------------------------- */}
        <p className="hw-sec">Your corner</p>
        <h2 className="hw-h">Your own page</h2>
        <p className="hw-note">As much or as little of you as you want.</p>
        <p className="hw-p">
          Tap <b>You</b> to see what everyone else sees. There are two tabs on it: <b>Posts</b>,
          which is what you have written, and <b>About</b>, which is everything else — a line
          about yourself, a song you picked, what program you are in if you are in one, your
          town if you want it there, and whether you are looking for a sponsor or already have
          one. Every one of those is optional, and a blank one simply does not show.
        </p>

        {/* ---------------------------------------------------------- */}
        <p className="hw-sec">The rest of it</p>
        <h2 className="hw-h">Under More</h2>
        <p className="hw-note">The things you will want now and then.</p>
        <div className="hw-do">
          <span className="hw-dot">What is in there</span>
          <ul>
            <li><b>Dr. Labor&rsquo;s Recovery Map</b> — thousands of treatment centres, detox
              and sober living houses, searchable by state and town. Nobody paid to be on it</li>
            <li><b>Check in</b> — one tap, once a day, to say you showed up</li>
            <li><b>Gratitude, Tenth step, Your safety plan</b> — short things for your own day</li>
            <li><b>Ask Sage</b> — answers questions about how the app works. It is not a
              counsellor, and it never reads your posts or your messages</li>
            <li><b>Hotlines and help</b> — places that aren&rsquo;t us, that we do not run</li>
          </ul>
        </div>

        {/* ---------------------------------------------------------- */}
        <div className="hw-safe">
          <h2>If something is wrong</h2>
          <ul>
            <li><b>Every post, reply and message has a ⋯ on it.</b> Report and block are both
              in there. Blocking is immediate and you do not have to explain it to anyone.</li>
            <li><b>Reports go to a real person.</b> Not a robot, and not a queue somebody looks
              at next month.</li>
            <li><b>You can delete your account yourself, any time.</b> You &rsaquo; Edit your
              profile &rsaquo; Account &rsaquo; Delete your account. It happens straight away.</li>
            <li><b>Nobody sells your information.</b> There are no tracking pixels in this app.</li>
            <li><b>If something is broken</b>, <Link href="/support" style={{ color: 'var(--acid)' }}>
              tell Ty</Link>. A person reads it.</li>
          </ul>
        </div>

        <p className="hw-foot">
          Sober Book is peer support, not treatment. Nobody here gives medical advice, and
          nothing on this page is a substitute for a doctor. If you are in danger right now,
          call or text 988.
        </p>
      </div>
    </>
  );
}
