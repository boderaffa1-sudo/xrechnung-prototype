/* =========================================================================
   App Logic — UI binding
   ========================================================================= */

(function () {
  'use strict';

  // -------- Theme toggle --------
  (function () {
    const root = document.documentElement;
    const btn = document.querySelector('[data-theme-toggle]');
    let theme = matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
    root.setAttribute('data-theme', theme);
    paintToggle();

    if (btn) {
      btn.addEventListener('click', () => {
        theme = theme === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', theme);
        paintToggle();
      });
    }
    function paintToggle() {
      if (!btn) return;
      btn.setAttribute(
        'aria-label',
        'Zu ' + (theme === 'dark' ? 'hellem' : 'dunklem') + ' Modus wechseln'
      );
      btn.innerHTML =
        theme === 'dark'
          ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
          : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    }
  })();

  // -------- Form state --------
  const form = document.getElementById('invoiceForm');
  const lineItemsEl = document.getElementById('lineItems');
  const totalsEl = document.getElementById('totals');
  const previewEl = document.getElementById('preview');
  const xmlEl = document.getElementById('xmlOutput');
  const validationEl = document.getElementById('validation');
  const copyBtn = document.getElementById('copyXml');
  const downloadBtn = document.getElementById('downloadXml');
  const addLineBtn = document.getElementById('addLine');
  const fillDemoBtn = document.getElementById('fillDemo');

  // Set default dates
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = (d) => {
    const dt = new Date(d);
    dt.setDate(1);
    return dt.toISOString().slice(0, 10);
  };
  const lastOfMonth = (d) => {
    const dt = new Date(d);
    dt.setMonth(dt.getMonth() + 1, 0);
    return dt.toISOString().slice(0, 10);
  };
  form.issueDate.value = today;
  form.periodStart.value = firstOfMonth(today);
  form.periodEnd.value = lastOfMonth(today);

  // -------- Line items --------
  const defaultLines = [
    {
      description: 'Lagerabteil Nr. 247 · 4 m² · Standort München-Feldmoching',
      quantity: 1,
      unitPrice: 89.0,
      unitCode: 'MON'
    },
    {
      description: 'Versicherungsschutz Premium (bis 5.000 €)',
      quantity: 1,
      unitPrice: 12.9,
      unitCode: 'MON'
    },
    {
      description: 'Schließzylinder-Mietgebühr',
      quantity: 1,
      unitPrice: 3.5,
      unitCode: 'MON'
    }
  ];

  function renderLineItem(line = {}, idx = 0) {
    const div = document.createElement('div');
    div.className = 'line-item';
    div.innerHTML = `
      <input type="text" name="lineDesc" placeholder="Bezeichnung (z.B. Lagerabteil 247)" value="${escAttr(line.description || '')}" required />
      <input type="number" name="lineQty" step="0.01" min="0.01" placeholder="Menge" value="${line.quantity ?? 1}" required />
      <input type="number" name="linePrice" step="0.01" min="0" placeholder="Einzelpreis" value="${line.unitPrice ?? 0}" required />
      <input type="text" name="lineUnit" placeholder="Einheit" value="${escAttr(line.unitCode || 'MON')}" required />
      <button type="button" class="remove-line" aria-label="Entfernen" title="Entfernen">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    `;
    div.querySelector('.remove-line').addEventListener('click', () => {
      if (lineItemsEl.children.length <= 1) return;
      div.remove();
      updateTotals();
    });
    div.querySelectorAll('input').forEach((inp) =>
      inp.addEventListener('input', updateTotals)
    );
    return div;
  }

  function renderLines(lines) {
    lineItemsEl.innerHTML = '';
    lines.forEach((l, i) => lineItemsEl.appendChild(renderLineItem(l, i)));
  }

  addLineBtn.addEventListener('click', () => {
    lineItemsEl.appendChild(
      renderLineItem({ description: '', quantity: 1, unitPrice: 0, unitCode: 'MON' })
    );
    updateTotals();
  });

  renderLines(defaultLines);

  // -------- Read form → invoice object --------
  function readInvoice() {
    const fd = new FormData(form);
    const lines = [];
    const itemsEls = lineItemsEl.querySelectorAll('.line-item');
    itemsEls.forEach((el) => {
      lines.push({
        description: el.querySelector('[name="lineDesc"]').value.trim(),
        quantity: parseFloat(el.querySelector('[name="lineQty"]').value) || 0,
        unitPrice: parseFloat(el.querySelector('[name="linePrice"]').value) || 0,
        unitCode: el.querySelector('[name="lineUnit"]').value.trim() || 'MON'
      });
    });
    return {
      invoiceNumber: fd.get('invoiceNumber'),
      issueDate: fd.get('issueDate'),
      periodStart: fd.get('periodStart'),
      periodEnd: fd.get('periodEnd'),
      buyerReference: fd.get('buyerReference'),
      currency: fd.get('currency') || 'EUR',
      sellerName: fd.get('sellerName'),
      sellerVatId: fd.get('sellerVatId'),
      sellerStreet: fd.get('sellerStreet'),
      sellerCity: fd.get('sellerCity'),
      sellerEmail: fd.get('sellerEmail'),
      sellerIban: fd.get('sellerIban'),
      buyerName: fd.get('buyerName'),
      buyerVatId: fd.get('buyerVatId'),
      buyerStreet: fd.get('buyerStreet'),
      buyerCity: fd.get('buyerCity'),
      buyerEmail: fd.get('buyerEmail'),
      lines,
      vatRate: 19
    };
  }

  // -------- Totals (live) --------
  function updateTotals() {
    const inv = readInvoice();
    const t = XR.computeTotals(inv.lines, 19);
    totalsEl.innerHTML = `
      <div class="totals-row"><span>Nettosumme</span><span>${fmtEUR(t.netTotal)}</span></div>
      <div class="totals-row"><span>MwSt (${t.vatRate}%)</span><span>${fmtEUR(t.vatAmount)}</span></div>
      <div class="totals-row total"><span>Rechnungsbetrag</span><span>${fmtEUR(t.grossTotal)}</span></div>
    `;
  }

  // -------- Submit → generate --------
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const inv = readInvoice();
    const v = XR.validate(inv);

    // Validation panel
    renderValidation(v);

    if (!v.valid) {
      switchTab('validation');
      return;
    }

    const xml = XR.buildXML(inv);

    // Preview
    previewEl.innerHTML = renderPreview(inv);

    // XML
    xmlEl.innerHTML = '<code>' + XR.highlight(xml) + '</code>';
    xmlEl.dataset.raw = xml;
    copyBtn.disabled = false;
    downloadBtn.disabled = false;

    // Switch to preview after success
    switchTab('preview');

    // Scroll to output
    document
      .querySelector('.output-col')
      .scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // -------- Copy / Download --------
  copyBtn.addEventListener('click', async () => {
    const raw = xmlEl.dataset.raw;
    if (!raw) return;
    try {
      await navigator.clipboard.writeText(raw);
      flash(copyBtn, 'Kopiert ✓');
    } catch {
      flash(copyBtn, 'Fehler');
    }
  });

  downloadBtn.addEventListener('click', () => {
    const raw = xmlEl.dataset.raw;
    if (!raw) return;
    const inv = readInvoice();
    const blob = new Blob([raw], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xrechnung_${(inv.invoiceNumber || 'RE').replace(/\s+/g, '_')}.xml`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    flash(downloadBtn, 'Geladen ✓');
  });

  // -------- Demo data --------
  fillDemoBtn.addEventListener('click', () => {
    form.invoiceNumber.value = 'RE-2026-00042';
    form.issueDate.value = today;
    form.periodStart.value = firstOfMonth(today);
    form.periodEnd.value = lastOfMonth(today);
    form.buyerReference.value = '04011000-12345-67';
    form.sellerName.value = 'Storage24 GmbH';
    form.sellerVatId.value = 'DE123456789';
    form.sellerStreet.value = 'Hauptstraße 1';
    form.sellerCity.value = '73547 Lorch';
    form.sellerEmail.value = 'rechnungen@storage24.de';
    form.sellerIban.value = 'DE89 3704 0044 0532 0130 00';
    form.buyerName.value = 'Mustermann Biedermeier-Handel';
    form.buyerVatId.value = 'DE987654321';
    form.buyerStreet.value = 'Musterweg 42';
    form.buyerCity.value = '10115 Berlin';
    form.buyerEmail.value = 'kunde@biedermeier-handel.de';
    renderLines(defaultLines);
    updateTotals();
    flash(fillDemoBtn, 'Geladen ✓');
  });

  // -------- Tabs --------
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  function switchTab(name) {
    document.querySelectorAll('.tab').forEach((t) => {
      const on = t.dataset.tab === name;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on);
    });
    document.querySelectorAll('.tab-panel').forEach((p) => {
      p.classList.toggle('active', p.dataset.panel === name);
    });
  }

  // -------- Render helpers --------
  function renderPreview(inv) {
    const t = XR.computeTotals(inv.lines, 19);
    const rows = inv.lines
      .map(
        (l, i) => `<tr>
        <td>${i + 1}</td>
        <td>${esc(l.description)}</td>
        <td class="num">${Number(l.quantity).toFixed(2)}</td>
        <td class="num">${fmtEUR(l.unitPrice)}</td>
        <td class="num">${fmtEUR(Number(l.quantity) * Number(l.unitPrice))}</td>
      </tr>`
      )
      .join('');

    return `<div class="preview-inv">
      <div class="preview-head">
        <div>
          <h3>${esc(inv.sellerName)}</h3>
          <p style="font-size:11px;color:var(--color-text-muted)">${esc(inv.sellerStreet)} · ${esc(inv.sellerCity)} · USt-ID ${esc(inv.sellerVatId)}</p>
        </div>
        <div class="preview-meta">
          <div><strong>Rechnung ${esc(inv.invoiceNumber)}</strong></div>
          <div>Datum: ${fmtDate(inv.issueDate)}</div>
          <div>Leistung: ${fmtDate(inv.periodStart)} – ${fmtDate(inv.periodEnd)}</div>
          <div>Leitweg-ID: ${esc(inv.buyerReference)}</div>
        </div>
      </div>
      <div class="preview-addrs">
        <div class="preview-addr">
          <h4>Rechnungsempfänger</h4>
          <p><strong>${esc(inv.buyerName)}</strong><br>${esc(inv.buyerStreet)}<br>${esc(inv.buyerCity)}${inv.buyerVatId ? '<br>USt-ID ' + esc(inv.buyerVatId) : ''}</p>
        </div>
        <div class="preview-addr">
          <h4>Zahlung</h4>
          <p>IBAN: <span style="font-family:var(--font-mono);font-size:11px">${esc(inv.sellerIban)}</span><br>Verwendungszweck: ${esc(inv.invoiceNumber)}<br>Fällig: ${fmtDate(XR.addDays(inv.issueDate, 14))}</p>
        </div>
      </div>
      <table class="preview-table">
        <thead><tr><th style="width:24px">#</th><th>Leistung</th><th style="width:60px;text-align:right">Menge</th><th style="width:100px;text-align:right">Einzel</th><th style="width:100px;text-align:right">Gesamt</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="preview-totals">
        <div class="row"><span>Nettosumme</span><span>${fmtEUR(t.netTotal)}</span></div>
        <div class="row"><span>MwSt (${t.vatRate}%)</span><span>${fmtEUR(t.vatAmount)}</span></div>
        <div class="row total"><span>Rechnungsbetrag</span><span>${fmtEUR(t.grossTotal)}</span></div>
      </div>
      <div class="preview-footer">
        Elektronische Rechnung gemäß § 14 UStG / Wachstumschancengesetz.<br>
        Format: XRechnung 3.0 (UBL 2.1) · EN 16931-konform.
      </div>
    </div>`;
  }

  function renderValidation(v) {
    const checkIcon =
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    const crossIcon =
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

    const items = v.checks
      .map(
        (c) => `<div class="val-item${c.pass ? '' : ' fail'}">
        ${c.pass ? checkIcon : crossIcon}
        <div>
          <span class="bt">${c.bt}</span>
          <strong>${esc(c.label)}</strong> — <span>${esc(c.message)}</span>
        </div>
      </div>`
      )
      .join('');

    validationEl.innerHTML = `
      <div class="validation-list">${items}</div>
      <div class="val-summary">
        <strong>${v.valid ? '✓ EN 16931-Pflichtfelder vollständig' : '✗ Pflichtfelder fehlen'}</strong>
        ${v.passed} von ${v.total} Prüfungen bestanden.
        ${
          v.valid
            ? 'Die XML kann dem <a href="https://github.com/itplr-kosit/validator" target="_blank" rel="noopener">KoSIT-Validator</a> übergeben werden.'
            : 'Bitte Pflichtfelder ergänzen.'
        }
      </div>
    `;
  }

  // -------- Utils --------
  function fmtEUR(n) {
    return Number(n).toLocaleString('de-DE', {
      style: 'currency',
      currency: 'EUR'
    });
  }

  function fmtDate(s) {
    if (!s) return '';
    const [y, m, d] = s.split('-');
    return `${d}.${m}.${y}`;
  }

  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escAttr(s) {
    return esc(s).replace(/"/g, '&quot;');
  }

  function flash(btn, text) {
    const orig = btn.textContent;
    btn.textContent = text;
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = orig;
      btn.disabled = false;
    }, 1200);
  }

  // Initial totals
  updateTotals();
})();
