// ── 庫存導入（文件讀取、欄位偵測、欄位選擇器） ──
function importInventory(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      let data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      data = data.filter(row => row.some(c => String(c).trim() !== ''));
      if (data.length === 0) { alert('文件是空的'); return; }

      let skuCol = -1, qtyCol = -1, shelfCol = -1, headerRow = -1;
      for (let r = 0; r < Math.min(30, data.length); r++) {
        const row = data[r].map(c => String(c || '').toLowerCase().trim());
        let foundSku = -1, foundQty = -1, foundShelf = -1;
        for (let c = 0; c < row.length; c++) {
          if (isSkuHeader(row[c])) foundSku = c;
          if (isTotalStockHeader(row[c])) foundQty = c;
          if (isLocationHeader(row[c])) foundShelf = c;
        }
        if (foundSku >= 0 && foundQty >= 0 && foundShelf >= 0) {
          skuCol = foundSku; qtyCol = foundQty; shelfCol = foundShelf; headerRow = r; break;
        }
      }

      if (skuCol >= 0 && qtyCol >= 0 && shelfCol >= 0) {
        doImport(data, headerRow, skuCol, qtyCol, shelfCol);
      } else {
        _importData = data;
        showColumnPicker(data);
      }
    } catch (err) {
      console.error(err);
      alert('文件讀取失敗，請確認是表格格式（xlsx / csv / ods 等）');
    }
  };
  reader.readAsArrayBuffer(file);
}

function showColumnPicker(data) {
  const preview = data.slice(0, 15);
  const colCount = Math.max(...preview.map(r => r.length));
  const cols = Array.from({ length: colCount }, (_, i) => {
    const samples = preview.map(r => String(r[i] || '').trim()).filter(Boolean).slice(0, 3).join(' / ');
    return `<option value="${i}">欄 ${i + 1}：${samples}</option>`;
  }).join('');

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'col-picker-modal';
  modal.innerHTML = `<div class="modal" onclick="event.stopPropagation()" style="width:500px">
    <h3>請選擇對應欄位</h3>
    <p style="font-size:13px;color:#6b7280;margin-bottom:16px;">系統只會導入 SKU、庫位、總庫存，其他欄位會忽略</p>
    <div style="overflow-x:auto;margin-bottom:16px;">
      <table style="font-size:12px;border-collapse:collapse;width:100%">
        <thead><tr>${Array.from({length:colCount},(_,i)=>`<th style="padding:4px 8px;background:#f9fafb;border:1px solid #e5e7eb">欄${i+1}</th>`).join('')}</tr></thead>
        <tbody>${preview.map(row=>`<tr>${Array.from({length:colCount},(_,i)=>`<td style="padding:4px 8px;border:1px solid #f3f4f6;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${String(row[i]||'')}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>
    <label>SKU 欄 <span style="color:#ef4444">*</span></label>
    <select id="cp-sku" style="width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;margin-bottom:10px">${cols}</select>
    <label>總庫存欄 <span style="color:#ef4444">*</span></label>
    <select id="cp-qty" style="width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;margin-bottom:10px"><option value="-1">— 不選 —</option>${cols}</select>
    <label>庫位欄 <span style="color:#ef4444">*</span></label>
    <select id="cp-shelf" style="width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;margin-bottom:4px"><option value="-1">— 不選 —</option>${cols}</select>
    <label style="display:flex;align-items:center;gap:6px;margin-top:10px;cursor:pointer">
      <input type="checkbox" id="cp-has-header" checked>
      <span style="font-weight:400;font-size:13px">第一行是標題行（跳過不導入）</span>
    </label>
    <div class="modal-actions" style="margin-top:20px">
      <button class="btn btn-outline" onclick="document.getElementById('col-picker-modal').remove()">取消</button>
      <button class="btn btn-primary" onclick="confirmColumnPicker()">確認導入</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

function confirmColumnPicker() {
  const skuCol = parseInt(document.getElementById('cp-sku').value);
  const qtyCol = parseInt(document.getElementById('cp-qty').value);
  const shelfCol = parseInt(document.getElementById('cp-shelf').value);
  const hasHeader = document.getElementById('cp-has-header').checked;
  if (skuCol < 0 || qtyCol < 0 || shelfCol < 0) { alert('請選擇 SKU、總庫存、庫位三個欄位'); return; }
  document.getElementById('col-picker-modal').remove();
  doImport(_importData, hasHeader ? 0 : -1, skuCol, qtyCol, shelfCol);
  _importData = null;
}

function doImport(data, headerRow, skuCol, qtyCol, shelfCol) {
  let imported = 0;
  const nextInventory = {};
  const startRow = headerRow >= 0 ? headerRow + 1 : 0;
  for (let i = startRow; i < data.length; i++) {
    const sku = String(data[i][skuCol] || '').trim();
    if (!sku) continue;
    const qty = qtyCol >= 0 ? parseQty(data[i][qtyCol]) : 0;
    const shelfRaw = shelfCol >= 0 ? String(data[i][shelfCol] || '').trim() : '';
    const shelves = shelfRaw ? shelfRaw.split(/[,，;；\s]+/).map(s => s.trim()).filter(Boolean) : [];
    if (!nextInventory[sku]) nextInventory[sku] = { qty: 0, shelves: [], locations: {} };

    if (shelves.length > 0) {
      shelves.forEach(s => { nextInventory[sku].locations[s] = qty; });
    } else if (qtyCol >= 0) {
      nextInventory[sku].qty = qty;
    }
    nextInventory[sku].shelves = Array.from(new Set([
      ...(nextInventory[sku].shelves || []),
      ...shelves
    ]));
    imported++;
  }
  inventory = nextInventory;
  Object.keys(inventory).forEach(recalcSkuQty);
  save(); renderInventory(); updateStats();
  alert(`成功導入 ${imported} 行庫存，已用新文件覆蓋舊庫存`);
}

function isSkuHeader(text) {
  const t = normalizeHeader(text);
  return t === 'sku' || t.includes('商品sku') || t.includes('seller sku');
}

function isLocationHeader(text) {
  const t = normalizeHeader(text);
  return ['庫位', '库位', '貨位', '货位', '儲位', '储位', 'location'].some(k => t.includes(k));
}

function isTotalStockHeader(text) {
  const t = normalizeHeader(text);
  return ['總庫存', '总库存', 'total stock', 'total inventory'].some(k => t.includes(k));
}

function normalizeHeader(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function parseQty(value) {
  const cleaned = String(value || '').replace(/,/g, '').trim();
  const qty = parseInt(cleaned, 10);
  return Number.isFinite(qty) ? qty : 0;
}
