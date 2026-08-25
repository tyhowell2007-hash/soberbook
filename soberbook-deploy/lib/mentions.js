/* =====================================================================
   FINDING @NAMES IN WHAT SOMEBODY TYPED (0067, revised).

   Ty: "when you tag somebody, all you should have to do is put in @ before
   their name", and "the tagging process should work like Facebook."

   ---------------------------------------------------------------------
   🔴 WHY A REGEX CANNOT DO THIS, AND WHY THAT'S FINE.

   A handle is one word, so /@(\w+)/ finds it. A NAME has spaces:

       @Nic Rossiter and I went to a meeting

   Where does the name stop? "Nic"? "Nic Rossiter"? "Nic Rossiter and"?
   There is no answer in the text — the text is genuinely ambiguous, and
   every heuristic for it ("stop at two words", "stop at a capital") is
   wrong for somebody.

   ⭐ SO DON'T PARSE. LOOK UP. You have a handful of friends and we know
   all their names, so this scans for "@" followed by ANY name or handle
   on your own friends list, LONGEST FIRST. "Nic Rossiter" wins over "Nic"
   because it is on the list and it is longer. It stops being a parsing
   problem and becomes a match against a known set.

   ⚠️ Longest-first is load-bearing. Shortest-first tags "Nic" and leaves
   "Rossiter" sitting in the sentence as stray text.

   ---------------------------------------------------------------------
   🔴 TWO FRIENDS WITH THE SAME NAME.

   Handles are unique — there is a case-insensitive unique index. Display
   names are not, and never can be. So if two of your friends are both
   called Dave, "@Dave" is ambiguous, and tagging the wrong person in a
   recovery app is not a cosmetic mistake.

   Ambiguous names are therefore matched by NOBODY. The composer says so
   and asks for the handle, which is always unique. Refusing to guess is
   the whole point.
   ===================================================================== */

/** Build the lookup once per keystroke-batch, not per candidate. */
export function buildIndex(friends) {
  const byKey = new Map();      // lowercased label -> handle | AMBIGUOUS
  const add = (label, handle) => {
    if (!label) return;
    const k = label.toLowerCase();
    if (byKey.has(k) && byKey.get(k) !== handle) byKey.set(k, null); // ambiguous
    else byKey.set(k, handle);
  };
  for (const f of friends || []) {
    add(f.handle, f.handle);
    /* ⚠️ Only if it differs from the handle, so "@rossiter125" doesn't
       get counted as two separate labels for the same person. */
    if (f.display_name && f.display_name.toLowerCase() !== f.handle.toLowerCase()) {
      add(f.display_name, f.handle);
    }
  }
  /* Longest first — see the note above. */
  const labels = [...byKey.keys()].sort((a, b) => b.length - a.length);
  return { byKey, labels };
}

