# Wall ridgeline — where this got to
5 Oct 2026. **Nothing is shipped.** No code is on GitHub, no CSS is in the app.

## What was decided
The picture is the **background of the wall**, from the "Right now" bar
downward. The masthead keeps its own colours. The two bars keep their mint.
The footer keeps its green. Cards stay opaque and sit on top. The picture is
**fixed**, so the feed scrolls over a backdrop that stays put — and the four
figures come in behind the posts as you scroll down, which is the best
accident in the whole thing.

**Wash: 30%** is the pick. 18% has the ridges competing with the cards;
42% washes out to beige and loses the sun.

**Wall only.** Not /chat, /me, the rooms or anywhere else.

## The files
    artwork/ridge.py        generates the SVG — edit this, not the SVG
    artwork/ridge.svg       the artwork, 36KB, inline, no image file
    artwork/ridge-artwork.png   what it looks like on its own
    prototypes/phone-wall-with-ridgeline.html   the real structure at phone width
    prototypes/explorer-glass-and-layouts.html  the earlier glass/layout explorer
    screenshots/            phone renders at a true 390x844
    wall-ridgeline.css      the EARLIER band version — superseded, see below

## How the artwork is drawn
Seven ridges, each a summed-sine profile converted to bezier curves, so
crests roll instead of kinking and no two repeat. Each layer a little darker
and more opaque than the one behind, with a warm haze band hugging its base —
the haze is what creates distance, and the first version had none.

`ridge.py` regenerates it. Three octaves at roughness 0.34 keeps the forms
broad and calm; five octaves gave spiky alpine peaks that fought Ty's flat
style. Film grain via an SVG turbulence filter was tried and **removed** — it
turned the whole sky muddy brown and looked like a deliberate sepia choice
rather than a mistake.

## What is NOT done
* **The black theme.** None of this exists there — it would be the plain dark
  wall. Needs its own dusk artwork and its own wash value; light-theme numbers
  do not transfer.
* **"Your story"** now sits on open sky with no card behind it. Legible over
  the gold, would go soft over a ridge. Needs a text-shadow, measured the same
  way the bars were.
* **prefers-reduced-transparency** is not handled.
* **Not verified on a real phone.** Chrome would not resize below 1344px, so
  the phone views are a faithful rebuild at 390px — real structure, real
  measured heights (masthead 71, bars 50 and 53, stories 98, artists 229) —
  not the live page. The desktop screenshot of the real wall was live.

## Superseded
`wall-ridgeline.css` is the earlier **232px band behind the chrome** approach,
from before Ty said he wanted the picture as the wall's background from the
Right now bar down. Its measurements are still good and worth keeping — the
71% white figure in it was solved, not guessed: at 30% the bar text falls to
2.65:1 over a dark ridge, 51% is the 4.5 minimum, 71% gives 7.13:1.

The new approach needs no glass on the bars at all, because they keep their
own opaque mint. So those numbers are reference, not requirements.

## Next session
Pick up by opening `prototypes/phone-wall-with-ridgeline.html`. To ship it,
the CSS needs writing fresh for the background approach — scoped with
`:has(.wall)` the same way, which is what keeps it off every other page.

---

# 7 Oct — Ty's second pass. Still nothing shipped.

Ty asked for three things: the bottom of the picture to end **at the people**,
and more **mountain**, **sun** and **sky**.

`prototypes/phone-wall-ridgeline-v2-dials.html` is that, with live dials.

## What changed
* **The picture now stops at the top of the tab bar** (`bottom: <tabs height>`),
  so the four figures stand on the footer instead of having their legs cut off
  behind it. Toggle in the dials if he wants it back under.
* **The frame is cut to the shape of the space it sits in.** The SVG viewBox
  height is computed at runtime as `900 * boxHeight / boxWidth`, so the picture
  fills the wall exactly: nothing cropped off the sides any more (the 5 Oct
  version lost ~84px of ridge width to a `cover` crop) and no bars.
  That is where "more mountain" came from.
* **The sun is its own element now**, outside the translated ridge group, with
  its own y and radius. At 5 Oct values it sat at y 690 and was buried behind
  the artists strip — invisible at rest. Default is now **y 380**, which puts it
  in the "Your story" band, the one strip of picture no card covers.
* **Sky**: the ridge stack is pushed down inside the taller frame
  (`shift = frameHeight - 1456 + sky`), which opens sky above the crests.
* Wash default **24%**, down from 30 — he wanted to see more of it.

