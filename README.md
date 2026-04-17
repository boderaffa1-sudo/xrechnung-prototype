# XRechnung-Generator · Self-Storage-Demo

Ein funktionsfähiger Prototyp zur Erzeugung von **XRechnung-3.0**-konformen E-Rechnungen im **UBL-2.1**-Format — als Demo für einen Pitch gegenüber Storage24 GmbH.

**Live-Demo:** Siehe [Deployments](https://github.com/boderaffa1-sudo/xrechnung-prototype/deployments)

**Repo:** https://github.com/boderaffa1-sudo/xrechnung-prototype

---

## Warum

Ab dem **01.01.2027** sind strukturierte elektronische Rechnungen für Unternehmen mit >800.000 € Umsatz in Deutschland **Pflicht** ([Wachstumschancengesetz § 14 UStG](https://www.bundesfinanzministerium.de/Content/DE/Standardartikel/Themen/Steuern/2024-10-15-einfuehrung-e-rechnung.html)). Storage24 mit ~20 Mio € Umsatz und 140 Standorten ist betroffen und braucht eine Lösung, die:

- XRechnung / ZUGFeRD erzeugt (nicht nur PDFs)
- SEPA-Lastschrift-Einzug automatisiert
- GoBD-konform archiviert (10 Jahre Aufbewahrung)
- Das Mahnwesen in 4 Stufen steuert
- An HubSpot und BigQuery angebunden ist

Dieser Prototyp zeigt den **Kern-Rechnungserzeugungs-Teil** lauffähig.

---

## Was der Prototyp kann

- ✅ Eingabeformular mit allen EN-16931-Pflichtfeldern (BT-Codes sichtbar)
- ✅ Live-Berechnung Netto / MwSt / Brutto
- ✅ Erzeugung valider **UBL-2.1-XML** mit `CustomizationID` für XRechnung 3.0
- ✅ Eingebaute Pflichtfeld-Prüfung (EN 16931)
- ✅ XML-Download und Clipboard-Kopie
- ✅ Rechnungs-Vorschau (menschenlesbar)
- ✅ Zero-Backend · alle Verarbeitung im Browser · keine Daten verlassen das Gerät
- ✅ Light / Dark-Mode

## Was der Prototyp (bewusst) NICHT macht

- ❌ Keine Datenbank / Kundenverwaltung (gehört in die Vollversion)
- ❌ Kein SEPA-XML-Export (Phase 2)
- ❌ Keine GoBD-Archiv-Integration (Phase 2)
- ❌ Kein Mahnwesen (Phase 2)
- ❌ Keine HubSpot-/BigQuery-Synchronisation (Phase 2)
- ❌ Keine automatische KoSIT-Online-Validierung (erfolgt in der CI-Pipeline der Produktionsversion)

---

## Stack

- **Vanilla JavaScript** (keine Abhängigkeiten, keine Build-Pipeline)
- **HTML5 + moderne CSS** (OKLCH, CSS-Variablen, Fluid Type)
- **Satoshi / General Sans** als Typo (Fontshare CDN)
- Nexus-Design-System als Grundlage

Grund für Vanilla-JS: Der Prototyp soll _demonstrieren, dass die Logik funktioniert_. Framework-Abhängigkeiten würden nur vom Kern ablenken. Die Produktionsversion läuft auf TypeScript + React (Storage24-Stack).

---

## Wie es läuft

```bash
# Einfach index.html im Browser öffnen.
# Oder lokalen Server:
python3 -m http.server 8000
# → http://localhost:8000
```

---

## XRechnung-Konformität

Die erzeugte XML enthält:

| Element                                                            | BT-Code       | Status |
| ------------------------------------------------------------------ | ------------- | ------ |
| `CustomizationID: urn:cen.eu:en16931:2017#...xrechnung_3.0`        | —             | ✓      |
| `ProfileID: urn:fdc:peppol.eu:2017:poacc:billing:01:1.0`           | —             | ✓      |
| Rechnungsnummer                                                    | BT-1          | ✓      |
| Rechnungsdatum                                                     | BT-2          | ✓      |
| Rechnungstyp-Code `380`                                            | BT-3          | ✓      |
| Währung                                                            | BT-5          | ✓      |
| Leitweg-ID (Buyer Reference)                                       | BT-10         | ✓      |
| Leistungszeitraum                                                  | BT-73 / BT-74 | ✓      |
| Verkäufer: Name, USt-ID, Anschrift, E-Mail, IBAN                   | BT-27…BT-84   | ✓      |
| Käufer: Name, Anschrift, E-Mail                                    | BT-44…BT-55   | ✓      |
| Positionen: Bezeichnung, Menge, Einheit, Preis, MwSt-Kategorie     | BG-25         | ✓      |
| MwSt-Breakdown                                                     | BG-23         | ✓      |
| Zahlungsmittel (SEPA-Überweisung, Code 58)                         | BG-16         | ✓      |
| Gesamtbeträge (Netto, MwSt, Brutto)                                | BG-22         | ✓      |

Validierung mit dem offiziellen **KoSIT-Java-Validator**:

```bash
# KoSIT-Validator herunterladen und einrichten:
# https://github.com/itplr-kosit/validator/releases/latest
# https://github.com/itplr-kosit/validator-configuration-xrechnung/releases/latest

java -jar validationtool-*-standalone.jar \
  -s scenarios.xml \
  -h xrechnung_RE-2026-00042.xml \
  -o ./reports
```

---

## Projektstruktur

```
xrechnung-prototype/
├── index.html       # Seiten-Struktur + Form
├── styles.css       # Nexus-Design-System + Layout
├── xrechnung.js     # Kern-Engine: Validation + XML-Generator + Highlighter
├── app.js           # UI-Logic: Form-Binding, Tabs, Download, Theme
└── README.md        # Dieses Dokument
```

---

## Architektur-Hinweise für die Produktionsversion

Das Prototyp-Modul wird in der Vollversion zu einem **wiederverwendbaren `billing-core`-Paket** — nicht Storage24-spezifisch. Dadurch kann dieselbe Engine später für andere Self-Storage-Anbieter lizenziert werden, während Storage24 eine **exklusive Instanz mit On-Premise-Deployment und Source-Code-Escrow** erhält.

```
billing-core/            # generisch, wiederverkaufbar (NICHT Storage24-exklusiv)
├── src/
│   ├── validator.ts     # EN-16931 + XRechnung-Regeln
│   ├── ubl-builder.ts   # UBL-2.1-Emitter (dieser Prototyp, produktionsreif)
│   ├── zugferd.ts       # PDF+XML-Hybridformat (Phase 2)
│   └── peppol.ts        # Peppol-Netzwerk-Versand (Phase 2)

storage24-app/           # exklusiv für Storage24 (Dual-License-geschützt)
├── src/
│   ├── integrations/
│   │   ├── hubspot.ts
│   │   └── bigquery.ts
│   ├── business-logic/  # Mahnstufen, Standort-Logik, Branding
│   └── ui/              # Admin-Oberfläche
```

---

## Kontakt

**Raffael Bode** — Freelance-Entwickler, Berlin
[boderaffa1@gmail.com](mailto:boderaffa1@gmail.com)

Projekt-Team:
- Bode · Projektleitung, Backend, Integration
- Finnischer Senior Developer · Engine, Peppol, Archiv
- Julian Cotte · Frontend-Support, Onboarding, Automation

---

## Lizenz

Dieser Prototyp ist **proprietär**. Alle Rechte vorbehalten.
Für Rückfragen zur Nutzung bitte den Kontakt oben verwenden.
