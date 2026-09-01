import Unsub from './Unsub';

export const dynamic = 'force-dynamic';

/* =====================================================================
   "TURN THESE OFF" — THE PAGE A HUMAN LANDS ON.  31 Aug.

   ⚠️ THIS PAGE DOES NOTHING BY ITSELF. Loading it changes no data. The
   button does the work, by POSTing to /api/unsub/<token>. See that
   file's header for why: link scanners and mail gateways follow every
   URL in an incoming email with a GET, and a GET that unsubscribes
   people means members get silently switched off by a security robot
   that read their mail before they did.

   ⚠️ NO NAV BAR, AND NO SIGN-IN. Somebody arriving here may be doing it
   on a machine where they do not want this app open. They get the one
   thing they came for and nothing else — no wall behind it, no tabs
   along the bottom, nothing that says more about them than the email
   already did.

   ⚠️ noindex, because the URL contains a capability token.
   ===================================================================== */

export const metadata = {
  title: 'Email notifications',
  robots: { index: false, follow: false },
};

export default function UnsubPage({ params }) {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: '#F7FAF8',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ maxWidth: '380px', width: '100%' }}>
        <Unsub token={params.token} />
      </div>
    </main>
  );
}
