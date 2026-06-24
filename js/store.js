// ── 全域狀態 ──
let inventory = {};
let logs = JSON.parse(localStorage.getItem('logs') || '[]');
let pendingDeductions = [];
let editingSku = null;
let _importData = null;

// 載入時遷移舊數據，並補齊庫位級庫存 locations。
(function migrateData() {
  const raw = JSON.parse(localStorage.getItem('inventory') || '{}');
  for (const [sku, val] of Object.entries(raw)) {
    if (typeof val === 'number') {
      inventory[sku] = { qty: val, shelves: [], locations: {} };
    } else {
      const shelves = val.shelves || Object.keys(val.locations || {});
      inventory[sku] = { qty: val.qty || 0, shelves, locations: val.locations || {} };
    }
  }
})();

function save() {
  localStorage.setItem('inventory', JSON.stringify(inventory));
  localStorage.setItem('logs', JSON.stringify(logs));
}

function getQty(sku) { return inventory[sku] ? inventory[sku].qty : undefined; }
function getShelves(sku) { return inventory[sku] ? inventory[sku].shelves : []; }

function recalcSkuQty(sku) {
  const d = inventory[sku];
  if (!d) return;
  const locs = d.locations || {};
  const locQty = Object.values(locs).reduce((a, b) => a + (parseInt(b) || 0), 0);
  if (Object.keys(locs).length > 0) d.qty = locQty;
  d.shelves = Object.keys(locs).length ? Object.keys(locs) : (d.shelves || []);
}
