/* THE MORE TAB - green, like every room it points at. 20 Sept.
⚠️ WITHOUT THIS FILE THE PAGE SHIPS IN THE SIGN-IN DOOR'S GRUNGE THEME. It did, live, for a few minutes: black masthead, acid-green "MORE", Dr. Labor's card with no fill - because --gd/--gl/--gt/--paper2/--line live in theme-green.css and the root layout paints the door, not the app. Same trap as checkin/layout.jsx and gratitude/layout.jsx.
⚠️ AND THE LAYOUT ISN'T FINISHED UNTIL IT RENDERS NavBar - /friends shipped on Aug 19 with no way out of it. This page IS a way out, so it would have been a particularly stupid one to miss.
⚠️ NO JSX IN HERE, AND THAT IS NOT A STYLE CHOICE. This file was typed into GitHub's web editor, which auto-closes tags: the fragment came out as </>> and }</> twice running. createElement renders exactly the same thing and has no angle brackets to mangle. Rewrite it as JSX whenever it is edited from a real editor. */
import '../theme-green.css';
import NavBar from '../components/NavBar';
import { createElement as h, Fragment } from 'react';
export default function MoreLayout({ children }) {
return h(Fragment, null, children, h('div', { className: 'navpad', 'aria-hidden': 'true' }), h(NavBar));
}
