// ── Tab 切換 ──
function switchTab(tab, e) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  if (e) e.target.classList.add('active');
  document.getElementById('panel-' + tab).classList.add('active');
  if (tab === 'inventory') renderInventory();
  if (tab === 'log') renderLog();
}

// ── 手動輸入列 ──
function getManualItems() {
  const rows = document.querySelectorAll('.manual-row');
  const items = [];
  rows.forEach(row => {
    const sku = row.querySelector('.sku-input').value.trim();
    const qty = parseInt(row.querySelector('.qty-input').value);
    if (sku && qty > 0) items.push({ sku, qty });
  });
  return items;
}

function addManualRow() {
  const div = document.createElement('div');
  div.className = 'manual-row';
  div.innerHTML = `<input class="sku-input" type="text" placeholder="SKU"><input class="qty-input" type="number" placeholder="數量" min="1"><button class="rm-btn" onclick="removeManualRow(this)">×</button>`;
  document.getElementById('manual-rows').appendChild(div);
}

function removeManualRow(btn) {
  const rows = document.querySelectorAll('.manual-row');
  if (rows.length > 1) btn.parentElement.remove();
  else {
    btn.parentElement.querySelector('.sku-input').value = '';
    btn.parentElement.querySelector('.qty-input').value = '';
  }
}

function previewManual() {
  showDeductPreview([]);
}
