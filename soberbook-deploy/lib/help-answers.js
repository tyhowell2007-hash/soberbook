/* =====================================================================
   WHAT SAGE IS ALLOWED TO SAY ABOUT THE APP.  7 Sept.

   ---------------------------------------------------------------------
   ** THE DESIGN, AND IT IS THE WHOLE REASON THIS FILE EXISTS:

       SAGE DOES NOT WRITE THE ANSWER. IT PICKS ONE.

   A model asked "how do I go anonymous?" will produce a confident,
   well-written menu path. It has no way of knowing that ours reads
   "You -> 👀 How you show up -> 🤫 Anonymous", so it will invent
   something plausible instead -- and a plausible wrong answer is the
   worst kind, because the member goes looking and blames themselves
   when it isn't there.

   So the model's only job is MATCHING a question to one of these. The
   words below are ours, checked against the running code, and they are
   what gets shown. If nothing matches well enough, the honest answer is
   "I don't know that one, write to hello@soberbook.app" -- see NO_MATCH.

   ---------------------------------------------------------------------
   !! EVERY PATH HERE WAS READ OUT OF app/me/Me.jsx ON 7 SEPT, NOT
   REMEMBERED. The section titles are the literal `<Section title=`
   strings, emoji included, because the member is going to be looking for
   exactly those characters on a screen. This is the 23 Aug rule:
   instructions that depend on something the screen doesn't display are
   not instructions. That day Ty deleted the wrong post because I told
   him which one to keep by a timestamp the interface never showed.

   ! THE ELEVEN SECTIONS OF /me, IN THE ORDER THEY APPEAR:
        🌱 Your date · 🪪 Your handle · 🙂 Your name and face ·
        👀 How you show up · 📝 About you · 📍 Where you are ·
        🤝 Sponsoring · [🎨 NOT RENDERED] · 🎵 Your song ·
        🚪 When you visit someone · 🔑 Account

   ---------------------------------------------------------------------
   !! IF A SECTION IS RENAMED, THIS FILE IS PART OF THAT CHANGE. There is
   no test that can catch a menu path going stale -- the string still
   exists here, it just stops existing on the screen. That is exactly how
   /tour ended up telling 151 people the film was fourteen minutes long
   after it had been cut to three and a half.
   ===================================================================== */

/* Each entry: `ask` is what the matcher compares against -- several real
   phrasings, because "go anonymous" / "hide my name" / "how do i not show
   up" are the same question and members do not use our words for our
   features. `say` is shown verbatim. `go` is an optional real route. */