## 🔴 The bug this pass found
`.wallbg` was a child of `.app`, the scrolling container. At ≥760px it is
`position:absolute`, and **an absolute layer inside a scroller scrolls away with
the content** — the exact thing the comment in the file warns about. The desktop
mock was therefore lying: scroll down and the picture slid off. Moving `.wallbg`
to be a sibling of `.app` inside `.phone` fixes it, and now the figures really do
rise behind the posts. Keep it a sibling when this is written for real.

## Verified, with a control
Rendered headless at 1240x940 and at a true 420x900, top and scrolled. The check
"the picture is actually painted" was proved able to fail by setting `--art:none`
and confirming the sampled pixel changed. Google Fonts do load in that renderer.

## Still not done
Unchanged from 5 Oct: **the black theme**, the **"Your story"** text-shadow,
`prefers-reduced-transparency`, and **it has still never been on a real phone**.

## 7 Oct, later — glass cards

Ty: "from the boxes starting at the artist on sober book down. Make them all
somewhat see-through." So the 5 Oct decision that **cards stay opaque is
overruled** — from the artists strip downward they are glass.

* `.strip .row`, `.strip .a`, `.card`, `.post` → `rgba(255,255,255,var(--glass))`
* `.strip h2` (the dark green bar) → `rgba(20,64,47, glass*.9 + .1)`
* `backdrop-filter: blur(13px) saturate(1.06)` on `.strip`, `.card`, `.post`.
  The blur is doing the heavy lifting on legibility — without it these numbers
  would not pass.
* **Untouched**, as he asked: the masthead, both mint bars, "Your story".
* `prefers-reduced-transparency` now returns every one of them to solid and
  drops the blur. That ticks one of the three outstanding items.
* Default **28% see-through**. New dial in the panel, 0–70%.

### Contrast, measured not guessed
Rendered at a true 420x900, scrolled to the bottom so the darkest ridge runs
under the last post, then took the 15th-percentile luminance of the card surface
against the body text #1C2320:

    20% -> 12.05   28% -> 10.68   35% -> 9.52   40% -> 8.76
    45% ->  8.04   50% ->  7.40   55% -> 6.76   65% -> 5.55

All above the 4.5 minimum, which is why the dial goes to 70. **Control:** at 90%
it falls to **3.28** and fails — so the check can fire. Without that control the
whole table would have been worthless.

### Pushed to 58%, and what that turned up

🔴 **The body text was never the thing that breaks. The small grey text is.**
`--soft` is `#63716A`, and on a solid white card that is only **5.12:1** — it had
almost no headroom to start with. The moment a card goes see-through at all, the
timestamps ("5h"), "2 replies" and the artist genre lines fall under 4.5, while
the body text is still sitting at 12:1. At 20% glass the grey is already 3.85.

So `--soft` is now **computed from the dial**, not fixed. `softFor(glass)` reads
the measured worst-case card surface, works out the luminance that lands 4.7:1
(4.7, not 4.5, so 8-bit rounding still clears the floor), and walks `#63716A`
toward black along its own hue until it hits it:

    dial    0%   20%   44%   58%   70%
    grey  #63716A #576360 #40494 5 #323935 #22272 5   (rgb values in the readout)

Measured end to end at a true 420x900, scrolled so the darkest ridge is under the
last post, with the type hidden so what is measured is the card surface itself
and not glyph pixels:

    dial  surface   body   grey(auto)   CONTROL grey left at #63716A
      0%   1.000   16.02       5.12            5.12
     20%   0.740   12.05       4.72            3.85
     44%   0.484    8.15       4.73            2.61
     58%   0.364    6.32       4.67            2.02
     70%   0.277    4.99       4.72            1.60

**Control:** leaving the grey at `#63716A` fails at every dial position above 0.
Also ⚠️ the first run of this measurement was wrong — the sample box included the
card's 14px rounded corners, so the "surface" was really the picture showing
through the corner, and a solid white card read 0.682 instead of 1.000. Inset
past the radius before trusting any of these numbers.

The tab bar keeps the original `#63716A`: it has its own near-opaque white and is
not over the picture.

**This is the real ceiling.** Past ~70% the grey has to go as dark as the body
text and the hierarchy collapses — not because the picture is too strong, but
because the secondary grey was already at the edge on white.

## 🔴 WALL ONLY — and the prototype's class names are not the app's

Ty, 7 Oct: "this is only for the wall." Confirmed and unchanged from 5 Oct.
Two things checked in `soberbook-deploy`, not assumed:

