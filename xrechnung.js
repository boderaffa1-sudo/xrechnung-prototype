/* =========================================================================
   XRechnung UBL 2.1 Generator — EN 16931 compliant
   -------------------------------------------------------------------------
   Pure client-side XML generator for XRechnung 3.0 (Germany).
   Produces a UBL-Invoice.xml conforming to:
     - EN 16931:2017
     - XRechnung 3.0 CIUS
     - CustomizationID: urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0
   
   Output can be validated with the official KoSIT validator:
     https://github.com/itplr-kosit/validator
   ========================================================================= */

const XR = (() => {
  'use strict';

  // Escape XML special characters
  const esc = (s) => {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  // Format amount: 2 decimals, dot separator, no thousand separator
  const amt = (n) => Number(n).toFixed(2);

  // Format quantity: up to 4 decimals, no trailing zeros beyond 2
  const qty = (n) => Number(n).toFixed(2);

  /**
   * Computes totals for an invoice.
   * @param {Array} lines - line items
   * @param {Number} vatRate - e.g. 19
   * @returns {Object} totals
   */
  const computeTotals = (lines, vatRate = 19) => {
    const netTotal = lines.reduce(
      (sum, l) => sum + Number(l.quantity) * Number(l.unitPrice),
      0
    );
    const vatAmount = (netTotal * vatRate) / 100;
    const grossTotal = netTotal + vatAmount;
    return {
      netTotal: Number(netTotal.toFixed(2)),
      vatAmount: Number(vatAmount.toFixed(2)),
      grossTotal: Number(grossTotal.toFixed(2)),
      vatRate
    };
  };

  /**
   * Validates invoice fields according to EN 16931 mandatory BT codes.
   * Returns an array of { bt, label, pass, message }.
   */
  const validate = (inv) => {
    const checks = [];
    const req = (bt, label, value, extra = '') => {
      const ok = value !== undefined && value !== null && String(value).trim() !== '';
      checks.push({
        bt,
        label,
        pass: ok,
        message: ok ? `OK${extra ? ' · ' + extra : ''}` : 'Pflichtfeld fehlt'
      });
    };

    req('BT-1', 'Rechnungsnummer', inv.invoiceNumber);
    req('BT-2', 'Rechnungsdatum', inv.issueDate);
    req('BT-3', 'Rechnungstyp-Code', '380', 'Handelsrechnung (380)');
    req('BT-5', 'Währung', inv.currency);
    req('BT-10', 'Leitweg-ID (Buyer Reference)', inv.buyerReference, 'B2G-Pflicht');
    req('BT-27', 'Verkäufer-Name', inv.sellerName);
    req('BT-31', 'USt-ID Verkäufer', inv.sellerVatId);
    req('BT-34', 'Elektronische Adresse Verkäufer', inv.sellerEmail);
    req('BT-35', 'Straße Verkäufer', inv.sellerStreet);
    req('BT-37', 'Ort Verkäufer', inv.sellerCity);
    req('BT-40', 'Land-Code Verkäufer', 'DE', 'DE');
    req('BT-44', 'Käufer-Name', inv.buyerName);
    req('BT-49', 'Elektronische Adresse Käufer', inv.buyerEmail);
    req('BT-50', 'Straße Käufer', inv.buyerStreet);
    req('BT-52', 'Ort Käufer', inv.buyerCity);
    req('BT-55', 'Land-Code Käufer', 'DE', 'DE');
    req('BT-73', 'Leistungszeitraum Start', inv.periodStart);
    req('BT-74', 'Leistungszeitraum Ende', inv.periodEnd);
    req('BT-84', 'IBAN', inv.sellerIban);

    // Line items
    if (!inv.lines || inv.lines.length === 0) {
      checks.push({
        bt: 'BG-25',
        label: 'Rechnungszeilen',
        pass: false,
        message: 'Mindestens 1 Position erforderlich'
      });
    } else {
      checks.push({
        bt: 'BG-25',
        label: 'Rechnungszeilen',
        pass: true,
        message: `${inv.lines.length} Position(en)`
      });
      inv.lines.forEach((l, i) => {
        const num = i + 1;
        if (!l.description)
          checks.push({
            bt: 'BT-153',
            label: `Pos. ${num} Bezeichnung`,
            pass: false,
            message: 'fehlt'
          });
        if (!l.quantity || Number(l.quantity) <= 0)
          checks.push({
            bt: 'BT-129',
            label: `Pos. ${num} Menge`,
            pass: false,
            message: 'muss > 0 sein'
          });
        if (Number(l.unitPrice) < 0)
          checks.push({
            bt: 'BT-146',
            label: `Pos. ${num} Einzelpreis`,
            pass: false,
            message: 'muss ≥ 0 sein'
          });
      });
    }

    const passed = checks.filter((c) => c.pass).length;
    const total = checks.length;
    return {
      checks,
      passed,
      total,
      valid: checks.every((c) => c.pass)
    };
  };

  /**
   * Builds a UBL 2.1 XRechnung XML string.
   */
  const buildXML = (inv) => {
    const t = computeTotals(inv.lines, inv.vatRate || 19);
    const today = inv.issueDate;
    const dueDate = inv.dueDate || addDays(today, 14);

    const lines = inv.lines
      .map((l, i) => {
        const lineNet = (Number(l.quantity) * Number(l.unitPrice)).toFixed(2);
        return `    <cac:InvoiceLine>
      <cbc:ID>${i + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="${esc(l.unitCode || 'MON')}">${qty(l.quantity)}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${esc(inv.currency)}">${lineNet}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Name>${esc(l.description)}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>S</cbc:ID>
          <cbc:Percent>${t.vatRate}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${esc(inv.currency)}">${amt(l.unitPrice)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
             xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
             xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <!-- XRechnung 3.0 — EN 16931 compliant -->
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${esc(inv.invoiceNumber)}</cbc:ID>
  <cbc:IssueDate>${esc(today)}</cbc:IssueDate>
  <cbc:DueDate>${esc(dueDate)}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${esc(inv.currency)}</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>${esc(inv.buyerReference || 'N/A')}</cbc:BuyerReference>

  <!-- BG-14: Invoicing Period -->
  <cac:InvoicePeriod>
    <cbc:StartDate>${esc(inv.periodStart)}</cbc:StartDate>
    <cbc:EndDate>${esc(inv.periodEnd)}</cbc:EndDate>
  </cac:InvoicePeriod>

  <!-- BG-4: Seller -->
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="EM">${esc(inv.sellerEmail)}</cbc:EndpointID>
      <cac:PartyName>
        <cbc:Name>${esc(inv.sellerName)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(inv.sellerStreet)}</cbc:StreetName>
        <cbc:CityName>${esc(splitCity(inv.sellerCity).city)}</cbc:CityName>
        <cbc:PostalZone>${esc(splitCity(inv.sellerCity).zip)}</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>DE</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(inv.sellerVatId)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(inv.sellerName)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
      <cac:Contact>
        <cbc:ElectronicMail>${esc(inv.sellerEmail)}</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>

  <!-- BG-7: Buyer -->
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cbc:EndpointID schemeID="EM">${esc(inv.buyerEmail)}</cbc:EndpointID>
      <cac:PartyName>
        <cbc:Name>${esc(inv.buyerName)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(inv.buyerStreet)}</cbc:StreetName>
        <cbc:CityName>${esc(splitCity(inv.buyerCity).city)}</cbc:CityName>
        <cbc:PostalZone>${esc(splitCity(inv.buyerCity).zip)}</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>DE</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>${
        inv.buyerVatId
          ? `
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(inv.buyerVatId)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>`
          : ''
      }
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(inv.buyerName)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>

  <!-- BG-16: Payment Means (SEPA Credit Transfer) -->
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>
    <cbc:PaymentID>${esc(inv.invoiceNumber)}</cbc:PaymentID>
    <cac:PayeeFinancialAccount>
      <cbc:ID>${esc(inv.sellerIban.replace(/\s+/g, ''))}</cbc:ID>
      <cbc:Name>${esc(inv.sellerName)}</cbc:Name>
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>

  <!-- BG-23: VAT Breakdown -->
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${esc(inv.currency)}">${amt(t.vatAmount)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${esc(inv.currency)}">${amt(t.netTotal)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${esc(inv.currency)}">${amt(t.vatAmount)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${t.vatRate}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>

  <!-- BG-22: Document Totals -->
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${esc(inv.currency)}">${amt(t.netTotal)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${esc(inv.currency)}">${amt(t.netTotal)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${esc(inv.currency)}">${amt(t.grossTotal)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${esc(inv.currency)}">${amt(t.grossTotal)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

  <!-- BG-25: Invoice Lines -->
${lines}
</ubl:Invoice>`;
  };

  // Helpers
  function addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function splitCity(full) {
    // "73547 Lorch" → { zip: "73547", city: "Lorch" }
    const m = String(full || '').match(/^(\d{4,5})\s+(.+)$/);
    if (m) return { zip: m[1], city: m[2] };
    return { zip: '', city: full || '' };
  }

  // Syntax-highlight XML for display
  const highlight = (xml) => {
    const escaped = xml
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return escaped
      .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="c">$1</span>')
      .replace(
        /(&lt;\/?)([a-zA-Z:][\w:-]*)/g,
        '$1<span class="t">$2</span>'
      )
      .replace(
        /(\s)([a-zA-Z:][\w:-]*)=(&quot;[^&]*&quot;)/g,
        '$1<span class="a">$2</span>=<span class="v">$3</span>'
      );
  };

  return {
    computeTotals,
    validate,
    buildXML,
    highlight,
    addDays,
    splitCity
  };
})();