/** Every @label in `text` that resolves to a friend, plus the ambiguous ones. */
export function findMentions(text, index) {
  const found = [];      // { label, handle, start, end }
  const ambiguous = [];  // labels matching more than one friend

  /* 🔴 EVERY KEY, EVERY TIME. This early return used to hand back
     { found, ambiguous } and nothing else — so on an empty composer
     `unmatched` was undefined, and the caller's unmatched.filter() threw
     and took the whole wall down with a white screen.

     ⚠️ The tests never caught it because every case had text in them. A
     function with two exits must return the same SHAPE from both, or the
     rarely-taken one is a trapdoor. */
  if (!text || !index) return { found, spans: [], ambiguous, unmatched: [] };

  const lower = text.toLowerCase();
  let i = 0;
  while (i < text.length) {
    const at = text.indexOf('@', i);
    if (at === -1) break;

    /* ⚠️ An @ must start a word. Without this, ty@gmail.com tags
       @gmail — and email addresses in posts are common. */
    const before = at === 0 ? '' : text[at - 1];
    if (before && /[\w@]/.test(before)) { i = at + 1; continue; }

    let hit = null;
    for (const label of index.labels) {
      if (lower.startsWith(label, at + 1)) {
        /* ⚠️ And it must END on a word boundary too, or "@Nic" would
           match inside "@Nicholas". */
        const after = text[at + 1 + label.length];
        if (after && /\w/.test(after)) continue;
        hit = label;
        break;
      }
    }

    if (!hit) { i = at + 1; continue; }

    const handle = index.byKey.get(hit);
    if (handle === null) ambiguous.push(text.slice(at + 1, at + 1 + hit.length));
    else found.push({ label: text.slice(at + 1, at + 1 + hit.length), handle,
                      start: at, end: at + 1 + hit.length });
    i = at + 1 + hit.length;
  }

  /* One tag per person however many times you wrote them. */
  const seen = new Set();
  const unique = found.filter((m) => (seen.has(m.handle) ? false : seen.add(m.handle)));

  /* 🔴 @WORDS THAT MATCHED NOBODY.
     Ty typed "@jordancruz" — a typo for @jordanxcruz, who is also not one
     of his friends — and got total silence: nothing blue, nothing said, no
     reason to think anything was wrong until he checked the database.

     ⚠️ That is precisely the failure this design was supposed to prevent.
     A handle that looks fine and quietly does nothing is worse than a
     refusal, because a refusal at least tells you where you stand. */
  const unmatched = [];
  const RAW = /(^|[^\w@])@([A-Za-z0-9_]{2,30})/g;
  let r;
  while ((r = RAW.exec(text)) !== null) {
    const word = r[2];
    const at = r.index + r[1].length;
    const covered = found.some((m) => at >= m.start && at < m.end);
    if (!covered) unmatched.push(word);
  }

  return { found: unique, spans: found,
           ambiguous: [...new Set(ambiguous)],
           unmatched: [...new Set(unmatched)] };
}

/* ---------------------------------------------------------------------
   THE FACEBOOK BIT: what is being typed right at the caret.

   ⚠️ Ty rejected the first build — "I don't want the names to pop up
   underneath" — and then asked for Facebook's behaviour. Those are not in
   conflict: what he refused was a full friend list sitting open before
   he'd typed anything. Facebook shows a SHORT, FILTERED list only after
   an @ and only while you're inside the word. That is what this returns.

   Returns null when there is nothing to offer, which is most of the time
   — and "most of the time there is no menu" is the entire difference.
   --------------------------------------------------------------------- */
export function activeQuery(text, caret) {
  if (!text) return null;
  const upto = text.slice(0, caret);
  const at = upto.lastIndexOf('@');
  if (at === -1) return null;

  const before = at === 0 ? '' : upto[at - 1];
  if (before && /[\w@]/.test(before)) return null;

  const typed = upto.slice(at + 1);
  /* ⚠️ A name may contain ONE space ("Nic Rossiter") but a run of them
     means the person stopped naming somebody and carried on writing.
     Without this the menu hangs around for the rest of the sentence. */
  if (/\s{2,}|[\n\r]/.test(typed)) return null;
  if (typed.length > 40) return null;

  return { at, typed };
}

/** Friends worth offering for what's been typed so far. */
export function suggest(friends, typed, limit = 6) {
  const t = (typed || '').toLowerCase();
  const scored = (friends || []).map((f) => {
    const h = f.handle.toLowerCase();
    const n = (f.display_name || '').toLowerCase();
    /* Rank: name-starts-with beats handle-starts-with beats contains.
       ⚠️ Somebody typing "@ni" means a person, not a username, far more
       often than the reverse. */
    let score = -1;
    if (n && n.startsWith(t)) score = 0;
    else if (h.startsWith(t)) score = 1;
    else if (n && n.includes(t)) score = 2;
    else if (h.includes(t)) score = 3;
    return { f, score };
  }).filter((x) => x.score >= 0);

  scored.sort((a, b) => a.score - b.score
    || (a.f.display_name || a.f.handle).localeCompare(b.f.display_name || b.f.handle));
  return scored.slice(0, limit).map((x) => x.f);
}
