import SongPlayer from '../../components/SongPlayer';
import { normaliseSections } from '../../../lib/look';

/* The "About" tab of a member profile (22 Sept, Ty's option 2).

   Server-side on purpose — no 'use client'. Used by the public profile
   (/u/[handle], MemberProfile) and by your own page (/me, MeProfile), and
   in BOTH cases `p` is a public_profiles row: your own page shows you
   exactly what other members see, never your raw settings.

   Returns null when there is nothing to show, and ProfileTabs then draws
   no tabs at all. */
export function aboutPane(p, song, autoplay) {
  /* ---- About (22 Sept, option 2) ----
     Everything here is exactly what public_profiles already hands a
     visitor — the view nulls prose on anonymous profiles and gates
     sponsor_looking by the VIEWER's time, so this component shows what
     arrives and decides nothing. Blank fields render nothing: no gap, no
     "nothing here" line.
     ⚠️ Song and lifetime total honour the member's own switches in
     `sections` (0182). If somebody turned their song off, it stays off. */
  const shown = Object.fromEntries(normaliseSections(p.sections).map((r) => [r.k, r.on]));
  const showSong = !!song && shown.song !== false;
  const showTotal = !!p.total_days && shown.total !== false;
  const hasDeets = !!(p.sponsor_open || p.sponsor_has || p.sponsor_looking
    || p.programs || p.location || p.interests);

  return (p.bio || showSong || hasDeets || showTotal) ? (
    <div className="pabout">
      {p.bio && <p className="bio">{p.bio}</p>}

      {showSong && (
        <>
          <h2 className="sec">{p.is_mine ? 'Your song' : 'Their song'}</h2>
          <SongPlayer song={song}
                      whose={p.is_mine ? 'your song' : (p.display_name || p.handle) + '’s song'}
                      autoplay={!!autoplay} big />
        </>
      )}

      {hasDeets && (
        <div className="deets">
          {p.sponsor_open && (
            <div className="deet sponsor"><span className="di" aria-hidden="true">🛟</span><span>Available to sponsor</span></div>
          )}
          {p.sponsor_has && (
            <div className="deet"><span className="di" aria-hidden="true">🤝</span><span>Has a sponsor</span></div>
          )}
          {/* 🔴 No `!p.sponsor_has &&` guard and no placeholder: the
              view already hides this from members under a year, and the
              absence must look identical either way (see 0031). */}
          {p.sponsor_looking && (
            <div className="deet sponsor"><span className="di" aria-hidden="true">🔎</span><span>Looking for a sponsor</span></div>
          )}
          {p.programs && (
            <div className="deet"><span className="di" aria-hidden="true">🧭</span><span>{p.programs}</span></div>
          )}
          {p.location && (
            <div className="deet"><span className="di" aria-hidden="true">📍</span><span>{p.location}</span></div>
          )}
          {p.interests && (
            <div className="deet"><span className="di" aria-hidden="true">🎣</span><span>{p.interests}</span></div>
          )}
        </div>
      )}

      {showTotal && (
        <div className="total">
          <span className="tn">{p.total_days.toLocaleString()}</span>
          <span className="tl">days total, all of it</span>
        </div>
      )}
    </div>
  ) : null;
}
