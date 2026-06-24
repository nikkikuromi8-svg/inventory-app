// ── 操作記錄 ──
function addLog(action, changes, meta = {}) {
  logs.unshift({ time: new Date().toISOString(), action, changes, ...meta });
  if (logs.length > 200) logs = logs.slice(0, 200);
  save();
}

function renderLog() {
  const container = document.getElementById('log-container');
  if (logs.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon">📝</div><p>還沒有操作記錄</p></div>`;
    return;
  }
  container.innerHTML = logs.map(log => {
    const d = new Date(log.time);
    const timeStr = `${d.toLocaleDateString('zh-TW')} ${d.toLocaleTimeString('zh-TW')}`;
    const detail = log.changes.map(c => {
      const shelfStr = c.shelves && c.shelves.length ? ` [${c.shelves.join('/')}]` : '';
      return `${c.sku}${shelfStr}: ${c.before}→${c.after}（-${c.deducted}）`;
    }).join('、');
    const orderNo = log.orderNo ? ` · 揀貨單號：${log.orderNo}` : '';
    return `<div class="log-item">
      <div class="log-time">${timeStr} · ${log.action}${orderNo}</div>
      <div class="log-detail">${detail}</div>
    </div>`;
  }).join('');
}

function clearLog() {
  if (!confirm('確定要清空操作記錄嗎？')) return;
  logs = []; save(); renderLog();
}
