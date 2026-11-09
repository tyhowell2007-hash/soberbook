export const metadata = { title: 'Terms of use' };

export default function Terms() {
  return (
    <div className="page"><div className="doc">
      <div className="eyebrow">Terms of use · last updated November 9, 2026</div>
      <h1>Using RecoveryMap</h1>
      {/* INTERNAL: this page is waiting on attorney review. Not shown to visitors (Kenny, 6 Nov 2026). */}
      <ul>
        <li><b>It’s a directory, not medical advice.</b> Nothing here replaces a doctor. Call a program to confirm services, openings and cost before you go.</li>
        <li><b>Where listings come from.</b> Most come from SAMHSA’s public national directories. Details marked “provider-reported” were sent by the program and reviewed by our team, not independently confirmed.</li>
        <li><b>How results are ordered.</b> Search results are sorted by distance or by name.</li>
        <li><b>Partner messages.</b> Some pages may show messages from partner organizations. They are labeled as partner messages and are not search results.</li>
        <li><b>Reporting a problem.</b> Listings change. Use “Did this number work?” or the update form on any listing.</li>
        <li><b>In an emergency</b> call 911. For a mental health crisis, call or text 988.</li>
        <li>RecoveryMap is operated by Sober Book LLC.</li>
      </ul>
    </div></div>
  );
}
