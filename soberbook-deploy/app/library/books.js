/* =====================================================================
   THE LIBRARY'S CATALOG — 27 Nov 2026 (Kenny, drop 2).

   Two kinds of book, and the line between them is the law, not taste:

   • `hosted` — free to copy: US public domain, US government works, our
     own writing. The text lives in /public/library/<id>.json, converted
     word for word from the source named here, and opens in our reader.
   • `linked` — copyrighted, but the publisher posts it free. We show it
     on the shelf and open THEIR page. Never copied, never quoted at
     length. AA, NA and Hazelden material is always linked, even where a
     reprint claims public domain (AA lists copyrights 1939–2001).

   Each title carries one plain line on why it's here: the librarian's
   note. Sources were checked on 27 Nov 2026; see Kenny's "The Library —
   starter catalog" doc.

   ⚠️ `id` must never change once shipped: My Shelf on members' phones
   stores these ids.
   ===================================================================== */
export const BOOKS = [
  {
    id: 'meditations', kind: 'hosted', shelf: 'read',
    title: 'Meditations', author: 'Marcus Aurelius', extra: 'George Long translation',
    note: 'A Roman emperor’s private notes to himself about staying steady when things go wrong. Short entries. Read one, put it down.',
    size: '12 books',
    from: 'Standard Ebooks', fromUrl: 'https://standardebooks.org/ebooks/marcus-aurelius/meditations/george-long',
  },
  {
    id: 'varieties', kind: 'hosted', shelf: 'read',
    title: 'The Varieties of Religious Experience', author: 'William James', extra: '1902',
    note: 'Lectures on how people change from the inside, drawn on by AA’s founders. Long, but every chapter stands alone.',
    size: '20 lectures',
    from: 'Standard Ebooks', fromUrl: 'https://standardebooks.org/ebooks/william-james/the-varieties-of-religious-experience',
  },
  {
    id: 'bigbook', kind: 'linked', shelf: 'read',
    title: 'Alcoholics Anonymous (the Big Book)', author: 'Alcoholics Anonymous', extra: '4th edition',
    note: 'AA’s basic text. AA posts it free to read, watch in ASL, or listen to.',
    url: 'https://www.aa.org/the-big-book', from: 'AA',
  },
  {
    id: 'twelve-twelve', kind: 'linked', shelf: 'read',
    title: 'Twelve Steps and Twelve Traditions', author: 'Alcoholics Anonymous',
    note: 'An essay on each Step and each Tradition. Free from AA to read, watch or listen.',
    url: 'https://aa.org/twelve-steps-twelve-traditions', from: 'AA',
  },
  {
    id: 'na-pamphlets', kind: 'linked', shelf: 'read',
    title: 'NA pamphlets', author: 'Narcotics Anonymous',
    note: 'For the Newcomer, Recovery and Relapse, Sponsorship and more, posted in full by NA.',
    url: 'https://na.org/ips', from: 'NA',
  },
  {
    id: 'nida-science', kind: 'linked', shelf: 'guides',
    title: 'Drugs, Brains, and Behavior: The Science of Addiction', author: 'National Institute on Drug Abuse',
    note: 'Plain-language science: addiction is a medical disorder that affects the brain, not a moral failing.',
    url: 'https://nida.nih.gov/publications/drugs-brains-behavior-science-addiction', from: 'NIDA',
  },
  {
    id: 'samhsa-recovery', kind: 'linked', shelf: 'guides',
    title: 'What’s Recovery? SAMHSA’s Working Definition', author: 'SAMHSA',
    note: 'A short definition of recovery and 10 principles behind it.',
    url: 'https://store.samhsa.gov/product/samhsas-working-definition-recovery/pep12-recdef', from: 'SAMHSA',
  },
];

export const SHELVES = [
  { id: 'read',   title: 'Read' },
  { id: 'guides', title: 'Guides' },
];

export const byId = (id) => BOOKS.find((b) => b.id === id);
