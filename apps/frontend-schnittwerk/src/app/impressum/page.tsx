import type { Metadata } from 'next';
import { getSalon } from '@/lib/actions/salon';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Impressum',
  description: 'Impressum und rechtliche Informationen.',
};

// ============================================
// PAGE COMPONENT
// ============================================

export default async function ImpressumPage() {
  const salon = await getSalon();

  // Build company info from database
  const companyInfo = {
    name: salon?.name || 'Salon',
    legalName: salon?.companyName || salon?.name || 'Salon',
    address: {
      street: salon?.address || '',
      city: `${salon?.zipCode || ''} ${salon?.city || ''}`.trim(),
      country: salon?.country || 'Schweiz',
    },
    phone: salon?.phone || '',
    email: salon?.email || '',
    // These could be added to the database later
    uid: 'CHE-XXX.XXX.XXX',
    mwstNr: 'CHE-XXX.XXX.XXX MWST',
    management: salon?.ownerName || '',
    register: `Handelsregister des Kantons ${salon?.city || ''}`,
  };
  return (
    <div className="py-12">
      <div className="container-wide max-w-3xl">
        <h1 className="text-3xl font-bold mb-8">Impressum</h1>

        <div className="prose prose-gray dark:prose-invert max-w-none">
          {/* Company Info */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Angaben gemäss Art. 3 UWG</h2>
            <address className="not-italic text-muted-foreground">
              <strong className="text-foreground">{companyInfo.legalName}</strong>
              <br />
              {companyInfo.address.street}
              <br />
              {companyInfo.address.city}
              <br />
              {companyInfo.address.country}
            </address>
          </section>

          {/* Contact */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Kontakt</h2>
            <p className="text-muted-foreground">
              Telefon: {companyInfo.phone}
              <br />
              E-Mail: {companyInfo.email}
            </p>
          </section>

          {/* Legal */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">
              Handelsregister & Unternehmens-Identifikationsnummer
            </h2>
            <p className="text-muted-foreground">
              Eingetragen im {companyInfo.register}
              <br />
              UID-Nummer: {companyInfo.uid}
              <br />
              MWST-Nummer: {companyInfo.mwstNr}
            </p>
          </section>

          {/* Management */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Geschäftsführung</h2>
            <p className="text-muted-foreground">{companyInfo.management}</p>
          </section>

          {/* Liability */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Haftungsausschluss</h2>
            <p className="text-muted-foreground mb-4">
              Der Autor übernimmt keinerlei Gewähr hinsichtlich der inhaltlichen
              Richtigkeit, Genauigkeit, Aktualität, Zuverlässigkeit und
              Vollständigkeit der Informationen.
            </p>
            <p className="text-muted-foreground mb-4">
              Haftungsansprüche gegen den Autor wegen Schäden materieller oder
              immaterieller Art, welche aus dem Zugriff oder der Nutzung bzw.
              Nichtnutzung der veröffentlichten Informationen, durch Missbrauch
              der Verbindung oder durch technische Störungen entstanden sind,
              werden ausgeschlossen.
            </p>
            <p className="text-muted-foreground">
              Alle Angebote sind unverbindlich. Der Autor behält es sich
              ausdrücklich vor, Teile der Seiten oder das gesamte Angebot ohne
              gesonderte Ankündigung zu verändern, zu ergänzen, zu löschen oder
              die Veröffentlichung zeitweise oder endgültig einzustellen.
            </p>
          </section>

          {/* Links */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">
              Haftung für Links
            </h2>
            <p className="text-muted-foreground">
              Verweise und Links auf Webseiten Dritter liegen ausserhalb unseres
              Verantwortungsbereichs. Es wird jegliche Verantwortung für solche
              Webseiten abgelehnt. Der Zugriff und die Nutzung solcher Webseiten
              erfolgen auf eigene Gefahr des Nutzers oder der Nutzerin.
            </p>
          </section>

          {/* Copyright */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Urheberrechte</h2>
            <p className="text-muted-foreground">
              Die Urheber- und alle anderen Rechte an Inhalten, Bildern, Fotos
              oder anderen Dateien auf der Website gehören ausschliesslich der
              Firma {companyInfo.legalName} oder den speziell genannten
              Rechtsinhabern. Für die Reproduktion jeglicher Elemente ist die
              schriftliche Zustimmung der Urheberrechtsträger im Voraus
              einzuholen.
            </p>
          </section>

          {/* Dispute Resolution */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Streitschlichtung</h2>
            <p className="text-muted-foreground">
              Die Europäische Kommission stellt eine Plattform zur
              Online-Streitbeilegung (OS) bereit. Wir sind nicht bereit oder
              verpflichtet, an Streitbeilegungsverfahren vor einer
              Verbraucherschlichtungsstelle teilzunehmen.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