**1. Every class name in the prototype is invented.** `.strip`, `.card`, `.post`
do not exist on the wall. Writing the CSS against them would commit fine, build
green and change nothing on the page. The real ones:

| prototype | the app | where it is rendered |
|---|---|---|
| `.strip` | `.art-strip` / `.art-band` / `.art-cards` / `.art-card` | `components/ArtistStrip.jsx`, imported only by `wall/page.jsx` |
| `.card` (seasons) | `.sea` (+ `.sea-h`, `.sea-sub`, `.sea-pick`, `.sea-opt`) | `wall/Seasons.jsx`, imported only by `wall/page.jsx` |
| (content cards) | `.cc` (+ `.ccflyer`, `.ccpin`, `.ccnoimg`) | `components/ContentCard.jsx`, rendered only from `wall/Wall.jsx` |
| `.post` | `article.item` | `wall/Wall.jsx`, inside `<div className="wall">` |

**2. `.wall` is not an ancestor of everything that has to go glass.**
`<div className="wall">` (Wall.jsx:1689) wraps only the posts and the content
cards. The artists strip and Seasons are rendered by `wall/page.jsx` ABOVE it,
so `.wall .art-strip` would never match. So:

    .wall .item        posts
    .wall .cc          content cards and ads
    body:has(.wall) .art-strip   artists strip
    body:has(.wall) .sea         seasons

**⚠️ `.item` is the one that genuinely leaks.** It is also used by
`components/StoryRail.jsx` — which renders on the wall, above `.wall` — and by
`readings/Readings.jsx`. Unscoped, glass would land on the story rail and on
every row of /readings. `.wall .item` excludes both. `.art-strip`, `.sea` and
`.cc` appear nowhere else in `app/`, checked by grep; the `:has(.wall)` on the
first two is belt-and-braces in case those components are ever reused.

Nothing else moves: not /chat, /me, /friends, the rooms, /meetings, /readings.

## 7 Oct — type, and a correction to the prototype

🔴 **The prototype had the wrong body font all along.** It set everything in
Archivo. The app does not: Archivo was pulled from the Google Fonts URL in
`app/layout.jsx` on **31 Aug, Ty's call**, after looking at what Facebook does —
the feed is set in the reader's own system font. The comment in layout.jsx is
worth re-reading; the fix edited no CSS at all, because all 50+ rules were
written `'Archivo', system-ui, sans-serif` and the fallback did the work.

So the prototype now ships what members actually see:

    body / posts   system-ui, -apple-system, Segoe UI, Roboto
    masthead, h    'Anton'            (--disp, new var)
    timestamps     'Courier Prime'    (--mono)

Three pickers in the dials, live:

* **Posts and body** — device font (today) · Archivo · Inter · Figtree ·
  Source Sans 3 · Nunito Sans
* **Masthead and headings** — Anton (today) · Bebas Neue · Oswald ·
  Archivo Black · Alfa Slab One · Fraunces (already in the app, on the door)
* **Timestamps and labels** — Courier Prime (today) · Space Mono ·
  JetBrains Mono · IBM Plex Mono · device mono

### 🔴 The probe, and the bug in the first version of it
A webfont that fails to load falls back silently and every option looks the
same — this project has been fooled by exactly that before. So the page measures
a test string in the chosen family and reports in the panel whether it is really
loading.

**The first version of that probe was wrong and said "all loading" in a renderer
where almost nothing was.** It compared e.g. Anton (which falls back to *Impact*)
against a nonsense face falling back to *serif* — two different widths whether or
not Anton ever arrived. The control must carry the SAME fallback chain, so it now
swaps only the first family and keeps the rest. After the fix it correctly flags
Bebas Neue as not loading in the sandbox.

⚠️ **Measured in the headless renderer here: Anton and Courier Prime load;
Archivo, Inter, Figtree, Source Sans 3, Nunito Sans, Bebas Neue, Oswald,
Archivo Black, Alfa Slab One, Fraunces, Space Mono, JetBrains Mono and IBM Plex
Mono do NOT.** So the font comparison cannot be judged from anything rendered in
this sandbox. It has to be looked at in Ty's own browser, where the panel's note
will say whether what he is seeing is real. Chrome was unreachable at the time of
writing, so that check is still outstanding.

### Correction — Google Fonts DO load in the sandbox

The paragraph above saying only Anton and Courier Prime load **was wrong**, and
it was wrong because of a bad test, not a bad renderer. The first probe reused a
single `<span>`, set `font-family` and measured in a tight loop before
`document.fonts.ready`, and every family — including a deliberately fake one —
came back at exactly 597.3px. That looked like the known "Google Fonts do not
load here" symptom, so it got believed.

