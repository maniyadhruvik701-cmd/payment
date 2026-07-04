import sys
with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

import re

new_render_table = """// ── Update Dashboard Cards ─────────────────────────────────────
function updateDashboardCards() {
  const hasSalesFilter = filterStartNum !== null && filterEndNum !== null;
  const hasShipFilter = shipFilterStartNum !== null && shipFilterEndNum !== null;
  const hasDocFilter = docFilterStartNum !== null && docFilterEndNum !== null;

  let sCount = 0, sAmount = 0;
  let rCount = 0, rAmount = 0;
  let shCount = 0, shAmount = 0;
  let docClrCount = 0, docClrAmount = 0;
  let docNotClrCount = 0, docNotClrAmount = 0;

  for (let i = 0; i < allRows.length; i++) {
    const r = allRows[i];
    const isShipping = r.orderSource === 'file3_deduction';

    if (!isShipping) {
      let includeSales = true;
      if (hasSalesFilter) {
        const rowDateNum = parseDateToNum(r.invoiceDate);
        includeSales = (rowDateNum !== null && rowDateNum >= filterStartNum && rowDateNum <= filterEndNum);
      }
      if (includeSales) {
        if (r.fwdVal != null && r.fwdVal > 0) {
          sCount++;
          sAmount += r.fwdVal;
        }
        if (r.retVal != null && r.retVal > 0) {
          rCount++;
          rAmount += r.retVal;
        }
      }
    } else {
      let includeShip = true;
      let clrToUse = r.clrDate;
      if (!clrToUse && r.custOrder && String(r.custOrder).includes('Clr:')) {
        const match = String(r.custOrder).match(/Clr:\\s*([\\d-]+)/);
        if (match) clrToUse = match[1];
      }
      
      if (hasShipFilter) {
        if (!clrToUse) {
          includeShip = false;
        } else {
          const clrNum = parseDateToNum(clrToUse);
          includeShip = (clrNum !== null && clrNum >= shipFilterStartNum && clrNum <= shipFilterEndNum);
        }
      }
      if (includeShip) {
        shCount++;
        shAmount += (r.netVal || 0);
      }

      let includeDoc = true;
      if (hasDocFilter) {
        let docToUse = r.docDate;
        if (!docToUse && r.custOrder && String(r.custOrder).includes('Doc:')) {
          const match = String(r.custOrder).match(/Doc:\\s*([\\d-]+)/);
          if (match) docToUse = match[1];
        }
        if (!docToUse) {
          includeDoc = false;
        } else {
          const docNum = parseDateToNum(docToUse);
          includeDoc = (docNum !== null && docNum >= docFilterStartNum && docNum <= docFilterEndNum);
        }
      }
      if (includeDoc) {
        if (clrToUse) {
          docClrCount++;
          docClrAmount += (r.netVal || 0);
        } else {
          docNotClrCount++;
          docNotClrAmount += (r.netVal || 0);
        }
      }
    }
  }

  const formatAmt = (amt) => '₹' + amt.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2});

  if (hasSalesFilter) {
    dashSalesCount.textContent = sCount;
    dashSalesAmount.textContent = formatAmt(sAmount);
    dashReturnsCount.textContent = rCount;
    dashReturnsAmount.textContent = formatAmt(-rAmount);
  } else {
    dashSalesCount.textContent = '0';
    dashSalesAmount.textContent = '₹0.00';
    dashReturnsCount.textContent = '0';
    dashReturnsAmount.textContent = '₹0.00';
  }

  if (hasShipFilter) {
    dashShipCount.textContent = shCount;
    dashShipAmount.textContent = formatAmt(shAmount);
  } else {
    dashShipCount.textContent = '0';
    dashShipAmount.textContent = '₹0.00';
  }

  if (hasDocFilter) {
    dashDocClrCount.textContent = docClrCount;
    dashDocClrAmount.textContent = formatAmt(docClrAmount);
    dashDocNotClrCount.textContent = docNotClrCount;
    dashDocNotClrAmount.textContent = formatAmt(docNotClrAmount);
  } else {
    dashDocClrCount.textContent = '0';
    dashDocClrAmount.textContent = '₹0.00';
    dashDocNotClrCount.textContent = '0';
    dashDocNotClrAmount.textContent = '₹0.00';
  }
}

// ── Render Table ───────────────────────────────────────────────
function renderTable(filter, resetPage = true) {
  if (resetPage) currentPage = 1;
  const query = searchInput.value.trim().toUpperCase();

  let rows = [];
  for (let i = 0; i < allRows.length; i++) {
    const r = allRows[i];
    if (filter === 'invoice' && r.orderSource !== 'invoice') continue;
    if (filter === 'fwd' && r.orderSource !== 'fwd') continue;
    if (filter === 'missing' && r.orderSource !== 'missing') continue;
    if (filter === 'returns' && !(r.retVal !== null && r.retVal > 0)) continue;
    
    if (query) {
      if (
        !(r.invoice && r.invoice.toUpperCase().includes(query)) &&
        !(r.fwdPo && r.fwdPo.toUpperCase().includes(query)) &&
        !(r.custOrder && String(r.custOrder).toUpperCase().includes(query))
      ) {
        continue;
      }
    }
    rows.push(r);
  }

  tableBody.innerHTML = '';

  if (!rows.length) {
    tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--clr-text-muted);padding:28px">No rows found</td></tr>`;
    if (paginationControls) paginationControls.style.display = 'none';
    return;
  }

  const totalItems = rows.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
  if (currentPage > totalPages) currentPage = totalPages;

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
  const paginatedRows = rows.slice(startIndex, endIndex);

  if (paginationControls) {
    paginationControls.style.display = 'flex';
    pageInfo.textContent = `Showing ${startIndex + 1} to ${endIndex} of ${totalItems} entries`;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
  }

  let ordersFwd = 0, ordersRet = 0, ordersNet = 0, dvNet = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.orderSource !== 'file3_deduction') {
      ordersFwd += (r.fwdVal || 0);
      ordersRet += (r.retVal || 0);
      ordersNet += (r.netVal || 0);
    } else {
      dvNet += (r.netVal || 0);
    }
  }
  const finalNet = ordersNet + dvNet;

  let dvSectionAdded = false;
  let htmlArr = [];

  paginatedRows.forEach(r => {
    if (r.orderSource === 'file3_deduction' && !dvSectionAdded) {
      dvSectionAdded = true;
      htmlArr.push(`<tr><td colspan="8" style="background:rgba(251,191,36,0.1);color:var(--clr-warning);text-align:center;font-weight:600;letter-spacing:1px;font-size:0.8rem;padding:12px">⬇ SHIPPING CHARGES / DEDUCTIONS ⬇</td></tr>`);
    }

    const fwdCell = r.fwdVal != null
      ? `<span class="price-fwd">₹${r.fwdVal.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>`
      : `<span style="color:var(--clr-text-dim)">—</span>`;

    const retCell = r.retVal != null && r.retVal > 0
      ? `<span class="price-ret">−₹${r.retVal.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>`
      : `<span style="color:var(--clr-text-dim)">—</span>`;

    const shippingCell = (r.orderSource === 'file3_deduction' && r.netVal != null)
      ? `<span class="price-net ${r.netVal < 0 ? 'price-net-neg' : ''}" style="color:var(--clr-warning)">₹${r.netVal.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>`
      : `<span style="color:var(--clr-text-dim)">—</span>`;

    let orderBadgeHtml = orderBadge(r.orderSource);
    if (r.orderSource === 'file2_return') {
      orderBadgeHtml = `<span class="badge" style="background:rgba(248,113,113,0.15);color:#f87171">Direct Return</span>`;
    } else if (r.orderSource === 'file3_deduction') {
      orderBadgeHtml = `<span class="badge" style="background:rgba(251,191,36,0.15);color:var(--clr-warning)">Deduction</span>`;
    }

    htmlArr.push(`
      <tr data-source="${r.orderSource}">
        <td class="num">${r.idx}</td>
        <td class="mono">${esc(r.invoice) || dash()}</td>
        <td class="mono">${esc(r.fwdPo)   || dash()}</td>
        <td style="font-weight:600">${esc(r.custOrder) || dash()}</td>
        <td class="mono">${esc(r.invoiceDate) || dash()}</td>
        <td>${fwdCell}</td>
        <td>${retCell}</td>
        <td>${shippingCell}</td>
      </tr>
    `);
  });

  tableBody.innerHTML = htmlArr.join('');

  // Footer total rows
  const tfoot = document.getElementById('tableFooter');
  if (tfoot) {
    tfoot.innerHTML = `
      <tr class="total-row" style="background:var(--clr-bg)">
        <td colspan="5" style="text-align:right;font-weight:600;color:var(--clr-text-muted);font-size:0.8rem;letter-spacing:0.05em">
          TOTAL (Orders)
        </td>
        <td><span class="price-fwd">₹${ordersFwd.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</span></td>
        <td><span class="price-ret">−₹${ordersRet.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</span></td>
        <td></td>
      </tr>
      <tr class="total-row" style="background:rgba(251,191,36,0.05)">
        <td colspan="7" style="text-align:right;font-weight:600;color:var(--clr-warning);font-size:0.8rem;letter-spacing:0.05em">
          SHIPPING CHARGES (File 3)
        </td>
        <td><span class="price-net ${dvNet < 0 ? 'price-net-neg' : ''}" style="color:var(--clr-warning)">₹${dvNet.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</span></td>
      </tr>
      <tr class="total-row" style="background:rgba(6,182,212,0.1)">
        <td colspan="7" style="text-align:right;font-weight:800;color:var(--clr-accent);font-size:0.85rem;letter-spacing:0.05em">
          FINAL NET BALANCE
        </td>
        <td><span class="price-net ${finalNet < 0 ? 'price-net-neg' : ''}" style="font-size:1.1rem;font-weight:800;color:var(--clr-accent)">₹${finalNet.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</span></td>
      </tr>
    `;
  }
}
"""

