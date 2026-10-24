import './team-update.css';

/* =====================================================================
   A NOTE FROM THE TEAM, PINNED ABOVE THE WALL. 24 Oct (0191).

   Ty asked for a Sober Book profile that all updates would go through,
   looked at the prototype, and said: "It doesn't have to have a profile
   page. Just the pin whenever we do something new or something changes."

   ⭐ SO THERE IS NO ACCOUNT BEHIND THIS AND THAT IS THE DESIGN. An
   account would need a password two people share, would appear in the
   member count, would collect replies and friend requests nothing is
   listening to, and would give every reader a name to tap through to an
   empty page. All of that is machinery built to hold one sentence.

   ⚠️ THE NAME IS NOT A LINK, on purpose. There is nowhere for it to go,
   and a name that looks tappable and is not reads as broken. If a
   profile page is ever wanted, this is where the link gets added — not
   before.

   ⚠️ IT RENDERS NOTHING WHEN THERE IS NOTHING. No empty card, no "no
   updates yet". The wall on a quiet week is byte-for-byte the wall it
   was before this shipped.
   ===================================================================== */
export default function TeamUpdate({ update }) {
  const body = update && typeof update.body === 'string' ? update.body.trim() : '';
  if (!body) return null;

  return (
    <article className="tupd" aria-label="Update from the Sober Book team">
      <div className="tutag">
        <span className="tupin" aria-hidden="true">📌</span>
        <span>From the team</span>
        <span className="tuwhen">{when(update.created_at)}</span>
      </div>
      <div className="tubody">
        <div className="tuwho">
          <span className="tuav" aria-hidden="true">🌱</span>
          <span className="tuname">
            Sober Book
            {/* The seal. Deliberately NOT the gold check verified people
                wear — see the note in components/ArtistCheck.jsx. If the
                company wore the same mark, "verified" would stop meaning
                a person we checked. */}
            <svg className="tuseal" viewBox="0 0 24 24" role="img"
                 aria-label="Official Sober Book account">
              <title>Official</title>
              <circle cx="12" cy="12" r="11" />
              <path d="M7 12.4l3.3 3.3L17.3 8.5" />
            </svg>
          </span>
        </div>
        {/* ⚠️ Plain text in a <p>, never dangerouslySetInnerHTML. This
            string is typed into an admin box and rendered on 449
            people's wall; the day it accepts markup is the day the wall
            has an injection point on it. Line breaks survive through
            `white-space: pre-line` in the stylesheet instead. */}
        <p className="tutext">{body}</p>
      </div>
    </article>
  );
}

/* Same shape of answer the rest of the wall gives — "2h ago", not a
   timestamp nobody reads. */
function when(iso) {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : days + 'd ago';
}
