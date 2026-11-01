export const metadata = { title: 'Privacy', description: 'What RecoveryMap collects (very little), and what it never does.' };

/* ⚠️ Plain-English first version, written to match exactly what the code
   does (0198 + the pages). Attorney review before launch is on the team
   checklist. If the code ever changes what it collects, this page changes
   the same day. */
export default function Privacy() {
  return (
    <div className="page"><div className="doc">
      <div className="eyebrow">Privacy · last updated November 1, 2026</div>
      <h1>Your privacy on RecoveryMap</h1>
      <span className="draft">Waiting on attorney review</span>
      <p className="lede">Short version: you don’t sign up, we don’t track you, and we never sell or share what you search.</p>
      <h2>What we don’t collect</h2>
      <ul><li>No accounts, no sign-up, no advertising trackers, no analytics cookies.</li>
        <li>We don’t save what you search for or which listings you look at.</li>
        <li>“Near me” uses your location once, in your browser, to search. We don’t store it.</li></ul>
      <h2>What we do keep</h2>
      <ul><li><b>Call counts by town.</b> When someone taps a phone number we add 1 to a count for that listing’s town for that day. Nothing about who tapped is kept.</li>
        <li><b>“This number didn’t work.”</b> We record that the listing’s number was reported, so our team can fix it. Nothing about who reported it.</li>
        <li><b>Updates from programs.</b> If you work at a program and send an update, we keep your name, work email and role so we can ask about it. They’re never shown on the site.</li>
        <li><b>Your language choice</b> (English or Spanish) in a small cookie on your device.</li>
        <li>Our hosting provider keeps standard short-term server logs, as every website does.</li></ul>
      <h2>Other companies the page talks to</h2>
      <ul><li>Fonts load from Google Fonts. “Directions” opens Google Maps. Links to programs, meetings and telehealth open their own sites, with their own privacy rules.</li></ul>
      <h2>Staying private on a shared phone or computer</h2>
      <ul><li>“Quick exit” (or pressing Esc twice) jumps straight to a weather site and takes RecoveryMap out of the Back button.</li>
        <li>It can’t erase your browser history. A private or incognito window keeps no history at all.</li></ul>
      <h2>Emergencies</h2>
      <p>RecoveryMap is a directory, not a crisis service. If you or someone else is in danger, call 911. For a mental health crisis, call or text 988.</p>
      <h2>Questions</h2>
      <p>Email hello@soberbook.app.</p>
    </div></div>
  );
}