start_idx = content.find('// ── Render Table ───────────────────────────────────────────────')
end_idx = content.find('// ── Filter tabs ────────────────────────────────────────────────')

if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + new_render_table + content[end_idx:]

filter_str_old = """// ── Dashboard Filter ───────────────────────────────────────────
generateReportBtn.addEventListener('click', () => {
  const s = startDateInput.value;
  const e = endDateInput.value;
  if (!s || !e) {
    alert("Please select both Start and End Dates");
    return;
  }
  filterStartNum = parseInt(s.split('-').join(''), 10);
  filterEndNum   = parseInt(e.split('-').join(''), 10);
  const activeTab = document.querySelector('.tab.active');
  renderTable(activeTab ? activeTab.dataset.filter : 'all');
});

clearReportBtn.addEventListener('click', () => {
  startDateInput.value = '';
  endDateInput.value = '';
  filterStartNum = null;
  filterEndNum = null;
  const activeTab = document.querySelector('.tab.active');
  renderTable(activeTab ? activeTab.dataset.filter : 'all');
});

// ── Shipping Dashboard Filter ──────────────────────────────────
generateShipBtn.addEventListener('click', () => {
  const s = shipStartDate.value;
  const e = shipEndDate.value;
  if (!s || !e) {
    alert("Please select both Start and End Dates for Shipping Charges");
    return;
  }
  shipFilterStartNum = parseInt(s.split('-').join(''), 10);
  shipFilterEndNum   = parseInt(e.split('-').join(''), 10);
  const activeTab = document.querySelector('.tab.active');
  renderTable(activeTab ? activeTab.dataset.filter : 'all');
});

clearShipBtn.addEventListener('click', () => {
  shipStartDate.value = '';
  shipEndDate.value = '';
  shipFilterStartNum = null;
  shipFilterEndNum = null;
  const activeTab = document.querySelector('.tab.active');
  renderTable(activeTab ? activeTab.dataset.filter : 'all');
});

// ── Doc Dashboard Filter ───────────────────────────────────────
if (generateDocBtn) {
  generateDocBtn.addEventListener('click', () => {
    const s = docStartDate.value;
    const e = docEndDate.value;
    if (!s || !e) {
      alert("Please select both Start and End Dates for Doc Report");
      return;
    }
    docFilterStartNum = parseInt(s.split('-').join(''), 10);
    docFilterEndNum   = parseInt(e.split('-').join(''), 10);
    const activeTab = document.querySelector('.tab.active');
    renderTable(activeTab ? activeTab.dataset.filter : 'all');
  });
}

if (clearDocBtn) {
  clearDocBtn.addEventListener('click', () => {
    docStartDate.value = '';
    docEndDate.value = '';
    docFilterStartNum = null;
    docFilterEndNum = null;
    const activeTab = document.querySelector('.tab.active');
    renderTable(activeTab ? activeTab.dataset.filter : 'all');
  });
}"""

