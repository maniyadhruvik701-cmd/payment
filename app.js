/**
 * Order Lookup Tool - app.js (v2 - Two File Support)
 *
 * FILE 1 (Main Orders Sheet):
 *   - Cust Order No      (Col A)
 *   - FWD PO NO          (Col D)  ← match key
 *   - Seller Invoice No  (Col F)  ← match key
 *
 * FILE 2 (Value / Price Sheet):
 *   - Invoice Number     ← matches File1's Seller Invoice No
 *   - Forward PO Number  ← matches File1's FWD PO NO
 *   - Value              ← the price we want
 *
 * LOGIC per row:
 *   1. Get Cust Order No: try Seller Invoice → FWD PO
 *   2. Get Value:         try Invoice Number match → Forward PO Number match (sum)
 */

// ── Column names — FILE 1 (flexible variants) ───────────────────────
const COL1_VARIANTS = {
  CUST_ORDER:    ['Cust Order No', 'Cust Order Number', 'Customer Order No'],
  FWD_PO:        ['FWD PO NO', 'FWD PO No', 'Forward PO Number', 'FWD PO Number'],
  SELLER_INVOICE:['Seller Invoice No', 'FWD Seller Invoice No', 'Invoice No',
                  'Seller Invoice Number', 'Invoice Number', 'Seller Invoice'],
  SELLER_INVOICE_DATE: ['Seller Invoice Date', 'Invoice Date', 'Seller Invoice Date '],
};

// Helper: get value from row trying multiple column name variants
function getCol(row, variants) {
  for (const v of variants) {
    if (row[v] !== undefined && row[v] !== '') return String(row[v]).trim();
  }
  return '';
}

// ── Column names — FILE 2 (flexible variants) ───────────────────────
const COL2_VARIANTS = {
  JOURNEY_TYPE: ['Journey Type', 'journey type', 'JourneyType'],
  INVOICE_NUM:  ['Invoice Number', 'Invoice No', 'InvoiceNumber', 'Seller Invoice No'],
  FWD_PO_NUM:   ['Forward PO Number', 'Forward PO No', 'FWD PO NO', 'FWD PO Number'],
  VALUE:        ['Value', 'Amount', 'Invoice Amount', 'Net Value'],
  ORDER_NO:     ['Order No', 'Order Number', 'Cust Order No', 'Order Id'],
  ORDER_DATE:   ['Order Date', 'OrderDate', 'ORDER DATE'],
};

function getCol2(row, variants) {
  for (const v of variants) {
    if (row[v] !== undefined && row[v] !== '') return row[v];
  }
  return '';
}

// ── Column names — FILE 3 (flexible variants) ───────────────────────
const COL3_VARIANTS = {
  REFERENCE:     ['REFERENCE', 'Reference', 'Doc No'],
  AMOUNT:        ['AMOUNT', 'Amount', 'Value'],
  CLEARING_DATE: ['CLEARINGDOCUMENTDATE', 'Clearing Date', 'CLEARING DOCUMENT DATE'],
  DOC_DATE:      ['DOCDATE', 'Doc Date', 'DocDate'],
  TYPE:          ['TYPE', 'Type', 'type']
};

function getCol3(row, variants) {
  for (const v of variants) {
    if (row[v] !== undefined && row[v] !== '') return row[v];
  }
  return '';
}

function formatExcelDate(val) {
  if (!val) return '';
  
  // 1) Excel serial date
  if (!isNaN(val) && typeof val === 'number') {
    const date = new Date((val - 25569) * 86400 * 1000);
    const local = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
    const d = String(local.getDate()).padStart(2, '0');
    const m = String(local.getMonth() + 1).padStart(2, '0');
    const y = local.getFullYear();
    return `${d}-${m}-${y}`;
  }

  // 2) Try to handle already formatted DD-MM-YYYY, DD/MM/YYYY, or DD.MM.YYYY
  const strVal = String(val).trim();
  if (/^\d{2}[-\/\.]\d{2}[-\/\.]\d{4}$/.test(strVal)) {
    return strVal.replace(/[\/\.]/g, '-');
  }

  // 3) Try parsing as JS Date object / Date string
  let dateObj = new Date(val);
  
  // If parsing failed due to 'IST' etc, try stripping the timezone
  if (isNaN(dateObj.getTime()) && typeof val === 'string') {
    const cleaned = val.replace(/ (IST|GMT|UTC|PST|EST) /ig, ' ');
    dateObj = new Date(cleaned);
  }

  if (!isNaN(dateObj.getTime())) {
    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const y = dateObj.getFullYear();
    return `${d}-${m}-${y}`;
  }
  
// Fallback
  return strVal;
}

// ── Firebase Configuration ───────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyC9AeKDlWhWTgNbzW3E0C6HQXxC7NvQVm8",
  authDomain: "payment-6ab8b.firebaseapp.com",
  databaseURL: "https://payment-6ab8b-default-rtdb.firebaseio.com",
  projectId: "payment-6ab8b",
  storageBucket: "payment-6ab8b.firebasestorage.app",
  messagingSenderId: "266575387656",
  appId: "1:266575387656:web:c2c743903793ca7cd805bd",
  measurementId: "G-ZFD8KKQSVY"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

let currentUserUid = null;

