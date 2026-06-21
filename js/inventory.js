// ── 庫存導出 & 清空 ──
function exportInventory() {
  const rows = [['SKU', '庫存數量', '貨架號']];
  Object.entries(inventory).forEach(([sku, d]) => rows.push([sku, d.qty, d.shelves.join(', ')]));
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '庫存');
  XLSX.writeFile(wb, `庫存_${new Date().toLocaleDateString('zh-TW').replace(/\//g,'-')}.xlsx`);
}

function clearInventory() {
  if (!confirm('確定要清空所有庫存數據嗎？')) return;
  inventory = {}; save(); renderInventory(); updateStats();
}

// ── 渲染庫存表格 ──
function renderInventory() {
  const q = document.getElementById('search-input').value.toLowerCase();
  const items = Object.entries(inventory).filter(([sku, d]) =>
    sku.toLowerCase().includes(q) || d.shelves.some(s => s.toLowerCase().includes(q))
  );
  const container = document.getElementById('inventory-table-container');

  if (items.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon">📋</div><p>${q ? '找不到符合的SKU或貨架號' : '還沒有庫存數據'}</p>${!q ? '<p style="margin-top:8px;font-size:13px;">從領星導出 CSV/Excel 後點擊「導入庫存」</p>' : ''}</div>`;
    updateStats(); renderAlerts(); return;
  }

  items.sort((a, b) => a[0].localeCompare(b[0]));
  container.innerHTML = `<table>
    <thead><tr><th>SKU</th><th>庫存數量</th><th>貨架號</th><th>狀態</th><th>操作</th></tr></thead>
    <tbody>${items.map(([sku, d]) => {
      const low = d.qty < 10;
      const shelfHtml = d.shelves.length
        ? d.shelves.map(s => `<span class="shelf-tag">${s}</span>`).join('')
        : `<span class="shelf-tag empty">未設定</span>`;
      return `<tr class="${low ? 'low-stock' : ''}">
        <td style="font-family:monospace;font-weight:500">${sku}</td>
        <td><strong>${d.qty}</strong></td>
        <td><div class="shelf-tags">${shelfHtml}</div></td>
        <td>${low ? '<span class="badge badge-red">庫存不足</span>' : '<span class="badge badge-green">正常</span>'}</td>
        <td><button class="btn btn-outline" style="padding:4px 10px;font-size:12px;" onclick="openModal('${sku}')">編輯</button></td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
  updateStats(); renderAlerts();
}

// ── Modal 編輯 ──
function openModal(sku) {
  editingSku = sku;
  document.getElementById('modal-title').textContent = `編輯：${sku}`;
  document.getElementById('modal-qty').value = inventory[sku].qty;
  document.getElementById('modal-shelves').value = inventory[sku].shelves.join(', ');
  document.getElementById('edit-modal').style.display = 'flex';
}
function closeModal(e) {
  if (e.target === document.getElementById('edit-modal'))
    document.getElementById('edit-modal').style.display = 'none';
}
function saveModal() {
  const qty = parseInt(document.getElementById('modal-qty').value);
  if (isNaN(qty) || qty < 0) { alert('請輸入有效數量'); return; }
  const shelvesRaw = document.getElementById('modal-shelves').value;
  const shelves = shelvesRaw.split(/[,，;；\s]+/).map(s => s.trim()).filter(Boolean);
  const old = inventory[editingSku].qty;
  inventory[editingSku] = { qty, shelves };
  save(); renderInventory();
  addLog('手動修改', [{ sku: editingSku, before: old, after: qty, deducted: old - qty, shelves }]);
  document.getElementById('edit-modal').style.display = 'none';
}

// ── 統計 & 警告 ──
function updateStats() {
  const vals = Object.values(inventory);
  document.getElementById('stat-total').textContent = vals.length;
  document.getElementById('stat-low').textContent = vals.filter(v => v.qty < 10).length;
  document.getElementById('stat-units').textContent = vals.reduce((a, b) => a + b.qty, 0);
}

function renderAlerts() {
  const low = Object.entries(inventory).filter(([, d]) => d.qty < 10);
  const container = document.getElementById('alert-container');
  if (low.length === 0) { container.innerHTML = ''; return; }
  const rows = low.map(([sku, d]) => {
    const shelfStr = d.shelves.length ? d.shelves.join('、') : '未設定貨架';
    return `<tr><td>${sku}</td><td>剩 ${d.qty} 件</td><td>📍 ${shelfStr}</td></tr>`;
  }).join('');
  container.innerHTML = `<div class="alert-banner">
    <div class="alert-icon">⚠️</div>
    <div style="width:100%">
      <h3>需要合併庫存 / 清點（${low.length} 個SKU庫存不足）</h3>
      <table class="alert-table">${rows}</table>
    </div>
  </div>`;
}
