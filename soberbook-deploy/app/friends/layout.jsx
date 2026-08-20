/* A room, not a door — so it wears the green. See app/wall/layout.jsx for
   why the theme import lives in a per-segment layout rather than the root
   one: the root would paint the sign-in door too. */
import '../theme-green.css';
import '../photos.css';
import '../friends.css';

export default function FriendsLayout({ children }) { return children; }