// Auth Logic
auth.onAuthStateChanged(user => {
  const loginScreen = document.getElementById('loginScreen');
  const mainApp = document.getElementById('mainApp');
  
  if (user) {
    currentUserUid = user.uid;
    loginScreen.style.display = 'none';
    mainApp.style.display = 'flex';
    // Load state now that user is authenticated
    if (typeof loadState === 'function') {
      loadState();
    }
  } else {
    currentUserUid = null;
    loginScreen.style.display = 'flex';
    mainApp.style.display = 'none';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const btnLogin = document.getElementById('btnLogin');
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  const loginError = document.getElementById('loginError');

  if (btnLogin) {
    btnLogin.addEventListener('click', () => {
      const email = loginEmail.value.trim();
      const pass = loginPassword.value;
      loginError.style.display = 'none';
      
      if (!email || !pass) {
        loginError.textContent = 'Please enter both email and password.';
        loginError.style.display = 'block';
        return;
      }
      
      btnLogin.textContent = 'Signing In...';
      auth.signInWithEmailAndPassword(email, pass)
        .then(() => {
          btnLogin.textContent = 'Sign In';
        })
        .catch(error => {
          btnLogin.textContent = 'Sign In';
          loginError.textContent = 'Login failed: ' + error.message;
          loginError.style.display = 'block';
        });
    });
  }
});

async function saveToDB(key, data) {
  if (!currentUserUid) return;
  const finalKey = `${key}_${currentPlatform}`;
  try {
    await database.ref(`users/${currentUserUid}/${finalKey}`).set(data);
  } catch (err) {
    console.error("Firebase Save Error:", err);
  }
}

async function loadFromDB(key) {
  if (!currentUserUid) return null;
  const finalKey = `${key}_${currentPlatform}`;
  try {
    const snapshot = await database.ref(`users/${currentUserUid}/${finalKey}`).once('value');
    return snapshot.val();
  } catch (err) {
    console.error("Firebase Load Error:", err);
    return null;
  }
}

async function clearDB() {
  if (!currentUserUid) return;
  const finalKey = `reportState_${currentPlatform}`;
  const rtvKey = `rtvState_${currentPlatform}`;
  try {
    await database.ref(`users/${currentUserUid}/${finalKey}`).remove();
    await database.ref(`users/${currentUserUid}/${rtvKey}`).remove();
  } catch (err) {
    console.error("Firebase Clear Error:", err);
  }
}

// ── State ──────────────────────────────────────────────────────
let rawData1 = [];   // File 1 rows
let rawData2 = [];   // File 2 rows
let rawData3 = [];   // File 3 rows
let allRows  = [];   // Final merged rows

let file1Ready = false;
let file2Ready = false;
let file3Ready = false;

// RTV Matcher State
let rawMktData = [];
let rawRtvData = [];
let mktReady = false;
let rtvReady = false;
let rtvResultsRows = [];

// Platform State
let currentPlatform = localStorage.getItem('currentPlatform') || 'AJIO';

// Dashboard Filter State
let filterStartNum = null;
let filterEndNum   = null;
let shipFilterStartNum = null;
let shipFilterEndNum = null;
let docFilterStartNum = null;
let docFilterEndNum = null;

// Pagination State
let currentPage = 1;
const PAGE_SIZE = 250;

function parseDateToNum(dateString) {
  if (!dateString || dateString.trim() === '' || dateString === '—') return null;
  const cleaned = dateString.replace(/[\.\/]/g, '-');
  const parts = cleaned.split('-');
  if (parts.length === 3) {
    return parseInt(parts[2] + parts[1] + parts[0], 10);
  }
  return null;
}

// Maps built from File 2
let forwardByInvoice = new Map();  // Invoice Number → FORWARD value sum
let returnByInvoice  = new Map();  // Invoice Number → RETURN value sum (positive)
let forwardByFwdPo   = new Map();  // Forward PO No  → FORWARD value sum
let returnByFwdPo    = new Map();  // Forward PO No  → RETURN value sum (positive)
let directReturns    = [];         // Array to collect non-AJIO/blank returns directly from File 2

// ── DOM ────────────────────────────────────────────────────────
const fileInput1  = document.getElementById('fileInput1');
const fileInput2  = document.getElementById('fileInput2');
const fileInput3  = document.getElementById('fileInput3');
const uploadZone1 = document.getElementById('uploadZone1') || document.getElementById('uploadCard1');
const uploadZone2 = document.getElementById('dropZone2');
const uploadZone3 = document.getElementById('dropZone3');
const fileStatus1 = document.getElementById('fileStatus1');
const fileStatus2 = document.getElementById('fileStatus2');
const fileStatus3 = document.getElementById('fileStatus3');
const fileStatus1Text = document.getElementById('fileStatus1Text');
const fileStatus2Text = document.getElementById('fileStatus2Text');
const fileStatus3Text = document.getElementById('fileStatus3Text');
const processRow  = document.getElementById('processRow');
const processBtn  = document.getElementById('processBtn');
const statusBar   = document.getElementById('statusBar');
const statusIcon  = document.getElementById('statusIcon');
const statusText  = document.getElementById('statusText');
const pillTotal   = document.getElementById('pillTotal');
const pillFound   = document.getElementById('pillFound');
const pillFwd     = document.getElementById('pillFwd');
const pillMissing = document.getElementById('pillMissing');
const pillGrand   = document.getElementById('pillGrand');
const searchCard  = document.getElementById('searchCard');
const searchInput = document.getElementById('searchInput');
const searchBtn   = document.getElementById('searchBtn');
const searchResult= document.getElementById('searchResult');
const actionsRow  = document.getElementById('actionsRow');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn    = document.getElementById('resetBtn');
const tableCard   = document.getElementById('tableCard');
const tableBody   = document.getElementById('tableBody');

const dashboardCard     = document.getElementById('dashboardCard');
const startDateInput    = document.getElementById('startDate');
const endDateInput      = document.getElementById('endDate');
const generateReportBtn = document.getElementById('generateReportBtn');
const clearReportBtn    = document.getElementById('clearReportBtn');
const dashSalesCount    = document.getElementById('dashSalesCount');
const dashSalesAmount   = document.getElementById('dashSalesAmount');
const dashReturnsCount  = document.getElementById('dashReturnsCount');
const dashReturnsAmount = document.getElementById('dashReturnsAmount');

// Shipping Dashboard Elements
const shipStartDate = document.getElementById('shipStartDate');
const shipEndDate = document.getElementById('shipEndDate');
const generateShipBtn = document.getElementById('generateShipBtn');
const clearShipBtn = document.getElementById('clearShipBtn');
const dashShipCount = document.getElementById('dashShipCount');
const dashShipAmount = document.getElementById('dashShipAmount');

// Doc Dashboard Elements
const docStartDate = document.getElementById('docStartDate');
const docEndDate = document.getElementById('docEndDate');
const generateDocBtn = document.getElementById('generateDocBtn');
const clearDocBtn = document.getElementById('clearDocBtn');
const dashDocClrCount = document.getElementById('dashDocClrCount');
const dashDocClrAmount = document.getElementById('dashDocClrAmount');
const dashDocNotClrCount = document.getElementById('dashDocNotClrCount');
const dashDocNotClrAmount = document.getElementById('dashDocNotClrAmount');
const dashboardDocCard = document.getElementById('dashboardDocCard');

// Sidebar Nav Elements
const navBtns = document.querySelectorAll('.nav-btn');
const viewSections = document.querySelectorAll('.view-section');

// Platform Switcher Elements
const btnPlatformAJIO = document.getElementById('btnPlatformAJIO');
const btnPlatformJIHU = document.getElementById('btnPlatformJIHU');
const platformTitle   = document.getElementById('platformTitle');

// Pagination Elements
const paginationControls = document.getElementById('paginationControls');
const pageInfo = document.getElementById('pageInfo');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');

prevPageBtn.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    renderTable(document.querySelector('.filter-tabs .active').dataset.filter, false);
  }
});
nextPageBtn.addEventListener('click', () => {
  currentPage++;
  renderTable(document.querySelector('.filter-tabs .active').dataset.filter, false);
});

// ── Platform Switching Logic ──────────────────────────────────
function applyPlatformStyles() {
  if (currentPlatform === 'AJIO') {
    btnPlatformAJIO.classList.add('active');
    btnPlatformAJIO.style.background = 'var(--clr-primary)';
    btnPlatformAJIO.style.color = '#fff';
    btnPlatformJIHU.classList.remove('active');
    btnPlatformJIHU.style.background = 'var(--clr-surface)';
    btnPlatformJIHU.style.color = 'var(--clr-text)';
    platformTitle.textContent = 'AJIO Lookup';
  } else {
    btnPlatformJIHU.classList.add('active');
    btnPlatformJIHU.style.background = 'var(--clr-primary)';
    btnPlatformJIHU.style.color = '#fff';
    btnPlatformAJIO.classList.remove('active');
    btnPlatformAJIO.style.background = 'var(--clr-surface)';
    btnPlatformAJIO.style.color = 'var(--clr-text)';
    platformTitle.textContent = 'JIHU Lookup';
  }
}

