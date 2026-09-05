/* THE GREEN ROOM — chat.

   See app/wall/layout.jsx for the full explanation. One of five now.

   Chat is inside the app, so it wears the room, not the door. The grunge
   stylesheet is deliberately not imported anywhere below /login. */
import '../theme-green.css';
import './inbox.css';

/* 🔴 THESE THREE LINES ARE THE BUG FIX. 5 Sept.

   Convo.jsx renders the shared emoji picker and the shared @ menu, and
   this layout imported the stylesheet for NEITHER — .emp* lived in
   friends.css and .atmenu/.atopt lived in photos.css, and chat imports
   neither of those files. So both components mounted, worked, and drew
   themselves as naked browser buttons. "Chat tagging doesn't work" and
   "the emoji tab looks like shit" were the same missing import, twice.

   ⚠️ THE RULE, from 19 Aug and now with a second scar on it: a
   stylesheet must be imported by the layout of the route whose classes
   it holds — AND when a component becomes shared, its stylesheet has to
   become shared in the same commit. Missing CSS throws nothing, logs
   nothing, and renders something, so no build and no check can catch it.
   Only looking at the screen does. */
import '../emoji.css';
import '../tagmenu.css';
import '../convo.css';
/* ⚠️ Chat has had photo upload since 3 Sept and never loaded the photo
   stylesheet — so `.phserr`, the line that tells you an upload failed,
   had no rules and appeared as unstyled body text on the one screen
   where something has just gone wrong. A route that can upload a picture
   loads the picture styles. */
import '../photos.css';

import NavBar from '../components/NavBar';

export default function ChatLayout({ children }) {
  return (
    <>
      {children}
      <div className="navpad" aria-hidden="true" />
      <NavBar />
    </>
  );
}
