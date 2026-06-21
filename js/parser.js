// ── PDF / 圖片文字提取 & 揀貨單解析 ──

async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let allItems = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    content.items.forEach(item => {
      if (item.str.trim()) {
        allItems.push({
          str: item.str.trim(),
          x: Math.round(item.transform[4]),
          y: Math.round(viewport.height - item.transform[5])
        });
      }
    });
  }

  allItems.sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = [];
  let currentRow = [], lastY = -9999;
  for (const item of allItems) {
    if (item.y - lastY > 5 && currentRow.length > 0) { rows.push(currentRow); currentRow = []; }
    currentRow.push(item);
    lastY = item.y;
  }
  if (currentRow.length > 0) rows.push(currentRow);

  window._pdfRows = rows;
  return rows.map(row => row.map(i => i.str).join('\t')).join('\n');
}

async function extractImageText(file) {
  if (!window.Tesseract) {
    await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
  }
  const result = await Tesseract.recognize(file, 'chi_sim+eng');
  return result.data.text;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

function parsePickingList(text) {
  const lines = text.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);
  const items = {};

  // 策略1：座標精確解析（Pick List By Location 格式）
  if (window._pdfRows && window._pdfRows.length > 0) {
    const result = _parseByCoordinates(items);
    if (result) return result;
  }

  // 策略2：Pick List 文字格式（有 location/sku/qty 標題行）
  const isPickListFormat = lines.some(l => /location/i.test(l) && /sku/i.test(l) && /qty/i.test(l));
  if (isPickListFormat) {
    _parsePickListText(lines, items);
  }

  // 策略3：通用備用解析
  if (Object.keys(items).length === 0) {
    _parseGeneric(lines, items);
  }

  return Object.entries(items).map(([sku, d]) => ({ sku, qty: d.qty, shelf: d.shelf }));
}

function _parseByCoordinates(items) {
  const rows = window._pdfRows;
  let headerRow = null, locX = -1, skuX = -1, qtyX = -1;

  for (const row of rows) {
    const rowText = row.map(i => i.str.toLowerCase()).join(' ');
    if (/location/.test(rowText) && /sku/.test(rowText) && /qty/.test(rowText)) {
      headerRow = row;
      row.forEach(item => {
        const t = item.str.toLowerCase();
        if (t === 'location') locX = item.x;
        if (t === 'sku') skuX = item.x;
        if (t === 'qty') qtyX = item.x;
      });
      break;
    }
  }

  if (!headerRow || skuX < 0 || qtyX < 0) return null;

  for (const row of rows) {
    if (row[0].y <= headerRow[0].y) continue;
    const getCell = (targetX) => row.filter(i => Math.abs(i.x - targetX) < 80).map(i => i.str).join(' ').trim();
    const locationPattern = /^\d{2,3}-\d{2,3}-\d{2,3}$/;
    const shelf = locX >= 0 ? getCell(locX) : row.find(i => locationPattern.test(i.str))?.str;
    const sku = getCell(skuX);
    const qty = parseInt(getCell(qtyX));
    if (sku && qty > 0 && qty < 10000) {
      if (items[sku]) items[sku].qty += qty;
      else items[sku] = { qty, shelf: shelf || null };
    }
  }

  return Object.keys(items).length > 0
    ? Object.entries(items).map(([sku, d]) => ({ sku, qty: d.qty, shelf: d.shelf }))
    : null;
}

function _parsePickListText(lines, items) {
  const locationPattern = /^\d{2,3}-\d{2,3}-\d{2,3}$/;
  for (const line of lines) {
    const cells = line.split('\t').map(c => c.trim()).filter(Boolean);
    let shelf = null, sku = null, qty = null;

    if (cells.length >= 3) {
      const locIdx = cells.findIndex(c => locationPattern.test(c));
      let qtyIdx = -1;
      for (let i = cells.length - 1; i >= 0; i--) {
        if (/^\d{1,5}$/.test(cells[i])) { qtyIdx = i; break; }
      }
      if (locIdx >= 0 && qtyIdx > locIdx) {
        shelf = cells[locIdx];
        qty = parseInt(cells[qtyIdx]);
        sku = extractRepeatedSku(cells.slice(locIdx + 1, qtyIdx).join(' ').split(/\s+/));
      }
    }

    if (!sku) {
      const tokens = line.split(/\s+/).filter(Boolean);
      if (tokens.length >= 3 && locationPattern.test(tokens[0])) {
        shelf = tokens[0];
        qty = parseInt(tokens[tokens.length - 1]);
        if (!isNaN(qty) && qty > 0)
          sku = extractRepeatedSku(tokens.slice(1, tokens.length - 1));
      }
    }

    if (sku && sku.length >= 2 && qty > 0) {
      if (items[sku]) { items[sku].qty += qty; if (!items[sku].shelf) items[sku].shelf = shelf; }
      else items[sku] = { qty, shelf };
    }
  }
}

function _parseGeneric(lines, items) {
  const pickingOrderPattern = /^W\d{6,}\w{1,4}$/;
  const datePattern = /^\d{4}[-\/]\d{2}[-\/]\d{2}$|^\d{8}$/;
  const skipKeywords = ['揀貨單','單號','倉庫','備註','合計','總計','打印','日期','page','pick list','picker','wave','total','barcode','item name'];

  for (const line of lines) {
    if (skipKeywords.some(kw => line.toLowerCase().includes(kw))) continue;
    const m3 = /^(.+?)\s{1,}([A-Za-z]{1,3}\d{1,4}(?:-\d+)?)\s{1,}(\d{1,5})\s*$/.exec(line);
    if (m3) {
      const sku = m3[1].trim(), shelf = m3[2], qty = parseInt(m3[3]);
      if (!pickingOrderPattern.test(sku) && !datePattern.test(sku) && isNaN(Number(sku)) && sku.length >= 2 && qty > 0) {
        if (!items[sku]) items[sku] = { qty, shelf }; continue;
      }
    }
    const m2 = /^(.+?)\s{2,}(\d{1,5})\s*$/.exec(line);
    if (m2) {
      const sku = m2[1].trim(), qty = parseInt(m2[2]);
      if (!pickingOrderPattern.test(sku) && !datePattern.test(sku) && isNaN(Number(sku)) && sku.length >= 2 && qty > 0)
        if (!items[sku]) items[sku] = { qty, shelf: null };
    }
  }
}

// SKU 去重：["N18","powerbank","N18","powerbank","N18","powerbank"] → "N18 powerbank"
function extractRepeatedSku(tokens) {
  const total = tokens.length;
  for (const divisor of [3, 2, 1]) {
    if (total % divisor !== 0) continue;
    const unitLen = total / divisor;
    const candidate = tokens.slice(0, unitLen).join(' ');
    if (divisor === 1) return candidate;
    let isRepeat = true;
    for (let i = 1; i < divisor; i++) {
      if (tokens.slice(i * unitLen, (i + 1) * unitLen).join(' ') !== candidate) { isRepeat = false; break; }
    }
    if (isRepeat) return candidate;
  }
  return tokens.slice(0, Math.ceil(total / 2)).join(' ');
}