async function switchPlatform(platform) {
  if (currentPlatform === platform) return;
  currentPlatform = platform;
  localStorage.setItem('currentPlatform', currentPlatform);
  applyPlatformStyles();
  resetUIAndMemory();
  await loadState(); // Load new platform data
}

if (btnPlatformAJIO && btnPlatformJIHU) {
  btnPlatformAJIO.addEventListener('click', () => switchPlatform('AJIO'));
  btnPlatformJIHU.addEventListener('click', () => switchPlatform('JIHU'));
  applyPlatformStyles();
}

// ── Sidebar Navigation Logic ──────────────────────────────────
navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    // Deactivate all
    navBtns.forEach(b => b.classList.remove('active'));
    viewSections.forEach(v => v.style.display = 'none');
    
    // Activate target
    btn.classList.add('active');
    const target = btn.dataset.view;
    const targetEl = document.getElementById('view-' + target);
    if (targetEl) targetEl.style.display = 'block';
  });
});

// ── File Select Buttons ────────────────────────────────────────
const selectBtn1 = document.getElementById('selectBtn1');
if (selectBtn1) selectBtn1.addEventListener('click', () => fileInput1.click());

fileInput1.addEventListener('change', e => { if (e.target.files[0]) loadFile(e.target.files[0], 1); });
fileInput2.addEventListener('change', e => { if (e.target.files[0]) loadFile(e.target.files[0], 2); });
fileInput3.addEventListener('change', e => { if (e.target.files[0]) loadFile(e.target.files[0], 3); });

// ── Drag & Drop ────────────────────────────────────────────────
setupDrop(uploadZone1, 1);
setupDrop(uploadZone2, 2);
setupDrop(uploadZone3, 3);

function setupDrop(zone, fileNum) {
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f, fileNum);
  });
}

// ── Web Worker for Excel Parsing ─────────────────────────────────
const parseWorkerCode = `
  importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
  self.onmessage = function(e) {
    const { action, buffer, fileNum, fileName } = e.data;
    if (action === 'parseFile') {
      try {
        const wb = XLSX.read(buffer, { type: 'array' });
        let ws;
        
        // For MKT file (fileNum 4), specifically look for "AJIO RETURN" sheet
        if (fileNum === 4) {
          const targetSheetName = wb.SheetNames.find(name => name.toUpperCase().includes('AJIO RETURN'));
          if (targetSheetName) {
            ws = wb.Sheets[targetSheetName];
          } else {
            ws = wb.Sheets[wb.SheetNames[0]]; // fallback
          }
        } else {
          ws = wb.Sheets[wb.SheetNames[0]];
        }
        
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
        self.postMessage({ success: true, fileNum, data, fileName });
      } catch (err) {
        self.postMessage({ success: false, fileNum, error: err.message, fileName });
      }
    }
  };
`;
const parseWorkerBlob = new Blob([parseWorkerCode], { type: 'application/javascript' });
const parseWorker = new Worker(URL.createObjectURL(parseWorkerBlob));

parseWorker.onmessage = function(e) {
  const msg = e.data;
  const fileNum = msg.fileNum;
  
  let statusEl, textEl;
  if (fileNum === 1) { statusEl = fileStatus1; textEl = fileStatus1Text; }
  else if (fileNum === 2) { statusEl = fileStatus2; textEl = fileStatus2Text; }
  else if (fileNum === 3) { statusEl = fileStatus3; textEl = fileStatus3Text; }
  else if (fileNum === 4) { statusEl = document.getElementById('fileStatusMkt'); textEl = document.getElementById('fileStatusMktText'); }
  else if (fileNum === 5) { statusEl = document.getElementById('fileStatusRtv'); textEl = document.getElementById('fileStatusRtvText'); }

  if (msg.success) {
    if (fileNum === 1) {
      rawData1 = msg.data;
      file1Ready = true;
      updateStatus(statusEl, textEl, msg.fileName, msg.data.length, Object.keys(msg.data[0]||{}));
      if (file1Ready) show(processRow);
    } else if (fileNum === 2) {
      rawData2 = msg.data;
      file2Ready = true;
      updateStatus(statusEl, textEl, msg.fileName, msg.data.length, Object.keys(msg.data[0]||{}));
    } else if (fileNum === 3) {
      rawData3 = msg.data;
      file3Ready = true;
      updateStatus(statusEl, textEl, msg.fileName, msg.data.length, Object.keys(msg.data[0]||{}));
    } else if (fileNum === 4) {
      rawMktData = msg.data;
      mktReady = true;
      updateStatus(statusEl, textEl, msg.fileName, msg.data.length, Object.keys(msg.data[0]||{}));
      if (mktReady && rtvReady) show(document.getElementById('processRowRtv'));
    } else if (fileNum === 5) {
      rawRtvData = msg.data;
      rtvReady = true;
      updateStatus(statusEl, textEl, msg.fileName, msg.data.length, Object.keys(msg.data[0]||{}));
      if (mktReady && rtvReady) show(document.getElementById('processRowRtv'));
    }
  } else {
    alert('❌ Error reading file: ' + msg.error);
    if(statusEl) statusEl.style.display = 'none';
  }
};

// ── Load File ──────────────────────────────────────────────────
function loadFile(file, fileNum) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['xlsx','xls','csv'].includes(ext)) {
    alert('❌ Only .xlsx, .xls, .csv files supported!');
    return;
  }

  let statusEl, textEl;
  if (fileNum === 1) { statusEl = fileStatus1; textEl = fileStatus1Text; }
  else if (fileNum === 2) { statusEl = fileStatus2; textEl = fileStatus2Text; }
  else if (fileNum === 3) { statusEl = fileStatus3; textEl = fileStatus3Text; }
  else if (fileNum === 4) { statusEl = document.getElementById('fileStatusMkt'); textEl = document.getElementById('fileStatusMktText'); }
  else if (fileNum === 5) { statusEl = document.getElementById('fileStatusRtv'); textEl = document.getElementById('fileStatusRtvText'); }
  
  if (textEl) {
    textEl.innerHTML = `Parsing ${file.name} <span class="spinner" style="margin-left:8px; border-top-color:var(--clr-primary); width:12px; height:12px; border-width:2px;"></span>`;
  } else {
    statusEl.innerHTML = `<div><span class="file-status-icon"><span class="spinner" style="border-top-color:var(--clr-primary);"></span></span> <span class="status-main-text">Parsing ${file.name}...</span></div>`;
  }
  show(statusEl);

  const reader = new FileReader();
  reader.onload = e => {
    parseWorker.postMessage({ 
      action: 'parseFile', 
      buffer: e.target.result, 
      fileNum, 
      fileName: file.name 
    }, [e.target.result]);
  };
  reader.readAsArrayBuffer(file);
}

