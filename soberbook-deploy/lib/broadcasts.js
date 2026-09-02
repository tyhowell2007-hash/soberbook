import { tourEmail,   TOUR_BROADCAST_KEY }   from './broadcast-tour';
import { surveyEmail, SURVEY_BROADCAST_KEY } from './broadcast-survey';
import { tour2Email,  TOUR2_BROADCAST_KEY }  from './broadcast-tour2';

/* =====================================================================
   THE CAMPAIGN ALLOWLIST.

   ⭐ WHY A REGISTRY RATHER THAN A SECOND ROUTE. The send route already
   contains the only two things that really matter — claim-before-send,
   and a hard clamp on the batch size. Copying it for a second email
   would copy those, and the copy would drift. Same reason 0049 deleted
   a duplicated rule instead of updating it: when a rule is expressed
   twice, the second one is where the bug goes.

   🔴 THERE IS NO DEFAULT, ON PURPOSE. An unknown or missing name gets
   null and the route refuses. A default would mean that a stale call, a
   typo, or a half-finished script sends SOME email to real people — and
   the one failure this whole system exists to prevent is somebody
   getting mail they were promised they would not get.

   ⚠️ Adding a third email is one entry here. If you ever find yourself
   editing the route to add a campaign, something has gone wrong.
   ===================================================================== */
const CAMPAIGNS = {
  tour: {
    key:   TOUR_BROADCAST_KEY,
    build: tourEmail,
    label: 'The walkthrough film',
  },
  survey: {
    key:   SURVEY_BROADCAST_KEY,
    build: surveyEmail,
    label: 'The survey',
  },
  /* ⚠️ 'tour2' is a SEPARATE entry, not an edit of 'tour'. Changing the
     key on the existing entry would rewrite history: broadcast_progress
     would report the old campaign as never sent, and the 151 rows that
     stop those people getting a duplicate would stop matching anything.
     A campaign is append-only here for the same reason a migration is. */
  tour2: {
    key:   TOUR2_BROADCAST_KEY,
    build: tour2Email,
    label: 'The walkthrough, again (the length was wrong)',
  },
};

export function campaign(name) {
  if (!name || !Object.prototype.hasOwnProperty.call(CAMPAIGNS, name)) return null;
  return CAMPAIGNS[name];
}

export const CAMPAIGN_NAMES = Object.keys(CAMPAIGNS);
