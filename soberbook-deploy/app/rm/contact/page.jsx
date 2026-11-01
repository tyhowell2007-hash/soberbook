export const metadata = { title: 'Contact us' };

export default function Contact() {
  return (
    <div className="page"><div className="doc">
      <div className="eyebrow">Contact</div>
      <h1>Get in touch</h1>
      <p className="lede">We read everything. We aren’t a crisis line: if you’re in danger, call 911, or call or text 988.</p>
      <div className="card"><h3>Email</h3><p style={{ fontSize: 20, fontWeight: 700, userSelect: 'all' }}>hello@soberbook.app</p></div>
      <div className="card" id="programs"><h3>For programs</h3><p>Open your listing and use “Work here? Send an update” at the bottom. Our team reviews every update before it goes live. We don’t publish success rates, outcome claims or guarantees, and no program can pay to be listed or ranked.</p></div>
    </div></div>
  );
}
