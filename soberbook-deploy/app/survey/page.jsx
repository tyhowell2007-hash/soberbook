import { redirect } from 'next/navigation';
import { serverClient } from '../../lib/supabase-server';
import Form from './Form';

export const dynamic = 'force-dynamic';

/* =====================================================================
   THE SURVEY.

   Kenny Kerns, 2 Sept 2026: send everyone a survey, say plainly that
   we're new and still designing, ask what would keep them involved.

   The numbers that make it worth doing: 172 members, 34 have ever
   posted or replied or spoken in the room, 138 never said anything.
   Nobody has asked them why.

   🔴 SIGNED IN ONLY, AND THE ROW STILL RECORDS NOTHING ABOUT WHO.
   Those two facts look contradictory and aren't. The session proves the
   answer came from a member rather than the open internet; survey_submit
   then checks auth.uid() and throws it away. survey_responses has no
   author column to put it in — see 0110. A member who writes "I was
   worried somebody would recognise me" must not have that sentence
   stored next to their name, and the only reliable way to guarantee it
   is to have nowhere to store it.
   ===================================================================== */
export default async function SurveyPage() {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <Form />;
}
