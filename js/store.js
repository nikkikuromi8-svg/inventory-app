// ── 全域狀態 ──
let inventory = {};
let logs = JSON.parse(localStorage.getItem('logs') || '[]');
let pendingDeductions = [];
let editingSku = null;
let _importData = null;

// 載入時遷移舊數據（舊格式: {sku: number} → 新格式: {sku: {qty, shelves}}）
(function migrateData() {
  const raw = JSON.parse(localStorage.getItem('inventory') || '{}');
  for (const [sku, val] of Object.entries(raw)) {
    if (typeof val === 'number') {
      inventory[sku] = { qty: val, shelves: [] };
    } else {
      inventory[sku] = { qty: val.qty || 0, shelves: val.shelves || [] };
    }
  }
})();

function save() {
  localStorage.setItem('inventory', JSON.stringify(inventory));
  localStorage.setItem('logs', JSON.stringify(logs));
}

function getQty(sku) { return inventory[sku] ? inventory[sku].qty : undefined; }
function getShelves(sku) { return inventory[sku] ? inventory[sku].shelves : []; }
