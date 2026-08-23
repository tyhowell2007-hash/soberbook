/* =====================================================================
   THE PARTS NOBODY PREACHES.

   Ty, Aug 22: "we need bible study as well... let's make it cool and
   hip. like, people want to do this and not doll and boring."

   ⭐ THE ANGLE, AND IT IS NOT A MARKETING LINE — IT IS JUST TRUE.

   The Bible is far more brutal than the version most people were handed
   in church. It got laundered. Elijah asks God to kill him. David
   drools in his own beard faking insanity to stay alive. Jonah is
   furious that God forgave people. Paul begs three times for something
   to be taken away and is told no.

   Nobody preaches those. And they are the only parts that are any use
   to somebody in year one of recovery, because they are the only parts
   where the hero is in the state the reader is actually in.

   ⚠️ THE FAILURE MODE THIS IS BUILT TO AVOID is the youth-pastor
   version — gradients, memes, "God's got you fam". People in recovery
   have done inventories and told a room the worst thing they ever did.
   They can smell that from across the street, and it reads as
   condescension. So: no jokes, no slang, no exclamation marks. Short,
   blunt, and true. That IS the cool version for this audience.

   ---------------------------------------------------------------------
   🔴 EVERY WORD OF SCRIPTURE HERE WAS FETCHED FROM SOURCE, NOT RECALLED.

   Translation is the WORLD ENGLISH BIBLE — public domain, no
   copyright, commercial use fine, forever. Verified against
   bible-api.com and ebible.org, which report "Public Domain" on every
   passage below.

   ⚠️ NOT the KJV, and the reason is specific: the Crown holds the KJV
   in perpetuity in the United Kingdom. Fine for a US app today, and a
   trap the moment anybody says "it's public domain" without the
   caveat. WEB has no such asterisk anywhere on earth.

   🔴 AND NOT AA, NA, OR HAZELDEN. Just For Today, the Big Book and
   Twenty-Four Hours a Day are all copyrighted and actively enforced.
   That wall is why this feature is scripture rather than devotionals.

   ⚠️ I checked my own memory against the source and my memory was
   wrong in two places — Jonah 4:2 ("for I knew", not "because I knew")
   and the shape of 2 Corinthians 12:9. Small, and exactly the kind of
   small that is unforgivable in a Bible study.

   ---------------------------------------------------------------------
   ⚠️ "WHAT NOBODY TELLS YOU" IS THE ENGINE, AND IT MUST BE CHECKABLE.

   Every one of those lines below can be verified against the passage
   printed directly above it. The moment one becomes a hook rather than
   a fact, this turns into the thing it was built to replace.

   Where something is genuinely disputed — Romans 7 is argued over by
   serious people — the note SAYS it is disputed rather than picking a
   side. This app does not get to settle theology for somebody.

   🔴 NOTHING IS STORED. No reading plan, no "day 3 of 30", no progress,
   no tick. A plan you are behind on is a streak wearing a robe, and it
   punishes the week somebody couldn't. Same rule as the practices,
   the meetings and the wall. There is no table for this feature.
   ===================================================================== */

export const TRANSLATION = 'World English Bible · public domain';

/* ⚠️ THE EMOJI ARE MARKERS, NOT DECORATION, AND NONE OF THEM TOUCH THE
   SCRIPTURE ITSELF.

   Ty asked for these because the rest of the app is emoji-forward — the
   whole bottom nav is emoji, the masthead is 🌱, the anonymous switch is
   🌱/🙂 — and a page with none looked like it belonged to a different
   product.

   Each one is an OBJECT FROM ITS OWN PASSAGE: the bread the angel
   leaves for Elijah, the fish, the thorn. Not a mood, not a reaction,
   not 🙏 or 🔥. That distinction is the whole difference between this
   and the youth-pastor version — the thing that reads as condescending
   to somebody who has done a fourth step.

   ⚠️ They appear ONLY in the list, as a way to find your place. There
   is no emoji anywhere near a verse. */

