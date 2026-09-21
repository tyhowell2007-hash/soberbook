/* /artist — apply for, or edit, an artist profile. Same green room as /me.
   artists.css comes from the root layout. */
import '../theme-green.css';
/* 🔴 21 Sept — LookPicker renders on this page, and its styles used to live
   only in photos.css, which /artist never loaded. See app/look.css. */
import '../look.css';
import NavBar from '../components/NavBar';

export default function ArtistLayout({ children }) {
  return (
    <>
      {children}
      <div className="navpad" aria-hidden="true" />
      <NavBar />
    </>
  );
}