export const HELP_ANSWERS = [
  {
    id: 'anonymous',
    ask: ['how do i go anonymous', 'hide my name', 'post without my name',
          'stop showing my name', 'anonymous mode', 'how do i be anonymous'],
    say: 'Open **You**, then **👀 How you show up**, and choose **🤫 Anonymous**. '
       + 'It takes effect straight away, and it pulls your name off things you '
       + 'already wrote as well as anything new.',
    go: { href: '/me', label: 'Take me there' },
  },
  {
    id: 'open',
    ask: ['show my name again', 'stop being anonymous', 'turn anonymous off',
          'go back to my name', 'use my real name'],
    say: 'Open **You**, then **👀 How you show up**, and choose **🌱 Open**. '
       + 'Your name will show on anything you post from then on.',
    go: { href: '/me', label: 'Take me there' },
  },
  {
    id: 'handle',
    ask: ['change my handle', 'change my username', 'i signed up with my real name',
          'wrong handle', 'my handle is my name'],
    say: 'Open **You**, then **🪪 Your handle**. Letters, numbers and underscores, '
       + 'three characters or more. If you signed up using your real name, this is '
       + 'the box that undoes it.',
    go: { href: '/me', label: 'Take me there' },
  },
  {
    id: 'nameface',
    ask: ['change my display name', 'change my picture', 'change my face',
          'add a photo of me', 'profile picture'],
    say: 'Open **You**, then **🙂 Your name and face**. You can use a photo or pick '
       + 'a face instead of one.',
    go: { href: '/me', label: 'Take me there' },
  },
  {
    id: 'date',
    ask: ['change my sober date', 'wrong sober date', 'set my date',
          'my day count is wrong', 'i started over'],
    say: 'Open **You**, then **🌱 Your date** — it is the first thing on the page. '
       + 'You can move it whenever you need to, including backwards, and nobody is '
       + 'told that you changed it.',
    go: { href: '/me', label: 'Take me there' },
  },
  {
    id: 'daycount',
    ask: ['hide my day count', 'who can see my days', 'stop showing my days',
          'hide how long ive been sober'],
    say: 'Open **You**, then **👀 How you show up** — underneath the Open and '
       + 'Anonymous buttons there is **Who can see your day count**.',
    go: { href: '/me', label: 'Take me there' },
  },
  {
    id: 'town',
    ask: ['hide my town', 'change where i live', 'remove my location',
          'stop showing my town'],
    say: 'Open **You**, then **📍 Where you are**. Your town is hidden by default, '
       + 'and the eye beside the section turns it off again any time.',
    go: { href: '/me', label: 'Take me there' },
  },
  {
    id: 'sponsor',
    ask: ['sponsoring', 'i need a sponsor', 'i want to sponsor someone',
          'how do i say im available to sponsor'],
    say: 'Open **You**, then **🤝 Sponsoring**. They are two separate answers — '
       + 'whether you have a sponsor, and whether you are willing to be one — '
       + 'because most sponsors have a sponsor too.',
    go: { href: '/me', label: 'Take me there' },
  },
  {
    id: 'song',
    ask: ['add a song', 'change my song', 'music on my page', 'my anthem'],
    say: 'Open **You**, then **🎵 Your song**. Paste a share link from Spotify, '
       + 'YouTube or Apple Music.',
    go: { href: '/me', label: 'Take me there' },
  },
  {
    id: 'autoplay',
    ask: ['stop songs playing', 'turn off music', 'songs start on their own',
          'mute other peoples pages'],
    say: 'Open **You**, then **🚪 When you visit someone**. That switch decides '
       + 'whether other people’s songs start on their own when you open their '
       + 'page. It is your setting, not theirs.',
    go: { href: '/me', label: 'Take me there' },
  },
  {
    id: 'signout',
    ask: ['sign out', 'log out', 'how do i log off'],
    say: 'Open **You** and scroll to the bottom — **Sign out** is there, and also '
       + 'inside **🔑 Account**. It asks you to tap twice so it can’t happen '
       + 'by accident.',
    go: { href: '/me', label: 'Take me there' },
  },
  {
    id: 'delete',
    ask: ['delete my account', 'close my account', 'remove everything',
          'i want to leave'],
    say: 'Open **You**, then **🔑 Account**, then **Delete your account**. It '
       + 'removes your posts, replies, messages, photos and videos, and nobody can '
       + 'sign in as you again. You are asked one question first: whether to also '
       + 'delete anything you posted anonymously — those have no name on them and '
       + 'people may have replied underneath, so it is your call.',
    go: { href: '/me', label: 'Take me there' },
  },
  {
    id: 'unblock',
    ask: ['unblock someone', 'who have i blocked', 'undo a block'],
    say: 'Open **You**, then **🔑 Account** — anyone you have blocked is listed '
       + 'there with an undo. If you have blocked nobody, the list isn’t shown '
       + 'at all. Unblocking does not put back a friendship the block ended.',
    go: { href: '/me', label: 'Take me there' },
  },
  {
    id: 'password',
    ask: ['forgot my password', 'reset my password', 'cant sign in',
          'i cant get in', 'locked out'],
    say: 'On the sign-in page there is a reset link — it emails you a way back in. '
       + 'If the email doesn’t arrive, check the spam folder, then write to '
       + 'hello@soberbook.app and a real person will sort it out.',
    go: { href: '/login', label: 'Go to sign in' },
  },
  {
    id: 'meetings',
    ask: ['find a meeting', 'where are the meetings', 'online meeting',
          'is there a meeting on now'],
    say: 'The **Meetings** tab. Rooms that are running right now are at the top, '
       + 'and where a meeting publishes a phone number you can tap it and dial '
       + 'straight in — no Zoom account, no app.',
    go: { href: '/meetings', label: 'Open Meetings' },
  },
  {
    id: 'rooms',
    ask: ['what is the front room', 'group chat', 'where do people talk',
          'community'],
    say: 'The **Community** tab. It is one running conversation rather than posts '
       + '— shorter, easier, and you do not have to start a thread to say '
       + 'something.',
    go: { href: '/friends', label: 'Open Community' },
  },
  {
    id: 'notifications',
    ask: ['turn on notifications', 'i didnt know someone replied',
          'notifications', 'the bell'],
    say: 'Tap the bell to see who got back to you. To have your phone tell you, '
       + 'open **You** and scroll to the notifications switch. It is replies and '
       + 'messages only — nothing else, ever.',
    go: { href: '/notifications', label: 'Open the bell' },
  },
];

