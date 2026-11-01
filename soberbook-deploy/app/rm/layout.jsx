import './rm.css';
import { base, lang, siteUrl } from '../../lib/rm/server';
import { t } from '../../lib/rm/t';
import { MenuButton, LangButton, QuickExit } from './Chrome';

/* =====================================================================
   RECOVERYMAP BY DR. NICOLE LABOR, DO — the frame around every page.
   31 Oct 2026. Ty: "This all looks perfect."

   ⚠️ THIS SITS INSIDE SOBER BOOK'S ROOT LAYOUT (app/layout.jsx), which
   adds the member drawer, the service worker and the theme. On
   myrecoverymap.org nobody is signed in (different domain, no cookies),
   so the drawer renders nothing. Everything visible here is scoped
   under .rm (see rm.css) so neither site restyles the other.
   ===================================================================== */

export function generateMetadata() {
  return {
    metadataBase: new URL(siteUrl().replace(/\/rm$/, '')),
    title: { default: 'RecoveryMap by Dr. Nicole Labor', template: '%s · RecoveryMap' },
    description: 'Free help finding addiction treatment, mental health care, recovery housing and meetings near you, from addiction physician Dr. Nicole Labor, DO. No paid listings.',
    /* 🔴 Sober Book's install manifest and Apple web-app settings must not
       follow RecoveryMap onto its own domain. */
    manifest: null,
    appleWebApp: null,
    icons: { icon: '/rm/icon-192.png', apple: '/rm/icon-180.png' },
    openGraph: { siteName: 'RecoveryMap', type: 'website', images: ['/rm/share.jpg'] },
  };
}

export default function RmLayout({ children }) {
  const b = base(), L = lang();
  return (
    <div className="rm" lang={L}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&family=Permanent+Marker&display=swap" />
      <a className="skip" href="#main">{L === 'es' ? 'Ir al contenido' : 'Skip to content'}</a>
      <div className="crisis"><div className="wrap">
        <a href="tel:988" dangerouslySetInnerHTML={{ __html: t('crisis', L) }} />
        <a href="tel:18006624357" dangerouslySetInnerHTML={{ __html: t('helpline', L) }} />
        <a href="tel:911" dangerouslySetInnerHTML={{ __html: t('emergency', L) }} />
      </div></div>
      <header className="nav"><div className="wrap">
        <a className="brand" href={b || '/'}>
          <img src="/rm/icon-192.png" alt="" width="40" height="40" />
          <div><b>RecoveryMap</b><small>{t('byline', L)}</small></div>
        </a>
        <MenuButton label={t('nav_menu', L)} />
        <nav className="links" id="rm-links" aria-label="Main">
          <a href={`${b}/search`}>{t('nav_find', L)}</a>
          <a href={`${b}/housing`}>{t('nav_housing', L)}</a>
          <a href={`${b}/meetings`}>{t('nav_meetings', L)}</a>
          <a href={`${b}/narcan`}>{t('nav_narcan', L)}</a>
          <a href={`${b}/ask`}>{t('nav_ask', L)}</a>
          <LangButton lang={L} />
        </nav>
      </div></header>
      <QuickExit label={t('quick_exit', L)} />
      <main id="main" className="wrap">{children}</main>
      <footer className="foot"><div className="wrap">
        <div><b>RecoveryMap by Dr. Nicole Labor, DO</b>
          <p>{L === 'es' ? 'Un proyecto de Laborhood Change Project, operado con Sober Book. Gratis. Sin anuncios pagados. Sin comisiones por referidos, nunca.' : 'A project of the Laborhood Change Project, run with Sober Book. Free. No paid listings. No referral fees, ever.'}</p></div>
        <div><b>{t('footer_nma', L)}</b><p>{t('footer_nma_body', L)}</p></div>
        <div><b>{L === 'es' ? 'Sitio' : 'Site'}</b><ul>
          <li><a href={`${b}/guide`}>{L === 'es' ? '¿No sabe qué necesita?' : 'Not sure what you need?'}</a></li>
          <li><a href={`${b}/for-you`}>{L === 'es' ? 'Empiece aquí' : 'Start here for…'}</a></li>
          <li><a href={`${b}/no-insurance`}>{L === 'es' ? '¿Sin seguro?' : 'No insurance?'}</a></li>
          <li><a href={`${b}/online`}>{L === 'es' ? 'Atención en línea' : 'Online care'}</a></li>
          <li><a href={`${b}/about`}>{L === 'es' ? 'Conozca a la Dra. Labor' : 'Meet Dr. Labor'}</a></li>
        </ul></div>
        <div><b>{L === 'es' ? 'Lo legal' : 'The fine print'}</b><ul>
          <li><a href={`${b}/privacy`}>{L === 'es' ? 'Privacidad' : 'Privacy'}</a></li>
          <li><a href={`${b}/terms`}>{L === 'es' ? 'Términos de uso' : 'Terms of use'}</a></li>
          <li><a href={`${b}/contact`}>{L === 'es' ? 'Contacto' : 'Contact us'}</a></li>
          <li><a href={`${b}/contact#programs`}>{L === 'es' ? 'Para programas' : 'For programs'}</a></li>
        </ul></div>
      </div></footer>
    </div>
  );
}