function updateStatus(statusEl, textEl, fileName, rowCount, cols) {
  if (textEl) {
    textEl.textContent = `${fileName} — ${rowCount} rows loaded`;
  } else {
    let innerSpan = statusEl.querySelector('.status-main-text');
    if (!innerSpan) {
      statusEl.innerHTML = `<div><span class="file-status-icon">&#9989;</span> <span class="status-main-text"></span></div>`;
      innerSpan = statusEl.querySelector('.status-main-text');
    }
    innerSpan.textContent = `${fileName} — ${rowCount} rows loaded`;
  }
  show(statusEl);
  const colDiv = statusEl.querySelector('.col-preview') || document.createElement('div');
  colDiv.className = 'col-preview';
  colDiv.innerHTML = `<span style="color:var(--clr-text-dim);font-size:0.72rem">« Columns: ${cols.join(' │ ')}</span>`;
  if (!statusEl.contains(colDiv)) statusEl.appendChild(colDiv);
}

// ── Process Button ─────────────────────────────────────────────
processBtn.addEventListener('click', () => {
  if (!file1Ready) { alert('Please upload File 1 (Orders sheet) first!'); return; }
  if (!file2Ready) { alert('Please upload File 2 (Value sheet) first!'); return; }
  buildResults();
});

// ── Build Value Maps from File 2 ───────────────────────────────
function buildValueMaps(data) {
  forwardByInvoice = new Map();
  returnByInvoice  = new Map();
  forwardByFwdPo   = new Map();
  returnByFwdPo    = new Map();
  directReturns    = [];

  data.forEach(row => {
    const journeyType = String(getCol2(row, COL2_VARIANTS.JOURNEY_TYPE) || '').trim().toUpperCase();
    const invNum      = String(getCol2(row, COL2_VARIANTS.INVOICE_NUM)  || '').trim();
    const fwdPo       = String(getCol2(row, COL2_VARIANTS.FWD_PO_NUM)   || '').trim();
    const rawVal      = Math.abs(parseFloat(getCol2(row, COL2_VARIANTS.VALUE)) || 0);
    const isReturn    = journeyType === 'RETURN';

    if (isReturn && !invNum.toUpperCase().startsWith(currentPlatform)) {
      const orderNo = String(getCol2(row, COL2_VARIANTS.ORDER_NO) || '').trim();
      const orderDate = formatExcelDate(getCol2(row, COL2_VARIANTS.ORDER_DATE));
      let existing = null;
      if (invNum) existing = directReturns.find(r => r.invoice === invNum.toUpperCase());
      else if (orderNo) existing = directReturns.find(r => r.orderNo === orderNo.toUpperCase() && !r.invoice);

      if (existing) {
        existing.retVal += rawVal;
      } else {
        directReturns.push({
          invoice: invNum.toUpperCase(),
          fwdPo: fwdPo.toUpperCase(),
          orderNo: orderNo.toUpperCase(),
          orderDate: orderDate,
          retVal: rawVal
        });
      }
    }

    if (invNum) {
      const key = invNum.toUpperCase();
      if (isReturn) {
        returnByInvoice.set(key, (returnByInvoice.get(key) || 0) + rawVal);
      } else {
        forwardByInvoice.set(key, (forwardByInvoice.get(key) || 0) + rawVal);
      }
    }
    if (fwdPo) {
      const key = fwdPo.toUpperCase();
      if (isReturn) {
        returnByFwdPo.set(key, (returnByFwdPo.get(key) || 0) + rawVal);
      } else {
        forwardByFwdPo.set(key, (forwardByFwdPo.get(key) || 0) + rawVal);
      }
    }
  });
}

