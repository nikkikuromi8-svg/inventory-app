#!/usr/bin/env node
// 驗證腳本：確認拆分後所有文件、元素、核心功能都完整

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname);
let passed = 0, failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

function readFile(relPath) {
  try { return fs.readFileSync(path.join(ROOT, relPath), 'utf8'); }
  catch { return null; }
}

function lineCount(content) {
  return content ? content.split('\n').length : 0;
}

// ── 1. 文件是否存在 ──
console.log('\n【1】文件存在檢查');
const requiredFiles = [
  'index.html',
  'css/styles.css',
  'js/store.js',
  'js/import.js',
  'js/inventory.js',
  'js/parser.js',
  'js/deduct.js',
  'js/log.js',
  'js/ui.js',
];
requiredFiles.forEach(f => check(`${f} 存在`, fs.existsSync(path.join(ROOT, f))));

// ── 2. 每個文件不超過 200 行 ──
console.log('\n【2】行數 ≤ 200 行檢查');
requiredFiles.forEach(f => {
  const content = readFile(f);
  const lines = lineCount(content);
  check(`${f} (${lines} 行)`, lines <= 200, `超過 200 行`);
});

// ── 3. index.html 正確引用所有 JS / CSS ──
console.log('\n【3】index.html 引用檢查');
const html = readFile('index.html') || '';
check('引用 css/styles.css',    html.includes('css/styles.css'));
check('引用 js/store.js',       html.includes('js/store.js'));
check('引用 js/log.js',         html.includes('js/log.js'));
check('引用 js/ui.js',          html.includes('js/ui.js'));
check('引用 js/import.js',      html.includes('js/import.js'));
check('引用 js/inventory.js',   html.includes('js/inventory.js'));
check('引用 js/parser.js',      html.includes('js/parser.js'));
check('引用 js/deduct.js',      html.includes('js/deduct.js'));
check('引用 pdf.js CDN',        html.includes('pdf.min.js'));
check('引用 xlsx CDN',          html.includes('xlsx.full.min.js'));

// ── 4. HTML 關鍵元素 ID 存在 ──
console.log('\n【4】HTML 關鍵元素 ID 檢查');
const requiredIds = [
  'panel-inventory', 'panel-deduct', 'panel-log',
  'stat-total', 'stat-low', 'stat-units',
  'alert-container', 'inventory-table-container', 'search-input',
  'import-file', 'upload-area', 'picking-file',
  'manual-rows', 'result-container',
  'log-container', 'edit-modal', 'modal-title', 'modal-qty', 'modal-shelves',
];
requiredIds.forEach(id => check(`#${id}`, html.includes(`id="${id}"`)));

// ── 5. 核心函數是否定義 ──
console.log('\n【5】核心函數定義檢查');
const allJs = ['js/store.js','js/import.js','js/inventory.js','js/parser.js','js/deduct.js','js/log.js','js/ui.js']
  .map(f => readFile(f) || '').join('\n');

const requiredFunctions = [
  // store.js
  'function save',
  'function getQty',
  'function getShelves',
  // import.js
  'function importInventory',
  'function showColumnPicker',
  'function confirmColumnPicker',
  'function doImport',
  // inventory.js
  'function exportInventory',
  'function clearInventory',
  'function renderInventory',
  'function openModal',
  'function closeModal',
  'function saveModal',
  'function updateStats',
  'function renderAlerts',
  // parser.js
  'function extractPdfText',
  'function extractImageText',
  'function parsePickingList',
  'function extractRepeatedSku',
  // deduct.js
  'function onDragOver',
  'function onDragLeave',
  'function onDrop',
  'function handlePickingFile',
  'function processFile',
  'function showDeductPreview',
  'function confirmDeduct',
  // log.js
  'function addLog',
  'function renderLog',
  'function clearLog',
  // ui.js
  'function switchTab',
  'function getManualItems',
  'function addManualRow',
  'function removeManualRow',
  'function previewManual',
];
requiredFunctions.forEach(fn => check(fn, allJs.includes(fn)));

// ── 6. 關鍵 CSS 類名是否存在 ──
console.log('\n【6】關鍵 CSS 類名檢查');
const css = readFile('css/styles.css') || '';
const requiredClasses = [
  '.tab', '.panel', '.card', '.btn', '.btn-primary', '.btn-danger', '.btn-outline',
  '.stats', '.stat', '.alert-banner', '.alert-table',
  '.shelf-tags', '.shelf-tag', '.badge', '.badge-red', '.badge-green',
  '.result-item', '.result-left', '.deduct-actions',
  '.upload-area', '.manual-row', '.modal-overlay', '.modal',
  '.empty-state', '.log-item', '.low-stock',
];
requiredClasses.forEach(cls => check(`${cls}`, css.includes(cls)));

// ── 7. 跨模組依賴：JS 文件互相調用的函數是否都有定義 ──
console.log('\n【7】跨模組依賴檢查');
const crossCalls = [
  { caller: 'inventory.js', fn: 'save',          defined_in: 'store.js' },
  { caller: 'inventory.js', fn: 'renderAlerts',  defined_in: 'inventory.js' },
  { caller: 'inventory.js', fn: 'updateStats',   defined_in: 'inventory.js' },
  { caller: 'inventory.js', fn: 'addLog',        defined_in: 'log.js' },
  { caller: 'deduct.js',    fn: 'save',          defined_in: 'store.js' },
  { caller: 'deduct.js',    fn: 'addLog',        defined_in: 'log.js' },
  { caller: 'deduct.js',    fn: 'updateStats',   defined_in: 'inventory.js' },
  { caller: 'deduct.js',    fn: 'renderAlerts',  defined_in: 'inventory.js' },
  { caller: 'deduct.js',    fn: 'getManualItems',   defined_in: 'ui.js' },
  { caller: 'import.js',   fn: 'save',             defined_in: 'store.js' },
  { caller: 'import.js',   fn: 'renderInventory',  defined_in: 'inventory.js' },
  { caller: 'import.js',   fn: 'updateStats',      defined_in: 'inventory.js' },
  { caller: 'parser.js',   fn: 'extractRepeatedSku', defined_in: 'parser.js' },
];
crossCalls.forEach(({ caller, fn, defined_in }) => {
  const callerContent = readFile(`js/${caller}`) || '';
  const definerContent = readFile(`js/${defined_in}`) || '';
  const isCalled = callerContent.includes(fn + '(') || callerContent.includes(fn + ' ');
  const isDefined = definerContent.includes(`function ${fn}`);
  check(`${caller} 調用 ${fn}() → 定義於 ${defined_in}`, !isCalled || isDefined);
});

// ── 結果 ──
console.log(`\n${'─'.repeat(50)}`);
console.log(`結果：${passed} 通過，${failed} 失敗`);
if (failed === 0) {
  console.log('🎉 所有檢查通過！拆分正確，功能完整。');
} else {
  console.log('⚠️  有項目未通過，請檢查上面標示 ❌ 的項目。');
  process.exit(1);
}
