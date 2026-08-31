/* ONE POST, ON ITS OWN PAGE.

   ⚠️ Same stylesheet order as /notifications and /wall: theme-green
   first, then anything that reads variables out of it. globals.css and
   wall.css are already in the document from the ROOT layout — that is
   where `.thread`, `.reply` and `.replybar` live, which is why this route
   can render Thread.jsx without importing anything extra.

   ⚠️ LAYOUTS NEST, and a route's own layout does not tell you which
   sheets it has. Read app/layout.jsx too. (I wrote the opposite of this
   in three places on 29 Aug and had to correct all three.)

   ⚠️ And it isn't finished until it renders NavBar — /friends shipped
   with no way out on 19 Aug. Somebody lands here from a notification;
   they need a way back into the room. */
import '../../theme-green.css';
import '../../photos.css';
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
