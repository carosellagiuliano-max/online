# Datenlöschung & Aufbewahrung - BeautifyPRO

## DSGVO Compliance

BeautifyPRO ist DSGVO-konform und ermöglicht:
- Recht auf Auskunft (Art. 15)
- Recht auf Berichtigung (Art. 16)
- Recht auf Löschung (Art. 17)
- Recht auf Datenübertragbarkeit (Art. 20)

---

## Aufbewahrungsfristen

| Datentyp | Aufbewahrungsfrist | Grund |
|----------|-------------------|-------|
| Rechnungen | 10 Jahre | Steuerrecht CH (OR 958f) |
| Buchungsdaten | 10 Jahre | Buchhaltungspflicht |
| Kundenprofile | Bis Löschantrag | Vertragszweck |
| Termine | 2 Jahre nach Datum | Geschäftsbedürfnis |
| Logs | 90 Tage | Debugging/Sicherheit |
| Sessions | 30 Tage | Funktionalität |

---

## Automatische Löschung

### Geplante Jobs (Cron)

```sql
-- Alte Sessions löschen (täglich)
DELETE FROM auth.sessions
WHERE expires_at < NOW() - INTERVAL '30 days';

-- Alte Logs löschen (wöchentlich)
DELETE FROM audit_logs
WHERE created_at < NOW() - INTERVAL '90 days'
AND log_level != 'error';

-- Abgelaufene Voucher archivieren (monatlich)
UPDATE vouchers
SET status = 'archived'
WHERE expires_at < NOW() - INTERVAL '6 months'
AND status = 'expired';
```

### Supabase Scheduled Functions

```typescript
// supabase/functions/cleanup/index.ts
export const handler = async () => {
  // Cleanup expired data
};

// Cron: 0 3 * * * (täglich um 03:00)
```

---

## Manuelle Löschung

### Kundendaten löschen

```sql
-- ACHTUNG: Nur nach Prüfung ausführen!

-- 1. Termine anonymisieren (nicht löschen wegen Buchhaltung)
UPDATE appointments
SET customer_notes = NULL,
    customer_id = NULL
WHERE customer_id = 'xxx';

-- 2. Personenbezogene Daten löschen
DELETE FROM customer_preferences WHERE customer_id = 'xxx';
DELETE FROM customer_notes WHERE customer_id = 'xxx';

-- 3. Kundenprofil anonymisieren
UPDATE customers
SET first_name = 'GELÖSCHT',
    last_name = 'GELÖSCHT',
    email = 'deleted_' || id || '@deleted.local',
    phone = NULL,
    address = NULL,
    notes = NULL,
    is_deleted = true
WHERE id = 'xxx';
```

### Löschantrag Prozess

1. **Antrag empfangen** - E-Mail oder Portal
2. **Identität prüfen** - Kunde muss sich verifizieren
3. **Daten identifizieren** - Alle Datenpunkte sammeln
4. **Aufbewahrungspflicht prüfen** - Buchhaltungsdaten behalten
5. **Löschung durchführen** - Anonymisieren/Löschen
6. **Bestätigung senden** - Innerhalb 30 Tagen

---

## Datenexport (Art. 20 DSGVO)

### Export-Funktion

```typescript
// API: GET /api/customer/export

export async function exportCustomerData(customerId: string) {
  const data = {
    profile: await getProfile(customerId),
    appointments: await getAppointments(customerId),
    orders: await getOrders(customerId),
    loyalty: await getLoyaltyData(customerId),
  };

  return {
    format: 'json',
    data,
    exportedAt: new Date().toISOString(),
  };
}
```

### Export-Inhalt

```json
{
  "profile": {
    "firstName": "Max",
    "lastName": "Mustermann",
    "email": "max@example.com",
    "phone": "+41791234567",
    "createdAt": "2024-01-15"
  },
  "appointments": [...],
  "orders": [...],
  "loyaltyPoints": 150
}
```

---

## Backup & Recovery

### Backup-Strategie

| Typ | Frequenz | Retention |
|-----|----------|-----------|
| Full Backup | Täglich | 30 Tage |
| Point-in-Time | Kontinuierlich | 7 Tage |
| Long-term Archive | Monatlich | 1 Jahr |

### Recovery-Prozess

1. Supabase Dashboard → Database → Backups
2. Zeitpunkt auswählen (vor Datenverlust)
3. Recovery starten
4. Daten verifizieren
5. DNS umstellen (falls neue Instanz)

---

## Audit Trail

### Was wird protokolliert

- Login-Versuche (erfolgreich/fehlgeschlagen)
- Datenänderungen (CREATE, UPDATE, DELETE)
- Admin-Aktionen
- Löschanträge
- Datenexporte

### Audit Log Schema

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  user_id UUID,
  action VARCHAR(50),
  table_name VARCHAR(50),
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Verantwortlichkeiten

| Aufgabe | Verantwortlich | Frequenz |
|---------|---------------|----------|
| Löschanträge bearbeiten | Admin | Bei Eingang |
| Aufbewahrungsfristen prüfen | Tech Lead | Quartalsweise |
| Backup-Tests | DevOps | Monatlich |
| DSGVO-Audit | DPO | Jährlich |

---

## Kontakt

**Datenschutzbeauftragter:**
- E-Mail: datenschutz@beautifypro.demo
- Antwortzeit: 48h (Werktage)

**Löschantrag:**
- E-Mail: loeschung@beautifypro.demo
- Bearbeitungszeit: Max. 30 Tage
