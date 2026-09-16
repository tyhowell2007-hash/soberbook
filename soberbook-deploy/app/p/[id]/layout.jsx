/* ONE POST, ON ITS OWN PAGE.

   ⚠️ Same stylesheet order as /notifications and /wall: theme-green
   first, then anything that reads variables out of it. globals.css and
   wall.css are already in the document from the ROOT layout — that is
   where `.thread`, `.reply` and `.replybar` live.

   🔴 THE SENTENCE THAT USED TO END THAT PARAGRAPH WAS WRONG, AND IT COST
   US. It said this route "can render Thread.jsx without importing
   anything extra." Thread.jsx renders the emoji picker (.emp*), the @
   menu (.atmenu/.atopt) and the reply ⋯ menu (.rplmenu/.rdots) — whose
   styles live in emoji.css, tagmenu.css and replymenu.css, none of which
   were imported here. So on the page every reply and mention
   notification links to, the reply sheet's emoji panel, its tag menu and
   the control for reporting or deleting a reply all rendered as naked
   browser buttons.

   ⚠️ A confident claim in a comment that something needs nothing extra
   is the most expensive kind to get wrong: it stops the next person
   checking. It was found by check-css-coverage.py, not by reading. */
/* ⚠️ Anything Thread.jsx draws, this route has to load. Adding a
   component to that sheet means adding its stylesheet HERE too.

   ⚠️ LAYOUTS NEST, and a route's own layout does not tell you which
   sheets it has. Read app/layout.jsx too. (I wrote the opposite of this
   in three places on 29 Aug and had to correct all three.)

   ⚠️ And it isn't finished until it renders NavBar — /friends shipped
   with no way out on 19 Aug. Somebody lands here from a notification;
   they need a way back into the room. */
import '../../theme-green.css';
import '../../photos.css';
import '../../emoji.css';
import '../../tagmenu.css';
import '../../replymenu.css';
/* ⚠️ page.jsx renders .ntfempty — the "this post is gone" state somebody
   meets when they tap a notification for something that has since been
   deleted. It is defined in notifications.css, which this route did not
   load, so the one message on an otherwise empty page was unstyled. */
import '../../notifications.css';
/* 🏅 ADDED 16 SEPT WITH THE MILESTONE CARD, AND IT SHIPS IN THE SAME
   COMMIT AS THE COMPONENT — not after it.

   Thread.jsx now renders MilestoneCard, and every class it uses lives in
   milestone.css, which until today was imported by app/wall/layout.jsx
   alone. On the wall the card inherits that for free. Here it would not
   have: the markup would render, nothing would error, and somebody's six
   years would arrive as unstyled text in a column. That is the 12 Sept
   `.cbar input` bug exactly — a real element with no rules, which looks
   like a layout choice rather than a fault.

   ⚠️ The 29 Aug rule, restated because it keeps costing us: a route's own
   layout does not tell you which stylesheets that route has. Layouts
   nest, the root imports wall.css, and everything else is per-segment. A
   new component is not shipped until the layout of every route that
   renders it loads its styles. */
import '../../milestone.css';
import NavBar from '../../components/NavBar';

export default function PostLayout({ children }) {
  return (
    <>
      {children}
      <div className="navpad" aria-hidden="true" />
      <NavBar />
    </>
  );
}
