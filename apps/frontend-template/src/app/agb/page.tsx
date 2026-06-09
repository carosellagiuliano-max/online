import type { Metadata } from 'next';
import { getSalon } from '@/lib/actions/salon';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Allgemeine Geschäftsbedingungen',
  description:
    'Allgemeine Geschäftsbedingungen (AGB).',
};

// ============================================
// PAGE COMPONENT
// ============================================

export default async function AGBPage() {
  const salon = await getSalon();

  // Build company info from database
  const companyInfo = {
    name: salon?.name || 'Salon',
    legalName: salon?.companyName || salon?.name || 'Salon',
    address: `${salon?.address || ''}, ${salon?.zipCode || ''} ${salon?.city || ''}, ${salon?.country || 'Schweiz'}`.replace(/^, /, ''),
    email: salon?.email || '',
    lastUpdated: '1. Januar 2024',
  };
  return (
    <div className="py-12">
      <div className="container-wide max-w-3xl">
        <h1 className="text-3xl font-bold mb-4">
          Allgemeine Geschäftsbedingungen
        </h1>
        <p className="text-muted-foreground mb-8">
          Gültig ab: {companyInfo.lastUpdated}
        </p>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
          {/* Scope */}
          <section>
            <h2 className="text-xl font-semibold mb-4">
              1. Geltungsbereich
            </h2>
            <p className="text-muted-foreground">
              Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle
              Dienstleistungen und Verkäufe der {companyInfo.legalName},{' '}
              {companyInfo.address}. Mit der Inanspruchnahme unserer
              Dienstleistungen oder dem Kauf von Produkten erklären Sie sich mit
              diesen AGB einverstanden.
            </p>
          </section>

          {/* Appointments */}
          <section>
            <h2 className="text-xl font-semibold mb-4">
              2. Terminvereinbarung
            </h2>
            <p className="text-muted-foreground mb-4">
              <strong>2.1</strong> Termine können online, telefonisch oder
              persönlich vereinbart werden. Mit der Buchung eines Termins kommt
              ein verbindlicher Vertrag zustande.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>2.2</strong> Bitte erscheinen Sie pünktlich zu Ihrem
              Termin. Bei Verspätungen kann die Behandlungszeit entsprechend
              gekürzt werden oder der Termin muss verschoben werden.
            </p>
            <p className="text-muted-foreground">
              <strong>2.3</strong> Die angegebenen Behandlungszeiten sind
              Richtwerte und können je nach Haartyp und gewünschtem Ergebnis
              variieren.
            </p>
          </section>

          {/* Cancellation */}
          <section>
            <h2 className="text-xl font-semibold mb-4">
              3. Absage und Stornierung
            </h2>
            <p className="text-muted-foreground mb-4">
              <strong>3.1</strong> Terminabsagen müssen mindestens{' '}
              <strong>24 Stunden</strong> vor dem vereinbarten Termin erfolgen.
              Bei späteren Absagen oder Nichterscheinen behalten wir uns vor,
              eine Ausfallentschädigung von 50% des geplanten Dienstleistungspreises
              zu berechnen.
            </p>
            <p className="text-muted-foreground">
              <strong>3.2</strong> Bei wiederholtem Nichterscheinen ohne Absage
              kann eine Anzahlung für künftige Termine verlangt werden.
            </p>
          </section>

          {/* Prices */}
          <section>
            <h2 className="text-xl font-semibold mb-4">
              4. Preise und Zahlung
            </h2>
            <p className="text-muted-foreground mb-4">
              <strong>4.1</strong> Alle Preise verstehen sich in Schweizer
              Franken (CHF) inklusive der gesetzlichen Mehrwertsteuer (8.1%).
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>4.2</strong> Die Bezahlung erfolgt nach Erbringung der
              Dienstleistung. Wir akzeptieren Barzahlung, EC-/Kreditkarten und
              TWINT.
            </p>
            <p className="text-muted-foreground">
              <strong>4.3</strong> Bei längeren Behandlungen (z.B. Balayage,
              Brautfrisur) kann eine Anzahlung verlangt werden.
            </p>
          </section>

          {/* Vouchers */}
          <section>
            <h2 className="text-xl font-semibold mb-4">5. Gutscheine</h2>
            <p className="text-muted-foreground mb-4">
              <strong>5.1</strong> Gutscheine sind 2 Jahre ab Ausstellungsdatum
              gültig und können für alle Dienstleistungen und Produkte eingelöst
              werden.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>5.2</strong> Eine Barauszahlung von Gutscheinen ist nicht
              möglich. Restbeträge bleiben als Guthaben erhalten.
            </p>
            <p className="text-muted-foreground">
              <strong>5.3</strong> Bei Verlust oder Diebstahl wird kein Ersatz
              geleistet.
            </p>
          </section>

          {/* Online Shop */}
          <section>
            <h2 className="text-xl font-semibold mb-4">6. Online-Shop</h2>
            <p className="text-muted-foreground mb-4">
              <strong>6.1</strong> Die Darstellung der Produkte im Online-Shop
              stellt kein rechtlich bindendes Angebot dar. Erst mit der
              Bestellbestätigung kommt ein Kaufvertrag zustande.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>6.2</strong> Die Lieferung erfolgt innerhalb der Schweiz.
              Ab einem Bestellwert von CHF 50 ist die Lieferung kostenlos.
            </p>
            <p className="text-muted-foreground">
              <strong>6.3</strong> Produkte können innerhalb von 14 Tagen in
              ungeöffnetem Zustand zurückgegeben werden. Die Rücksendekosten
              trägt der Kunde.
            </p>
          </section>

          {/* Liability */}
          <section>
            <h2 className="text-xl font-semibold mb-4">7. Haftung</h2>
            <p className="text-muted-foreground mb-4">
              <strong>7.1</strong> Wir führen alle Behandlungen mit grösster
              Sorgfalt durch. Für Schäden, die trotz fachgerechter Ausführung
              entstehen, haften wir nur bei Vorsatz oder grober Fahrlässigkeit.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>7.2</strong> Bei bekannten Allergien oder Unverträglichkeiten
              bitten wir Sie, uns vor der Behandlung zu informieren.
            </p>
            <p className="text-muted-foreground">
              <strong>7.3</strong> Für mitgebrachte Wertgegenstände übernehmen wir
              keine Haftung.
            </p>
          </section>

          {/* Complaints */}
          <section>
            <h2 className="text-xl font-semibold mb-4">8. Reklamationen</h2>
            <p className="text-muted-foreground">
              Reklamationen bezüglich erbrachter Dienstleistungen sind
              unverzüglich, spätestens jedoch innerhalb von 7 Tagen nach der
              Behandlung, zu melden. Wir bemühen uns um eine zufriedenstellende
              Lösung und bieten bei berechtigten Reklamationen eine kostenlose
              Nachbehandlung an.
            </p>
          </section>

          {/* Data Protection */}
          <section>
            <h2 className="text-xl font-semibold mb-4">9. Datenschutz</h2>
            <p className="text-muted-foreground">
              Die Erhebung und Verarbeitung Ihrer personenbezogenen Daten erfolgt
              gemäss unserer{' '}
              <a href="/datenschutz" className="text-primary hover:underline">
                Datenschutzerklärung
              </a>
              .
            </p>
          </section>

          {/* Final Provisions */}
          <section>
            <h2 className="text-xl font-semibold mb-4">
              10. Schlussbestimmungen
            </h2>
            <p className="text-muted-foreground mb-4">
              <strong>10.1</strong> Es gilt Schweizer Recht. Gerichtsstand ist
              St. Gallen.
            </p>
            <p className="text-muted-foreground mb-4">
              <strong>10.2</strong> Sollten einzelne Bestimmungen dieser AGB
              unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen
              davon unberührt.
            </p>
            <p className="text-muted-foreground">
              <strong>10.3</strong> Wir behalten uns das Recht vor, diese AGB
              jederzeit zu ändern. Die jeweils aktuelle Version gilt.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-xl font-semibold mb-4">11. Kontakt</h2>
            <p className="text-muted-foreground">
              Bei Fragen zu diesen AGB erreichen Sie uns unter:{' '}
              <a
                href={`mailto:${companyInfo.email}`}
                className="text-primary hover:underline"
              >
                {companyInfo.email}
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