/* =====================================================================
   !! THE REFUSALS, AND THIS HALF MATTERS MORE THAN THE ANSWERS.

   Every one of these is a question a member will genuinely ask, where a
   model would happily produce a confident answer that is FALSE about this
   app. Matching one of these returns the honest line instead.

   🔴 The theme one was found by checking rather than assuming. The
   "🎨 How your page looks" section is fully written and sits behind
   `{false && (` in Me.jsx, because /u/[handle] does not render a theme
   yet. It is real code, it is not on the screen, and an assistant sending
   somebody to look for it would have been this codebase's oldest bug --
   telling a member something is there when it isn't.
   ===================================================================== */
export const HELP_REFUSALS = [
  {
    id: 'theme',
    ask: ['change my colours', 'change my theme', 'customise my page',
          'how your page looks'],
    say: 'You can’t yet — that one is built but not switched on, so there is '
       + 'nothing to find on the page. It arrives when profiles can show it.',
  },
  {
    id: 'jobs',
    ask: ['jobs', 'find work', 'second chance employers', 'hiring'],
    say: 'Not built yet. It is the thing Ty most wants to add, and it is honestly '
       + 'not there today — anything you may have read describing it was '
       + 'describing the plan.',
  },
  {
    id: 'whoisanonymous',
    ask: ['who wrote that anonymous post', 'can you tell me who posted',
          'find out who someone is'],
    say: 'No, and neither can anyone else — including Ty, and including the tool '
       + 'used to review a reported post. The name on an anonymous post is a '
       + 'one-way code and there is no column anywhere holding the answer.',
  },
  {
    id: 'myprivatestuff',
    ask: ['what did i write in my pledge', 'read my messages', 'what did i say to',
          'show me my chat'],
    say: 'I can’t see any of that. Your messages and the reason you write when '
       + 'you pledge are not shown to me at all — no member, no friend, and not Ty '
       + 'either.',
  },
];

/* The honest floor. ! It must never be a guess dressed as an answer: a
   wrong menu path costs a member ten minutes and their confidence, and
   this app is mostly used by people who already assume they are the
   problem. */
export const NO_MATCH =
  'I don’t know that one. Write to hello@soberbook.app — a real person reads it.';

/* 🔴 CRISIS OUTRANKS EVERYTHING ABOVE, and it is checked FIRST, before any
   matching happens. This is not the help desk's job and it must not try to
   be good at it: the answer is the number and a route to people. */
export const CRISIS_HANDOFF = {
  say: 'I’m not the right thing for this, and I don’t want to be. '
     + '**988** is free, any hour, and there are people here too.',
  go: { href: '/now', label: 'Open right now' },
};

export default HELP_ANSWERS;
