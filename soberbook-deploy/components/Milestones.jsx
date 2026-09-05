import { progress, chipRow } from '../../lib/milestones';

/* =====================================================================
   The count, the bar, and the chips.

   WHAT THIS FIXES ABOUT THE OLD COUNT BLOCK: it was a number with
   nothing around it. 881 is a fine number, and it is also completely
   flat — it doesn't say whether you're near anything, and on a hard day
   a bare number is just a number. The bar and the chips give it a
   direction without turning it into a game.

   WHY THE BAR MEASURES THE GAP AND NOT THE WHOLE JOURNEY: see
   lib/milestones.js. Short version — a bar from day zero sits at 97%
   forever once you've got real time, which is both useless and vaguely
   flattering. Between two chips it moves in a week.

   ⚠️ NO SHAME STATES. There is no red, no "you were closer last time",
   no broken chip. The row shows what you've earned and the one you're
   walking toward, and that is all it is ever allowed to show.
   ===================================================================== */
export default function Milestones({ since, days, sub, small = false }) {
  const p = since ? progress(since) : null;
  const chips = since ? chipRow(since) : [];

  return (
    <>
      <div className={'count' + (small ? ' small' : '')}>
        {days === null || days === undefined ? (
          <>
            <div className="cn">—</div>
            <div className="cl">no date set yet</div>
          </>
        ) : (
          <>
            <div className="cn">{days.toLocaleString()}</div>
            <div className="cl">{sub}</div>

            {p && p.next && (
              <>
                {/* role="img" with one label, rather than a progressbar
                    role: a screen reader should hear "214 days to your
                    3-year chip", not "41 percent". The sentence is the
                    information; the bar is the decoration. */}
                <div className="mbar" role="img"
                     aria-label={p.next.daysAway + ' days to your ' + p.next.full + ' chip'}>
                  <span className="mfill" style={{ width: p.pct.toFixed(1) + '%' }} />
                </div>
                <div className="mnext" aria-hidden="true">
                  {p.next.daysAway.toLocaleString()}{' '}
                  {p.next.daysAway === 1 ? 'day' : 'days'} to your {p.next.full} chip
                </div>
              </>
            )}
          </>
        )}
      </div>

      {chips.length > 0 && (
        <ul className="chips">
          {chips.map((mk) => (
            <li key={mk.key}
                className={'chip' + (mk.earned ? ' on' : ' next')}
                /* The visible text is "6 mo"; the read-out is
                   "6 months, earned". Abbreviations are for eyes. */
                aria-label={mk.full + (mk.earned ? ', earned' : ', next')}>
              <span aria-hidden="true">{mk.label}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