Rebuilt properly (per-element spans, after `document.fonts.ready`, each family
against a control carrying the SAME fallback chain) **all 26 families load and
render distinctly**, confirmed by eye in a headless screenshot: Archivo, Inter,
Figtree, Source Sans 3, Nunito Sans and Public Sans all break the same sentence
at different points, and the ten display faces are plainly ten different faces.

⚠️ Worth keeping: the symptom "every font measures identically" has now had
**two** causes in this project — fonts genuinely not loading, and a measurement
taken too early. Check which one before concluding.

### `prototypes/wall-type-specimens.html` — the specimen sheet

Ty, 7 Oct: "I want to look at different fonts for all of those." One page, three
sections, each face doing its real job at its real size:

* **Posts and body** (16px) — device font (ships today) · Archivo · Inter ·
  Figtree · Source Sans 3 · Nunito Sans · Public Sans · Work Sans · Rubik · Karla
* **Masthead and headings** — Anton (ships today) · Bebas Neue · Oswald ·
  Archivo Black · Barlow Condensed · Staatliches · Chivo · Alfa Slab One ·
  Fraunces · Instrument Serif
* **Timestamps and labels** — Courier Prime (ships today) · Space Mono ·
  JetBrains Mono · IBM Plex Mono · DM Mono · Roboto Mono · Azeret Mono ·
  device mono

Green outline = what ships today. Every row carries a live loading chip and the
page reports the total at the top, so a silent fallback cannot pass itself off
as a typeface. Awaiting Ty's pick of one per role.

## Type: option 05 — Ty's pick, 7 Oct

Ty rejected the first two cuts, then sent a screenshot of another recovery app's
community feed and said: use that, with more bite. **Reading the reference
honestly, its punch is not the typeface** — it is (a) much larger body text,
(b) one family for everything including the timestamps, and (c) a dark ground.
Five complete systems were built on that structure; he chose 05.

    body      'Plus Jakarta Sans', system-ui, -apple-system, sans-serif
    display   'Anton', Impact, sans-serif        (masthead + card headings)
    mono      'Courier Prime', ui-monospace      (day count, kicker, timestamps)

**And the scale, which is half of what option 05 is:**

    post body   14px  ->  18.5px / line-height 1.42
    name        13.5  ->  16px, weight 700, -.005em
    timestamp   10.5  ->  11px mono, +.04em
    post meta   11.5  ->  13px

The bite is the collision: the reference's big clean posts under a wordmark that
is still yelling in Anton with a Courier day count beside it. The other four
options made Sober Book look like a well-made app; this one keeps what the app
already is. Anton and Courier Prime stay, so nothing is lost from layout.jsx.

⚠️ **The trade, and it is real:** at 18.5px only one post clears the fold on a
390px phone where two used to. 106 of 146 members have never posted or scrolled
(see the comment in Wall.jsx) — fewer posts above the fold is a live risk for
exactly those people, and worth watching after it ships rather than assuming.

⚠️ The reference was **dark** and option 05 was shown on dark. The wall
prototype is the light theme, so part of what he liked there is still unbuilt.
The black theme remains the biggest open item.

### The ARTISTS bar — Anton. Ty's pick, 7 Oct (row 2 of eight)

`.art-band` / `.strip h2` moves off Courier Prime and onto the masthead face:

    font-family   'Anton', Impact, sans-serif
    font-size     13.5px      (was 10.5px — Anton needs the size)
    font-weight   400
    letter-spacing .07em      (was .12em — Anton is already tight and tall)

⚠️ **Each candidate carried its own size/weight/tracking, deliberately.**
Dropping a display face into Courier's 10.5px/.12em slot reads as a mistake
rather than a choice; the eight in `screenshots/artists-bar-eight-ways.png` are
each set the way that face wants to be set, which is the only fair comparison.

🔴 **The Hide button is pinned to the body font now.** Bebas Neue and
Staatliches have no lowercase, so letting the button inherit the bar's face
turned "Hide" into "HIDE". `.strip h2 .hide` takes `var(--body)` at 10px/600.
Keep that when this is written for real — it is not cosmetic, it is the
difference between a button and a shout.

⚠️ Also worth recording: the first composite of those eight was **stale**. The
render script was piped through `head -4`, node took SIGPIPE on its fourth
`console.log` and died before writing images 2–7, so the contact sheet mixed new
and old frames and appeared to show the Hide fix failing. Never pipe a script
that writes files through `head`.
