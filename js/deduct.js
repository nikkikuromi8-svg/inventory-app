// ── 拖拽上傳 ──
function onDragOver(e) { e.preventDefault(); document.getElementById('upload-area').classList.add('dragover'); }
function onDragLeave() { document.getElementById('upload-area').classList.remove('dragover'); }
function onDrop(e) { e.preventDefault(); onDragLeave(); const f = e.dataTransfer.files[0]; if (f) processFile(f); }
function handlePickingFile(e) { const f = e.target.files[0]; if (f) processFile(f); e.target.value = ''; }

async function processFile(file) {
  const container = document.getElementById('result-container');
  container.innerHTML = `<div class="card"><p style="color:#6b7280">解析中...</p></div>`;
  try {
    const text = file.type === 'application/pdf'
      ? await extractPdfText(file)
      : await extractImageText(file);
    const items = parsePickingList(text);
    if (items.length === 0) {
      container.innerHTML = `<div class="card">
        <p style="color:#ef4444;font-weight:500;margin-bottom:12px">未能識別到任何SKU</p>
        <p style="font-size:13px;color:#6b7280;margin-bottom:8px">PDF 提取到的原始文字（請截圖給我看）：</p>
        <pre style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;font-size:12px;overflow-x:auto;white-space:pre-wrap;max-height:300px;overflow-y:auto">${text.replace(/</g,'&lt;').slice(0,3000)}</pre>
      </div>`;
      return;
    }
    showDeductPreview(items);
  } catch (err) {
    container.innerHTML = `<div class="card"><p style="color:#ef4444">解析失敗：${err.message}</p></div>`;
  }
}

// ── 扣減預覽 ──
function showDeductPreview(parsedItems) {
  const allMap = {};
  parsedItems.forEach(({ sku, qty, shelf }) => {
    allMap[sku] = { qty: (allMap[sku]?.qty || 0) + qty, shelf: shelf || allMap[sku]?.shelf || null };
  });
  getManualItems().forEach(({ sku, qty }) => {
    allMap[sku] = { qty: (allMap[sku]?.qty || 0) + qty, shelf: allMap[sku]?.shelf || null };
  });

  const allItems = Object.entries(allMap).map(([sku, d]) => ({ sku, ...d }));
  pendingDeductions = allItems;

  const container = document.getElementById('result-container');
  if (allItems.length === 0) {
    container.innerHTML = `<div class="card"><p style="color:#ef4444">未能識別到任何SKU，請嘗試手動輸入</p></div>`;
    return;
  }

  const html = allItems.map(item => {
    const d = inventory[item.sku];
    const found = d !== undefined;
    const after = found ? Math.max(0, d.qty - item.qty) : null;
    const currentShelves = found ? d.shelves : [];
    const newShelf = item.shelf && !currentShelves.includes(item.shelf) ? item.shelf : null;
    const shelfDisplay = item.shelf ? `📍 ${item.shelf}${newShelf ? ' <span style="color:#f59e0b;font-size:11px;">（新貨架）</span>' : ''}` : '';
    return `<div class="result-item ${!found ? 'not-found' : ''}">
      <div class="result-left">
        <span class="sku">${item.sku}</span>
        ${shelfDisplay ? `<span class="shelves-info">${shelfDisplay}</span>` : ''}
        ${found && currentShelves.length ? `<span class="shelves-info" style="color:#9ca3af">現有貨架：${currentShelves.join('、')}</span>` : ''}
      </div>
      <span class="change">
        ${found ? `${d.qty} → <span>${after}</span>（扣 ${item.qty}）${after < 10 ? ' ⚠️' : ''}` : '未找到此SKU'}
      </span>
    </div>`;
  }).join('');

  container.innerHTML = `<div class="card">
    <div class="result-area">
      <h3>識別結果（${allItems.length} 個SKU）</h3>${html}
    </div>
    <p style="font-size:12px;color:#9ca3af;margin-top:10px;">* 揀貨單上的貨架號會自動更新到庫存記錄</p>
    <div class="deduct-actions">
      <button class="btn btn-primary" onclick="confirmDeduct()">確認扣減</button>
      <button class="btn btn-outline" onclick="document.getElementById('result-container').innerHTML=''">取消</button>
    </div>
  </div>`;
}

// ── 確認扣減 ──
function confirmDeduct() {
  if (pendingDeductions.length === 0) return;
  const changes = [];
  pendingDeductions.forEach(({ sku, qty, shelf }) => {
    if (inventory[sku] !== undefined) {
      const before = inventory[sku].qty;
      inventory[sku].qty = Math.max(0, before - qty);
      if (shelf && !inventory[sku].shelves.includes(shelf)) inventory[sku].shelves.push(shelf);
      changes.push({ sku, before, after: inventory[sku].qty, deducted: qty, shelves: inventory[sku].shelves });
    }
  });
  save();
  addLog('揀貨扣減', changes);
  pendingDeductions = [];
  document.getElementById('result-container').innerHTML = `<div class="card"><p style="color:#16a34a;font-weight:500">✅ 已成功扣減 ${changes.length} 個SKU的庫存，貨架號已更新</p></div>`;
  updateStats(); renderAlerts();
  document.getElementById('manual-rows').innerHTML = `<div class="manual-row"><input class="sku-input" type="text" placeholder="SKU"><input class="qty-input" type="number" placeholder="數量" min="1"><button class="rm-btn" onclick="removeManualRow(this)">×</button></div>`;
}