export const READINGS = [
  {
    id: 'hate',
    mark: '🔁',
    ref: 'Romans 7:15–20',
    title: 'I do the thing I hate',
    who: 'Paul, on not being able to stop',
    verses: [
      [15, 'For I don’t know what I am doing. For I don’t practice what I desire to do; but what I hate, that I do.'],
      [18, 'For I know that in me, that is, in my flesh, dwells no good thing. For desire is present with me, but I don’t find it doing that which is good.'],
      [19, 'For the good which I desire, I don’t do; but the evil which I don’t desire, that I practice.'],
    ],
    nobody:
      'He wrote it in the present tense, about himself. Christians have argued for centuries about whether he meant his old life or his current one — and that argument is still going, so nobody gets to tell you it’s settled.',
    close:
      'Either way, it is the most exact description of compulsion written before the word addiction existed.',
  },
  {
    id: 'elijah',
    mark: '🍞',
    ref: '1 Kings 19:4–6',
    title: 'He asked God to kill him',
    who: 'Elijah, under the tree',
    verses: [
      [4, 'But he himself went a day’s journey into the wilderness, and came and sat down under a juniper tree. Then he requested for himself that he might die, and said, “It is enough. Now, O Yahweh, take away my life; for I am not better than my fathers.”'],
      [5, 'He lay down and slept under a juniper tree; and behold, an angel touched him, and said to him, “Arise and eat!”'],
      [6, 'He looked, and behold, there was at his head a cake baked on the coals, and a jar of water. He ate and drank, and lay down again.'],
    ],
    nobody:
      'God’s first answer is not a word. It is sleep and a meal. Then he sleeps again, and is fed again. Nothing is said to him about any of it until after.',
    close:
      'Read verse 5 twice. Whatever you think this book is about, the first thing offered to a man who wants to die is food and rest.',
  },
  {
    id: 'thorn',
    mark: '🌵',
    ref: '2 Corinthians 12:7–9',
    title: 'God said no',
    who: 'Paul, and the thing that stayed',
    verses: [
      [7, '…there was given to me a thorn in the flesh, a messenger of Satan to torment me, that I should not be exalted excessively.'],
      [8, 'Concerning this thing, I begged the Lord three times that it might depart from me.'],
      [9, 'He has said to me, “My grace is sufficient for you, for my power is made perfect in weakness.”'],
    ],
    nobody:
      'He asked three times and it was never taken away. It is still there at the end of the letter. And the text never once says what it actually was.',
    close:
      'This is in the Bible on purpose: somebody prayed hard, correctly, repeatedly, and the answer was no — and he was not doing it wrong.',
  },
  {
    id: 'david',
    mark: '🎭',
    ref: '1 Samuel 21:12–13',
    title: 'He drooled in his beard',
    who: 'David, faking it to stay alive',
    verses: [
      [12, 'David laid up these words in his heart, and was very afraid of Achish the king of Gath.'],
      [13, 'He changed his behavior before them, and pretended to be insane in their hands, and scribbled on the doors of the gate, and let his spittle fall down on his beard.'],
    ],
    nobody:
      'Psalm 34 — the one that says God is near to those who have a broken heart — carries a heading in the text itself tying it to this exact episode: “when he pretended to be insane before Abimelech, who drove him away.”',
    close:
      'The most quoted comfort verse in the book was written by a man on the worst day of his life, covered in his own spit, in a foreign city, pretending to be out of his mind so he wouldn’t be killed.',
  },
  {
    id: 'jonah',
    mark: '🐟',
    ref: 'Jonah 4:1–3',
    title: 'He was furious about mercy',
    who: 'Jonah, after the fish',
    verses: [
      [1, 'But it displeased Jonah exceedingly, and he was angry.'],
      [2, 'He prayed to Yahweh, and said, “Please, Yahweh, wasn’t this what I said when I was still in my own country? Therefore I hurried to flee to Tarshish, for I knew that you are a gracious God, and merciful, slow to anger, and abundant in loving kindness, and you relent of doing harm.”'],
      [3, '“Therefore now, Yahweh, take, I beg you, my life from me; for it is better for me to die than to live.”'],
    ],
    nobody:
      'He didn’t run because he was frightened. He says it plainly in verse 2 — he ran because he suspected they would be forgiven, and he did not want that.',
    close:
      'The book ends without him agreeing. God asks him a question and the last page is silent.',
  },
  {
    id: 'garden',
    mark: '🌙',
    ref: 'Luke 22:41–44',
    title: 'He asked to get out of it',
    who: 'The garden, the night before',
    verses: [
      [41, 'He was withdrawn from them about a stone’s throw, and he knelt down and prayed,'],
      [42, 'saying, “Father, if you are willing, remove this cup from me. Nevertheless, not my will, but yours, be done.”'],
      [43, 'An angel from heaven appeared to him, strengthening him.'],
      [44, 'Being in agony he prayed more earnestly. His sweat became like great drops of blood falling down on the ground.'],
    ],
    nobody:
      'He asked to be let out of it. And the help that arrives is not the cup being removed — it is someone showing up so he can keep going.',
    close:
      'Wanting out is not the same as quitting. It is in here, on the worst night, from the one person the whole book is about.',
  },
];