filter_str_new = """// ── Dashboard Filter ───────────────────────────────────────────
generateReportBtn.addEventListener('click', () => {
  const s = startDateInput.value;
  const e = endDateInput.value;
  if (!s || !e) {
    alert("Please select both Start and End Dates");
    return;
  }
  filterStartNum = parseInt(s.split('-').join(''), 10);
  filterEndNum   = parseInt(e.split('-').join(''), 10);
  updateDashboardCards();
});

clearReportBtn.addEventListener('click', () => {
  startDateInput.value = '';
  endDateInput.value = '';
  filterStartNum = null;
  filterEndNum = null;
  updateDashboardCards();
});

// ── Shipping Dashboard Filter ──────────────────────────────────
generateShipBtn.addEventListener('click', () => {
  const s = shipStartDate.value;
  const e = shipEndDate.value;
  if (!s || !e) {
    alert("Please select both Start and End Dates for Shipping Charges");
    return;
  }
  shipFilterStartNum = parseInt(s.split('-').join(''), 10);
  shipFilterEndNum   = parseInt(e.split('-').join(''), 10);
  updateDashboardCards();
});

clearShipBtn.addEventListener('click', () => {
  shipStartDate.value = '';
  shipEndDate.value = '';
  shipFilterStartNum = null;
  shipFilterEndNum = null;
  updateDashboardCards();
});

// ── Doc Dashboard Filter ───────────────────────────────────────
if (generateDocBtn) {
  generateDocBtn.addEventListener('click', () => {
    const s = docStartDate.value;
    const e = docEndDate.value;
    if (!s || !e) {
      alert("Please select both Start and End Dates for Doc Report");
      return;
    }
    docFilterStartNum = parseInt(s.split('-').join(''), 10);
    docFilterEndNum   = parseInt(e.split('-').join(''), 10);
    updateDashboardCards();
  });
}

if (clearDocBtn) {
  clearDocBtn.addEventListener('click', () => {
    docStartDate.value = '';
    docEndDate.value = '';
    docFilterStartNum = null;
    docFilterEndNum = null;
    updateDashboardCards();
  });
}"""

content = content.replace(filter_str_old, filter_str_new)

search_old = """// ── Live Table Search ───────────────────────────────────────────
searchInput.addEventListener('input', () => {
  const activeTab = document.querySelector('.tab.active');
  const filter = activeTab ? activeTab.dataset.filter : 'all';
  renderTable(filter);
});"""

search_new = """// ── Live Table Search ───────────────────────────────────────────
let searchTimeout;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const activeTab = document.querySelector('.tab.active');
    const filter = activeTab ? activeTab.dataset.filter : 'all';
    renderTable(filter);
  }, 250);
});"""
content = content.replace(search_old, search_new)

content = content.replace("renderTable('all');\\n  \\n  // Save to DB", "renderTable('all');\\n  updateDashboardCards();\\n  \\n  // Save to DB")
content = content.replace("renderTable('all');\\n    \\n    // Switch to Dashboard", "renderTable('all');\\n    updateDashboardCards();\\n    \\n    // Switch to Dashboard")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')
