/* 📝 The resume builder. 9 Nov 2026 (0205).
   ⚠️ theme-green first like every member room, then our own sheet.
   ⚠️ AND IT RENDERS NavBar — a room without a way out is a known bug. */
import '../theme-green.css';
import './resume.css';
import Link from 'next/link';
import NavBar from '../components/NavBar';

export default function ResumeLayout({ children }) {
  return (
    <>
      <div className="mast">
        <Link href="/more" className="back" aria-label="Back">←</Link>
        <span className="lg">resume builder</span>
      </div>
      {children}
      <div className="navpad" aria-hidden="true" />
      <NavBar />
    </>
  );
}
