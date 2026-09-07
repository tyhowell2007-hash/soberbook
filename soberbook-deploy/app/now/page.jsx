import { redirect } from 'next/navigation';
import { serverClient } from '../../lib/supabase-server';
import Now from './Now';

export const dynamic = 'force-dynamic';

/* =====================================================================
   RIGHT NOW — the door for the worst ten minutes.  7 Sept.

   ⭐ THE DESIGN IS THE ORDER, AND IT IS THE OPPOSITE OF EVERY OTHER APP.
   Breathing exercises and a crisis number go LAST here, because they
   are what somebody scrolls past — generic advice from a stranger, at
   the moment a person is least able to be told things by strangers.

   YOUR OWN PLAN GOES FIRST. "Call Sam. Leave the house. Get in the car
   and drive." Written by them, on a calm afternoon, handed back at 3am.
   Nobody else could have written those three lines and no algorithm
   could have guessed them.

   ---------------------------------------------------------------------
   🔴 NOTHING ON THIS PAGE IS RECORDED. THAT IS A HARD RULE.

   No table, no insert, no counter, no "you opened this 4 times this
   week", no streak, no notification, and nothing in localStorage. The
   only database call is my_plan(), which is a READ of the member's own
   row.

   A record of who sat down at 3am craving can leak, can be subpoenaed,
   can be seen over a shoulder, and can quietly become a number that
   somebody feels judged by. It can be none of those things if it does
   not exist. This is the same stance as the five practices in /quiet,
   which have no table and never will.

   ⚠️ SO DO NOT ADD ANALYTICS HERE. Not "how many people use the SOS
   button", not aggregate, not anonymised. The aggregate is built from
   rows, and the rows are the thing we are refusing to create.

   ---------------------------------------------------------------------
   ⚠️ NO PUSH, NO NUDGE, NO FOLLOW-UP. 130 members were emailed "no
   reminders, no streaks, no nudges to come back" on 31 Aug. An app that
   messages you the next morning because you opened the panic button has
   broken that sentence and told you it was watching.

   ⚠️ AND IT NEVER TELLS ANYBODY ELSE. There is no "your friend needs
   support" alert. That would publish the single most private moment a
   member has, to people they did not choose in that moment — and it
   would stop anyone opening it twice.
   ===================================================================== */

export const metadata = {
  title: 'Right now · Sober Book',
  robots: { index: false, follow: false },
};

export default async function NowPage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  /* 🔴 FETCHED ON THE SERVER, NOT IN AN EFFECT. This is the one page in
     the app where a spinner is unacceptable: the whole promise is that
     the member's own words are already on screen when it opens. A
     client-side fetch means the first thing somebody in trouble sees is
     an empty box, and the second thing is generic advice arriving
     first because it needed no network.

     ⚠️ Failure is SILENT and the page still draws. If the database is
     unreachable, the practices and the phone number still work — they
     are static. A page that refuses to render because a query failed is
     the worst possible behaviour for this particular screen. */
  let plan = null;
  try {
    const { data } = await supabase.rpc('my_plan');
    plan = Array.isArray(data) ? data[0] : data;
  } catch { /* draw the rest anyway */ }

  return <Now plan={plan || null} />;
}
