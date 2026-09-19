/* /artist — apply for, or edit, an artist profile. Same green room as /me.
   artists.css comes from the root layout. */
import '../theme-green.css';
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