// ── Build Results ──────────────────────────────────────────────
function buildResults() {
  show(statusBar);
  statusIcon.innerHTML = '<span class="spinner" style="border-top-color:var(--clr-primary);"></span>';
  statusText.textContent = 'Preparing data...';
  hide([pillTotal, pillFound, pillFwd, pillMissing, pillGrand]);

  setTimeout(() => {
    try {
      buildValueMaps(rawData2);

      const invoiceToOrder = new Map();
      const fwdPoToOrder   = new Map();
      const invoiceToDate  = new Map();
      const fwdPoToDate    = new Map();

      rawData1.forEach(row => {
        const custOrder = getCol(row, COL1_VARIANTS.CUST_ORDER);
        const invoice   = getCol(row, COL1_VARIANTS.SELLER_INVOICE);
        const fwdPo     = getCol(row, COL1_VARIANTS.FWD_PO);
        const invDate   = formatExcelDate(getCol(row, COL1_VARIANTS.SELLER_INVOICE_DATE));

        if (invoice && custOrder) invoiceToOrder.set(invoice.toUpperCase(), custOrder);
        if (fwdPo   && custOrder) fwdPoToOrder.set(fwdPo.toUpperCase(),   custOrder);
        if (invoice && invDate)   invoiceToDate.set(invoice.toUpperCase(), invDate);
        if (fwdPo   && invDate)   fwdPoToDate.set(fwdPo.toUpperCase(),     invDate);
      });

      allRows = [];
      const chunkSize = 2000;
      let currentIndex = 0;

      function processChunk() {
        const end = Math.min(currentIndex + chunkSize, rawData1.length);
        for (; currentIndex < end; currentIndex++) {
          const row = rawData1[currentIndex];
          const invoice = getCol(row, COL1_VARIANTS.SELLER_INVOICE);
          const fwdPo   = getCol(row, COL1_VARIANTS.FWD_PO);

          let custOrder   = '';
          let invoiceDate = '';
          let orderSource = 'missing';

          if (invoice) {
            const found = invoiceToOrder.get(invoice.toUpperCase());
            if (found) { custOrder = found; orderSource = 'invoice'; }
            const foundDate = invoiceToDate.get(invoice.toUpperCase());
            if (foundDate) { invoiceDate = foundDate; }
          }
          if (!custOrder && fwdPo) {
            const found = fwdPoToOrder.get(fwdPo.toUpperCase());
            if (found) { custOrder = found; orderSource = 'fwd'; }
          }
          if (!invoiceDate && fwdPo) {
            const foundDate = fwdPoToDate.get(fwdPo.toUpperCase());
            if (foundDate) { invoiceDate = foundDate; }
          }

          let fwdVal    = null;
          let retVal    = null;
          let valueSource = 'none';

          if (invoice) {
            const key = invoice.toUpperCase();
            const f   = forwardByInvoice.get(key);
            const r   = returnByInvoice.get(key);
            if (f !== undefined || r !== undefined) {
              fwdVal    = f || 0;
              retVal    = r || 0;
              valueSource = 'invoice';
            }
          }
          if (fwdVal === null && fwdPo) {
            const key = fwdPo.toUpperCase();
            const f   = forwardByFwdPo.get(key);
            const r   = returnByFwdPo.get(key);
            if (f !== undefined || r !== undefined) {
              fwdVal    = f || 0;
              retVal    = r || 0;
              valueSource = 'fwd';
            }
          }

          const netVal = (fwdVal !== null) ? (fwdVal - retVal) : null;

          allRows.push({
            idx:         currentIndex + 1,
            invoice:     invoice,
            fwdPo:       fwdPo,
            custOrder:   custOrder,
            invoiceDate: invoiceDate,
            orderSource: orderSource,
            fwdVal:      fwdVal,
            retVal:      retVal,
            netVal:      netVal,
            valueSource: valueSource,
          });
        }

        if (currentIndex < rawData1.length) {
          statusText.textContent = `Matching files... ${Math.round((currentIndex / rawData1.length) * 100)}%`;
          requestAnimationFrame(processChunk);
        } else {
          finishBuildResults();
        }
      }

      function finishBuildResults() {
        statusText.textContent = 'Finalizing...';
        
        requestAnimationFrame(() => {
          directReturns.forEach(dr => {
            allRows.push({
              idx:         allRows.length + 1,
              invoice:     dr.invoice,
              fwdPo:       dr.fwdPo,
              custOrder:   dr.orderNo,
              invoiceDate: dr.orderDate || '',
              orderSource: 'file2_return',
              fwdVal:      null,
              retVal:      dr.retVal,
              netVal:      -dr.retVal,
              valueSource: 'invoice',
            });
          });

          if (file3Ready && rawData3.length > 0) {
            rawData3.forEach(row => {
              const typeStr = String(getCol3(row, COL3_VARIANTS.TYPE) || '').trim().toUpperCase();
              if (typeStr.includes('ZK-CUST') || typeStr.includes('ZK CUST')) {
                const amt = -(parseFloat(getCol3(row, COL3_VARIANTS.AMOUNT)) || 0);
                const ref = String(getCol3(row, COL3_VARIANTS.REFERENCE) || '').trim();
                
                let cDate = formatExcelDate(getCol3(row, COL3_VARIANTS.CLEARING_DATE));
                let dDate = formatExcelDate(getCol3(row, COL3_VARIANTS.DOC_DATE));
                let dateStr = '';
                if (cDate && dDate) dateStr = `Doc: ${dDate} | Clr: ${cDate}`;
                else if (cDate) dateStr = `Clr: ${cDate}`;
                else if (dDate) dateStr = `Doc: ${dDate}`;

                allRows.push({
                  idx:         allRows.length + 1,
                  invoice:     ref,
                  fwdPo:       '',
                  custOrder:   dateStr,
                  invoiceDate: '',
                  orderSource: 'file3_deduction',
                  fwdVal:      null,
                  retVal:      null,
                  netVal:      amt,
                  valueSource: 'file3',
                  clrDate:     cDate || '',
                  docDate:     dDate || '',
                });
              }
            });
          }

          const total      = allRows.length;
          const foundInv   = allRows.filter(r => r.orderSource === 'invoice').length;
          const foundFwd   = allRows.filter(r => r.orderSource === 'fwd').length;
          const missing    = allRows.filter(r => r.orderSource === 'missing').length;
          const grandFwd     = allRows.reduce((s, r) => s + (r.fwdVal || 0), 0);
          const grandRet     = allRows.reduce((s, r) => s + (r.retVal || 0), 0);
          const grandNet     = allRows.reduce((s, r) => s + (r.netVal || 0), 0);
          const dvRows       = allRows.filter(r => r.orderSource === 'file3_deduction');
          const file3Count   = dvRows.length;
          const grandDv      = dvRows.reduce((s, r) => s + (r.netVal || 0), 0);
          const directRet    = allRows.filter(r => r.orderSource === 'file2_return').length;

          statusIcon.textContent = '✅';
          statusText.textContent = `${total} rows processed`;

          showPill(pillTotal,   `Total: ${total}`,       true);
          showPill(pillFound,   `Invoice: ${foundInv}`,  true);
          showPill(pillFwd,     `FWD PO: ${foundFwd}`,   true);
          showPill(pillMissing, `Not Found: ${missing}`, true);
          showPill(pillGrand,   `Net: ₹${grandNet.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`, true);

          const container = document.querySelector('.status-pills');
          container.querySelectorAll('.extra-pill').forEach(el => el.remove());
          if (directRet > 0) container.insertAdjacentHTML('beforeend', `<span class="pill extra-pill" style="background:rgba(248,113,113,0.15);color:#f87171">Direct Ret: ${directRet}</span>`);
          if (file3Count > 0) container.insertAdjacentHTML('beforeend', `<span class="pill extra-pill" style="background:rgba(251,191,36,0.15);color:var(--clr-warning)">Shipping Charge Total: ₹${grandDv.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})} (${file3Count})</span>`);

          show([searchCard, actionsRow, dashboardCard, tableCard]);
          renderTable('all');
          updateDashboardCards();
          
          saveToDB('reportState', {
            allRows,
            stats: { total, foundInv, foundFwd, missing, grandNet, directRet, file3Count, grandDv }
          });
          
          const dashboardTab = document.querySelector('.nav-btn[data-view="dashboard"]');
          if (dashboardTab) dashboardTab.click();
        });
      }

      // Start processing chunks
      requestAnimationFrame(processChunk);

    } catch (err) {
      console.error(err);
      statusIcon.textContent = '❌';
      statusText.textContent = 'Error during processing: ' + err.message;
    }
  }, 100);
}

// ── Update Dashboard Cards ─────────────────────────────────────
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
        const match = String(r.custOrder).match(/Clr:\s*([\d\.\/-]+)/);
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
          const match = String(r.custOrder).match(/Doc:\s*([\d\.\/-]+)/);
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
    dashShipAmount.textContent = formatAmt(shAmt);
  } else {
    dashShipCount.textContent = '0';
    dashShipAmount.textContent = '₹0.00';
  }

  if (hasDocFilter) {
    dashDocClrCount.textContent = docClrCount;
    dashDocClrAmount.textContent = formatAmt(docClrAmt);
    dashDocNotClrCount.textContent = docNotClrCount;
    dashDocNotClrAmount.textContent = formatAmt(docNotClrAmt);
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
    
    // Existing base filters
    if (filter === 'invoice' && r.orderSource !== 'invoice') continue;
    if (filter === 'fwd' && r.orderSource !== 'fwd') continue;
    if (filter === 'missing' && r.orderSource !== 'missing') continue;
    if (filter === 'returns' && !(r.retVal !== null && r.retVal > 0)) continue;
    if (filter === 'forward' && !(r.fwdVal !== null && r.fwdVal > 0)) continue;
    if (filter === 'shipping' && r.orderSource !== 'file3_deduction') continue;
    
    // Dashboard drill-down filters
    if (filter.startsWith('dashboard-')) {
      if (filter === 'dashboard-sales') {
        if (!(r.fwdVal != null && r.fwdVal > 0 && r.orderSource !== 'file3_deduction')) continue;
        if (filterStartNum !== null && filterEndNum !== null) {
          const rowDateNum = parseDateToNum(r.invoiceDate);
          if (rowDateNum === null || rowDateNum < filterStartNum || rowDateNum > filterEndNum) continue;
        }
      }
      else if (filter === 'dashboard-returns') {
        if (!(r.retVal != null && r.retVal > 0 && r.orderSource !== 'file3_deduction')) continue;
        if (filterStartNum !== null && filterEndNum !== null) {
          const rowDateNum = parseDateToNum(r.invoiceDate);
          if (rowDateNum === null || rowDateNum < filterStartNum || rowDateNum > filterEndNum) continue;
        }
      }
      else if (filter === 'dashboard-ship') {
        if (r.orderSource !== 'file3_deduction') continue;
        if (shipFilterStartNum !== null && shipFilterEndNum !== null) {
          const rowDateNum = parseDateToNum(r.clrDate);
          if (rowDateNum === null || rowDateNum < shipFilterStartNum || rowDateNum > shipFilterEndNum) continue;
        }
      }
      else if (filter === 'dashboard-doc-clr' || filter === 'dashboard-doc-not-clr') {
        if (r.orderSource !== 'file3_deduction') continue;
        const clrNum = parseDateToNum(r.clrDate);
        if (filter === 'dashboard-doc-clr' && !clrNum) continue;
        if (filter === 'dashboard-doc-not-clr' && clrNum) continue;
        
        if (docFilterStartNum !== null && docFilterEndNum !== null) {
          const docDateNum = parseDateToNum(r.docDate);
          if (docDateNum === null || docDateNum < docFilterStartNum || docDateNum > docFilterEndNum) continue;
        }
      }
    }
    
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

// ── Filter tabs ────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    this.classList.add('active');
    renderTable(this.dataset.filter);
  });
});

