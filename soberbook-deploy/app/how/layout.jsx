/* HOW IT WORKS — the tutorial page. 23 Sept 2026.

⚠️ WITHOUT THIS FILE THE PAGE SHIPS IN THE SIGN-IN DOOR'S GRUNGE THEME. Same trap as
more/layout.jsx, checkin/layout.jsx and gratitude/layout.jsx: --gd/--gl/--gt/--paper2/--line
live in theme-green.css and the root layout paints the door, not the app.

⚠️ AND THE LAYOUT ISN'T FINISHED UNTIL IT RENDERS NavBar — /friends shipped on 19 Aug with no
way out of it. This is a page people arrive at confused; stranding them on it would be the
exact opposite of its job.

⚠️ NO JSX IN HERE, AND THAT IS NOT A STYLE CHOICE. This file gets typed into GitHub's web
editor, which auto-closes tags and has twice turned a fragment into </>>. createElement renders
the same thing with no angle brackets to mangle. Rewrite it as JSX whenever it is edited from a
real editor. */
import '../theme-green.css';
import NavBar from '../components/NavBar';
import { createElement as h, Fragment } from 'react';

export default function HowLayout({ children }) {
  return h(Fragment, null, children,
    h('div', { className: 'navpad', 'aria-hidden': 'true' }),
    h(NavBar));
}
