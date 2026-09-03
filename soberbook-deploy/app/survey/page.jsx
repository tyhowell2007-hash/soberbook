import Form from './Form';

export const dynamic = 'force-dynamic';

/* =====================================================================
   THE SURVEY.

   Kenny Kerns, 2 Sept 2026: send everyone a survey, say plainly that
   we're new and still designing, ask what would keep them involved.

   The numbers that make it worth doing: 172 members, 34 have ever
   posted or replied or spoken in the room, 138 never said anything.
   Nobody has asked them why.

   🔴 THE ROW RECORDS NOTHING ABOUT WHO, AND THAT HAS NOT CHANGED.
   survey_responses has no author column — see 0110, on purpose. A member
   who writes "I was worried somebody would recognise me" must not have
   that sentence stored next to their name, and the only reliable way to
   guarantee it is to have nowhere to put it.

   ---------------------------------------------------------------------
   🔴 THE SIGN-IN GATE IS GONE — 3 Sept, and this reverses the line that
   used to sit here.

   It said: "the session proves the answer came from a member rather than
   the open internet." A fair reason, and it cost us the survey. 155
   emails went out carrying a bare `soberbook.app/survey` link. People
   read email on a phone, in a browser not signed into Sober Book, tapped
   it expecting four questions, and met a PASSWORD BOX. **One real answer
   from 155 sends**, sixty of which had been out overnight.

   ⭐ The old reason was about PROVENANCE — "came from a member" — not
   about holding a live session. A per-member token in the link proves
   exactly that and needs no wall. That is the right design and it is what
   the NEXT send should carry. It could not rescue this one: the 155
   already have a token-less link in their inbox.

   ⚠️ So the trade was made knowingly: a stranger can now add noise to the
   answers. 🔴 A stranger can never READ them — survey_counts and
   survey_text are still refused to anon, asserted in 0118. Vandalism is
   recoverable; somebody reading a member's most honest sentence is not.

   ⚠️ `/survey` must also be in the middleware's open list, or that
   redirects before this file is ever reached. Two gates, both needed.
   ===================================================================== */
export default async function SurveyPage() {
  return <Form />;
}