// ── Dashboard Filter ───────────────────────────────────────────
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
}

// ── Dashboard Drill-Down Click Handlers ───────────────────────
function navigateToHistoryWithFilter(filterType) {
  // Remove active state from all tabs and select the hidden/custom one
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  renderTable(filterType);
  const historyTab = document.querySelector('.nav-btn[data-view="history"]');
  if (historyTab) historyTab.click();
}

const statCardSales = document.getElementById('statCardSales');
const statCardReturns = document.getElementById('statCardReturns');
const statCardShip = document.getElementById('statCardShip');
const statCardDocClr = document.getElementById('statCardDocClr');
const statCardDocNotClr = document.getElementById('statCardDocNotClr');
const statCardRtvMissing = document.getElementById('statCardRtvMissing');

if (statCardSales) statCardSales.addEventListener('click', () => navigateToHistoryWithFilter('dashboard-sales'));
if (statCardReturns) statCardReturns.addEventListener('click', () => navigateToHistoryWithFilter('dashboard-returns'));
if (statCardShip) statCardShip.addEventListener('click', () => navigateToHistoryWithFilter('dashboard-ship'));
if (statCardDocClr) statCardDocClr.addEventListener('click', () => navigateToHistoryWithFilter('dashboard-doc-clr'));
if (statCardDocNotClr) statCardDocNotClr.addEventListener('click', () => navigateToHistoryWithFilter('dashboard-doc-not-clr'));
if (statCardRtvMissing) statCardRtvMissing.addEventListener('click', () => {
  const rtvTab = document.querySelector('.nav-btn[data-view="rtv-history"]');
  if (rtvTab) rtvTab.click();
});

// ── Live Table Search ───────────────────────────────────────────
let searchTimeout;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const activeTab = document.querySelector('.tab.active');
    const filter = activeTab ? activeTab.dataset.filter : 'all';
    renderTable(filter);
  }, 250);
});

// ── Download Excel ─────────────────────────────────────────────
downloadBtn.addEventListener('click', downloadResult);

function downloadResult() {
  if (!allRows.length) return;

  const outData = allRows.map(r => ({
    'Seller Invoice No':  r.invoice,
    'FWD PO No':          r.fwdPo,
    'Cust Order No':      r.custOrder,
    'Seller Invoice Date':r.invoiceDate || '',
    'Forward Value':      r.fwdVal != null ? r.fwdVal : '',
    'Return Value':       r.retVal != null && r.retVal > 0 ? -r.retVal : '',
    'Shipping Charge':    r.orderSource === 'file3_deduction' && r.netVal != null ? r.netVal : '',
  }));

  const grandFwd = allRows.reduce((s, r) => s + (r.fwdVal || 0), 0);
  const grandRet = allRows.reduce((s, r) => s + (r.retVal || 0), 0);
  const grandDv  = allRows.filter(r => r.orderSource === 'file3_deduction').reduce((s, r) => s + (r.netVal || 0), 0);
  const grandNet = (grandFwd - grandRet) + grandDv;
  outData.push({
    'Seller Invoice No': '',
    'FWD PO No':         '',
    'Cust Order No':     'GRAND TOTAL',
    'Seller Invoice Date':'',
    'Forward Value':     grandFwd,
    'Return Value':      -grandRet,
    'Shipping Charge':   grandDv,
  });

  outData.push({
    'Seller Invoice No': '',
    'FWD PO No':         '',
    'Cust Order No':     'FINAL NET BALANCE',
    'Seller Invoice Date':'',
    'Forward Value':     '',
    'Return Value':      '',
    'Shipping Charge':   grandNet,
  });

  const ws = XLSX.utils.json_to_sheet(outData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Order Lookup Result');
  ws['!cols'] = [
    { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 18 }
  ];

  XLSX.writeFile(wb, `order_lookup_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// ── Reset ──────────────────────────────────────────────────────
resetBtn.addEventListener('click', async () => {
  if (confirm(`Are you sure you want to delete all data for ${currentPlatform}? This action cannot be undone.`)) {
    await clearDB();
    resetUIAndMemory();
  }
});

function resetUIAndMemory() {
  rawData1 = []; rawData2 = []; rawData3 = [];
  allRows  = [];
  file1Ready = false; file2Ready = false; file3Ready = false;
  forwardByInvoice = new Map(); returnByInvoice  = new Map();
  forwardByFwdPo   = new Map(); returnByFwdPo    = new Map();
  directReturns    = [];

  fileInput1.value = ''; fileInput2.value = ''; fileInput3.value = '';
  searchInput.value = '';
  searchResult.style.display = 'none';
  hide([fileStatus1, fileStatus2, fileStatus3, processRow, statusBar, searchCard, actionsRow, tableCard]);
  tableBody.innerHTML = '';
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.tab[data-filter="all"]').classList.add('active');
  
  // Switch back to Upload Data tab
  const uploadsTab = document.querySelector('.nav-btn[data-view="uploads"]');
  if (uploadsTab) uploadsTab.click();
  
  // Clear RTV Memory & UI
  rawMktData = []; rawRtvData = []; rtvResultsRows = [];
  mktReady = false; rtvReady = false;
  const fileInputMkt = document.getElementById('fileInputMkt');
  const fileInputRtv = document.getElementById('fileInputRtv');
  if (fileInputMkt) fileInputMkt.value = '';
  if (fileInputRtv) fileInputRtv.value = '';
  const fileStatusMkt = document.getElementById('fileStatusMkt');
  const fileStatusRtv = document.getElementById('fileStatusRtv');
  const processRowRtv = document.getElementById('processRowRtv');
  const statusBarRtv = document.getElementById('statusBarRtv');
  const tableCardRtv = document.getElementById('tableCardRtv');
  hide([fileStatusMkt, fileStatusRtv, processRowRtv, statusBarRtv, tableCardRtv]);
  const tableBodyRtv = document.getElementById('tableBodyRtv');
  if (tableBodyRtv) tableBodyRtv.innerHTML = '';
}

// ── Helpers ────────────────────────────────────────────────────
function show(els) {
  (Array.isArray(els) ? els : [els]).forEach(el => el && (el.style.display = ''));
}
function hide(els) {
  (Array.isArray(els) ? els : [els]).forEach(el => el && (el.style.display = 'none'));
}
function showPill(el, text, visible) {
  el.textContent = text;
  el.style.display = visible ? '' : 'none';
}
function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function dash() { return '<span style="color:var(--clr-text-dim)">—</span>'; }
function orderBadge(src) {
  if (src === 'invoice') return `<span class="badge badge-invoice">Invoice</span>`;
  if (src === 'fwd')     return `<span class="badge badge-fwd">FWD PO</span>`;
  return `<span class="badge badge-missing">Not Found</span>`;
}

async function loadOldState(key) {
  try {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(key);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    return null;
  }
}

async function loadState() {
  let state = await loadFromDB('reportState');
  
  // Migration for legacy AJIO data
  if (!state && currentPlatform === 'AJIO') {
    const oldState = await loadOldState('reportState');
    if (oldState) {
      state = oldState;
      await saveToDB('reportState', state); // Saves as reportState_AJIO
    }
  }

  if (state && state.allRows && state.allRows.length > 0) {
    allRows = state.allRows;
    const stats = state.stats || {};
    
    // Restore pills
    show(statusBar);
    statusIcon.textContent = '✅';
    statusText.textContent = `${stats.total || allRows.length} rows restored for ${currentPlatform}`;
    
    showPill(pillTotal,   `Total: ${stats.total || allRows.length}`, true);
    showPill(pillFound,   `Invoice: ${stats.foundInv || 0}`, true);
    showPill(pillFwd,     `FWD PO: ${stats.foundFwd || 0}`, true);
    showPill(pillMissing, `Not Found: ${stats.missing || 0}`, true);
    if (stats.grandNet !== undefined) showPill(pillGrand, `Net: ₹${stats.grandNet.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`, true);

    const container = document.querySelector('.status-pills');
    container.querySelectorAll('.extra-pill').forEach(el => el.remove());
    if (stats.directRet > 0) container.insertAdjacentHTML('beforeend', `<span class="pill extra-pill" style="background:rgba(248,113,113,0.15);color:#f87171">Direct Ret: ${stats.directRet}</span>`);
    if (stats.file3Count > 0) container.insertAdjacentHTML('beforeend', `<span class="pill extra-pill" style="background:rgba(251,191,36,0.15);color:var(--clr-warning)">Shipping Charge Total: ₹${(stats.grandDv||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})} (${stats.file3Count})</span>`);

    show([searchCard, actionsRow, dashboardCard, dashboardShipCard, dashboardDocCard, tableCard]);
    renderTable('all');
    updateDashboardCards();
    
    // Switch to Dashboard
    const dashboardTab = document.querySelector('.nav-btn[data-view="dashboard"]');
    if (dashboardTab) dashboardTab.click();
  } else {
    // Hide UI elements if no data
    hide([searchCard, actionsRow, tableCard, statusBar]);
    tableBody.innerHTML = '';
    document.querySelector('.status-pills').querySelectorAll('.extra-pill').forEach(el => el.remove());

    // Switch to Uploads if no data
    const uploadsTab = document.querySelector('.nav-btn[data-view="uploads"]');
    if (uploadsTab) uploadsTab.click();
  }

  // Restore RTV State
  let rtvState = await loadFromDB('rtvState');
  if (rtvState && rtvState.rtvResultsRows && rtvState.rtvResultsRows.length > 0) {
    rtvResultsRows = rtvState.rtvResultsRows;
    const missingCount = rtvState.missingCount || 0;
    const rtvRowsCount = rtvState.rtvRowsCount || 0;
    
    const tableBodyRtv = document.getElementById('tableBodyRtv');
    tableBodyRtv.innerHTML = '';
    rtvResultsRows.forEach(r => {
      tableBodyRtv.insertAdjacentHTML('beforeend', `
        <tr>
          <td class="num">${r.idx}</td>
          <td style="font-weight:600">${esc(r.orderNo)}</td>
          <td class="mono">${esc(r.fwdPoDate) || dash()}</td>
          <td><span class="badge" style="background:rgba(239,68,68,0.15);color:var(--clr-danger)">${esc(r.status)}</span></td>
          <td class="mono">${esc(r.trackingNo) || dash()}</td>
          <td>${esc(r.condition) || dash()}</td>
        </tr>
      `);
    });
    
    const statusBarRtv = document.getElementById('statusBarRtv');
    const statusIconRtv = document.getElementById('statusIconRtv');
    const statusTextRtv = document.getElementById('statusTextRtv');
    const pillTotalRtv = document.getElementById('pillTotalRtv');
    const pillMissingRtv = document.getElementById('pillMissingRtv');
    const tableCardRtv = document.getElementById('tableCardRtv');
    
    show(statusBarRtv);
    statusIconRtv.textContent = '✅';
    statusTextRtv.textContent = `Matching Complete`;
    showPill(pillTotalRtv, `RTV Rows: ${rtvRowsCount}`, true);
    showPill(pillMissingRtv, `Missing Info: ${missingCount}`, true);
    show(tableCardRtv);
    const dashboardCardRtv = document.getElementById('dashboardCardRtv');
    if (dashboardCardRtv) show(dashboardCardRtv);
    
    renderRtvTable(); // Render table with filters if any
  } else {
    // Hide RTV UI elements if no data
    const tableCardRtv = document.getElementById('tableCardRtv');
    const statusBarRtv = document.getElementById('statusBarRtv');
    const dashboardCardRtv = document.getElementById('dashboardCardRtv');
    hide([tableCardRtv, statusBarRtv, dashboardCardRtv]);
    const tableBodyRtv = document.getElementById('tableBodyRtv');
    if (tableBodyRtv) tableBodyRtv.innerHTML = '';
    rtvResultsRows = [];
  }
}

// ── Startup Initialization ─────────────────────────────────────
// loadState() is now called from auth.onAuthStateChanged() when user is logged in.

// ── RTV Table Render & Filtering ────────────────────────────────
let rtvFilterStartNum = null;
let rtvFilterEndNum = null;

function renderRtvTable() {
  const tableBodyRtv = document.getElementById('tableBodyRtv');
  if (!tableBodyRtv) return;
  tableBodyRtv.innerHTML = '';
  
  let rows = [];
  if (rtvFilterStartNum !== null && rtvFilterEndNum !== null) {
    rows = rtvResultsRows.filter(r => {
      const rowDateNum = parseDateToNum(r.fwdPoDate);
      return rowDateNum !== null && rowDateNum >= rtvFilterStartNum && rowDateNum <= rtvFilterEndNum;
    });
  } else {
    rows = rtvResultsRows;
  }
  
  const dashRtvMissingCount = document.getElementById('dashRtvMissingCount');
  if (dashRtvMissingCount) {
    dashRtvMissingCount.textContent = (rtvFilterStartNum !== null && rtvFilterEndNum !== null) ? rows.length : '0';
  }
  
  if (rows.length === 0) {
    tableBodyRtv.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--clr-text-muted);padding:28px">No records found</td></tr>`;
  } else {
    rows.forEach((r, idx) => {
      tableBodyRtv.insertAdjacentHTML('beforeend', `
        <tr>
          <td class="num">${idx + 1}</td>
          <td style="font-weight:600">${esc(r.orderNo)}</td>
          <td class="mono">${esc(r.fwdPoDate) || dash()}</td>
          <td><span class="badge" style="background:rgba(239,68,68,0.15);color:var(--clr-danger)">${esc(r.status)}</span></td>
          <td class="mono">${esc(r.trackingNo) || dash()}</td>
          <td>${esc(r.condition) || dash()}</td>
        </tr>
      `);
    });
  }
}

const filterRtvBtn = document.getElementById('filterRtvBtn');
const clearRtvFilterBtn = document.getElementById('clearRtvFilterBtn');
const rtvStartDate = document.getElementById('rtvStartDate');
const rtvEndDate = document.getElementById('rtvEndDate');

if (filterRtvBtn) {
  filterRtvBtn.addEventListener('click', () => {
    const s = rtvStartDate.value;
    const e = rtvEndDate.value;
    if (!s || !e) {
      alert("Please select both Start and End Dates");
      return;
    }
    rtvFilterStartNum = parseInt(s.split('-').join(''), 10);
    rtvFilterEndNum = parseInt(e.split('-').join(''), 10);
    renderRtvTable();
  });
}

if (clearRtvFilterBtn) {
  clearRtvFilterBtn.addEventListener('click', () => {
    rtvStartDate.value = '';
    rtvEndDate.value = '';
    rtvFilterStartNum = null;
    rtvFilterEndNum = null;
    renderRtvTable();
  });
}

// ── RTV Tracker Logic ──────────────────────────────────────────
const fileInputMkt = document.getElementById('fileInputMkt');
const fileInputRtv = document.getElementById('fileInputRtv');
const processBtnRtv = document.getElementById('processBtnRtv');
const downloadRtvBtn = document.getElementById('downloadRtvBtn');

if (fileInputMkt) fileInputMkt.addEventListener('change', e => { if (e.target.files[0]) loadFile(e.target.files[0], 4); });
if (fileInputRtv) fileInputRtv.addEventListener('change', e => { if (e.target.files[0]) loadFile(e.target.files[0], 5); });

if (processBtnRtv) {
  processBtnRtv.addEventListener('click', () => {
    const statusBarRtv = document.getElementById('statusBarRtv');
    const statusIconRtv = document.getElementById('statusIconRtv');
    const statusTextRtv = document.getElementById('statusTextRtv');
    const pillTotalRtv = document.getElementById('pillTotalRtv');
    const pillMissingRtv = document.getElementById('pillMissingRtv');
    const tableCardRtv = document.getElementById('tableCardRtv');
    const tableBodyRtv = document.getElementById('tableBodyRtv');

    show(statusBarRtv);
    statusIconRtv.innerHTML = '<span class="spinner" style="border-top-color:var(--clr-primary);"></span>';
    statusTextRtv.textContent = 'Matching Orders...';
    hide([pillTotalRtv, pillMissingRtv, tableCardRtv]);

    setTimeout(() => {
      try {
        // Build map for MKT file (Order No -> row data)
        const mktMap = new Map();
        rawMktData.forEach(row => {
          const orderNo = getCol(row, COL1_VARIANTS.CUST_ORDER) || getCol2(row, COL2_VARIANTS.ORDER_NO) || row['Order Number'] || row['Order No'];
          if (orderNo) {
            mktMap.set(String(orderNo).trim().toUpperCase(), row);
          }
        });

        rtvResultsRows = [];
        let missingCount = 0;

        rawRtvData.forEach((row, i) => {
          const orderNo = getCol(row, COL1_VARIANTS.CUST_ORDER) || getCol2(row, COL2_VARIANTS.ORDER_NO) || row['Order Number'] || row['Order No'];
          if (!orderNo) return;

          const key = String(orderNo).trim().toUpperCase();
          const mktRow = mktMap.get(key);

          if (mktRow) {
            // Strictly check for RETURN tracking number. Do not fallback to forward 'Tracking Number'.
            const trackingNo = String(mktRow['Return Tracking Number'] || mktRow['Return Traking Numbe'] || mktRow['Return Tracking No'] || '').trim();
            const condition = String(mktRow['Condition'] || '').trim();

            if (!trackingNo && !condition) {
              missingCount++;
              const rawFwdDate = row['FWD PO Date'] || row['FWD PO DATE'] || '';
              const formattedFwdDate = formatExcelDate(rawFwdDate);

              rtvResultsRows.push({
                idx: rtvResultsRows.length + 1,
                orderNo: key,
                fwdPoDate: formattedFwdDate,
                status: 'Missing Tracking & Condition',
                trackingNo: trackingNo,
                condition: condition
              });
            }
          }
        });

        statusIconRtv.textContent = '✅';
        statusTextRtv.textContent = `Matching Complete`;
        showPill(pillTotalRtv, `RTV Rows: ${rawRtvData.length}`, true);
        showPill(pillMissingRtv, `Missing Info: ${missingCount}`, true);
        show(tableCardRtv);
        const dashboardCardRtv = document.getElementById('dashboardCardRtv');
        if (dashboardCardRtv) show(dashboardCardRtv);
        
        renderRtvTable();
        
        saveToDB('rtvState', {
          rtvResultsRows,
          missingCount,
          rtvRowsCount: rawRtvData.length
        });

        // Switch to RTV History view
        const rtvHistoryTab = document.querySelector('.nav-btn[data-view="rtv-history"]');
        if (rtvHistoryTab) rtvHistoryTab.click();

      } catch (err) {
        statusIconRtv.textContent = '❌';
        statusTextRtv.textContent = 'Error: ' + err.message;
      }
    }, 50);
  });
}

if (downloadRtvBtn) {
  downloadRtvBtn.addEventListener('click', () => {
    // Determine which rows to download: all or filtered
    let rowsToDownload = rtvResultsRows;
    if (rtvFilterStartNum !== null && rtvFilterEndNum !== null) {
      rowsToDownload = rtvResultsRows.filter(r => {
        const rowDateNum = parseDateToNum(r.fwdPoDate);
        return rowDateNum !== null && rowDateNum >= rtvFilterStartNum && rowDateNum <= rtvFilterEndNum;
      });
    }

    if (!rowsToDownload.length) return;
    const outData = rowsToDownload.map(r => ({
      'Order No': r.orderNo,
      'FWD PO Date': r.fwdPoDate || '',
      'Status': r.status,
      'Return Tracking No': r.trackingNo,
      'Condition': r.condition
    }));
    const ws = XLSX.utils.json_to_sheet(outData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Missing Tracking');
    ws['!cols'] = [{ wch: 18 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 15 }];
    XLSX.writeFile(wb, `Missing_Tracking_${new Date().toISOString().slice(0,10)}.xlsx`);
  });
}
