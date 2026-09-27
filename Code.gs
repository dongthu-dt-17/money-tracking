/**
 * Sổ chi tiêu — backend Google Apps Script, gắn vào một Google Sheet.
 *
 * Danh mục, nguồn tiền / tài sản và số dư đầu kỳ nằm trong các sheet cấu hình
 * (Danh mục, Tài sản, Cài đặt) — sửa trên sheet, app tự nhận, không cần sửa code.
 *
 * Lần đầu: chạy hàm setup() một lần, rồi Deploy > New deployment > Web app.
 */

// Mỗi bảng: tên sheet + các cột (key dùng trong code → tiêu đề trên sheet).
// Code tìm cột theo tiêu đề, nên có thể đổi thứ tự cột trên sheet thoải mái.
// Thêm một cột mới vào đây rồi chạy lại setup() → cột được thêm vào sheet đang có.
const SCHEMA = {
  expenses: {
    sheet: 'Chi tiêu',
    cols: { id: 'ID', createdAt: 'Thời gian', month: 'Tháng', category: 'Danh mục', amount: 'Số tiền (VND)', note: 'Ghi chú' },
  },
  transfers: {
    sheet: 'Lưu động',
    cols: { id: 'ID', createdAt: 'Thời gian', month: 'Tháng', source: 'Nguồn tiền', sourceNote: 'Ghi chú nguồn', amount: 'Số tiền (VND)', note: 'Ghi chú' },
  },
  categories: {
    sheet: 'Danh mục',
    cols: { name: 'Tên', icon: 'Icon', color: 'Màu', active: 'Đang dùng', order: 'Thứ tự' },
  },
  sources: {
    sheet: 'Tài sản',
    cols: { name: 'Tên', requireNote: 'Bắt buộc ghi chú', trackBalance: 'Theo dõi số dư', openingBalance: 'Số dư ban đầu', active: 'Đang dùng', order: 'Thứ tự' },
  },
  settings: {
    sheet: 'Cài đặt',
    cols: { key: 'Khoá', value: 'Giá trị', description: 'Mô tả' },
  },
};

// Định dạng theo key cột (áp dụng cho mọi bảng có cột đó).
const COLUMN_FORMATS = {
  createdAt: 'dd/MM/yyyy HH:mm',
  month: '@',
  amount: '#,##0',
  openingBalance: '#,##0',
  value: '@',
};
// Cột kiểu có/không → checkbox cho các dòng mặc định. Ô trống dùng giá trị mặc định ở đây.
const BOOL_DEFAULTS = { active: true, requireNote: false, trackBalance: true };

// Dữ liệu ghi vào sheet cấu hình khi sheet được tạo lần đầu. Sau đó sửa trên sheet.
const DEFAULT_ROWS = {
  categories: [
    { name: 'Ăn uống', icon: '🍜', color: '#2a78d6' },
    { name: 'Đi lại', icon: '🛵', color: '#eb6834' },
    { name: 'Mua sắm', icon: '🛒', color: '#1baf7a' },
    { name: 'Nhà cửa', icon: '🏠', color: '#eda100' },
    { name: 'Giải trí', icon: '🎮', color: '#e87ba4' },
    { name: 'Công việc', icon: '💼', color: '#008300' },
    { name: 'Nhu cầu khác', icon: '📦', color: '#8a8984' },
    { name: 'Thuốc + sức khoẻ', icon: '💊', color: '#e34948' },
    { name: 'Ăn diện', icon: '👗', color: '#4a3aa7' },
  ],
  sources: [
    { name: 'Tiết kiệm TIKOP', requireNote: false, trackBalance: true },
    { name: 'Cô Nguyên vay', requireNote: false, trackBalance: true },
    { name: 'Đóng họ', requireNote: false, trackBalance: true },
    { name: 'Chứng - DNSE', requireNote: false, trackBalance: true },
    { name: 'Khác', requireNote: true, trackBalance: false },
  ],
  settings: [
    { key: 'APP_TITLE', value: 'Sổ chi tiêu', description: 'Tên hiển thị trên app' },
    { key: 'OPENING_BALANCE', value: '0', description: 'Số dư ví tại đầu tháng bắt đầu (VND)' },
    { key: 'START_MONTH', value: '', description: 'Tháng bắt đầu (yyyy-MM). Để trống = tính từ giao dịch đầu tiên' },
    { key: 'DEFAULT_SIGN', value: '-', description: 'Dấu mặc định khi nhập chi tiêu: - (chi) hoặc + (thu)' },
  ],
};

const ENTRY_KINDS = ['expenses', 'transfers'];

// ───────────────────────── Web app ─────────────────────────

function doGet() {
  ensureSetup_();
  const data = getAppData();
  const page = HtmlService.createTemplateFromFile('Index');
  page.boot = JSON.stringify(data).replace(/</g, '\\u003c');
  return page.evaluate()
    .setTitle(data.config.title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover');
}

/** Cấu hình + số liệu của một tháng (mặc định tháng hiện tại). */
function getAppData(month) {
  return { config: getConfig_(), data: getMonthData_(normMonth_(month) || currentMonth_()) };
}

function getMonthData(month) {
  return getMonthData_(normMonth_(month) || currentMonth_());
}

function addExpense(input) {
  const amount = toAmount_(input.amount);
  const category = String(input.category || '').trim();
  if (activeList_('categories').every(c => c.name !== category)) throw new Error('Danh mục không hợp lệ');
  saveEntry_('expenses', { category, amount, note: clean_(input.note) });
  return getAppData();
}

function addTransfer(input) {
  const amount = toAmount_(input.amount);
  const name = String(input.source || '').trim();
  const source = activeList_('sources').find(s => s.name === name);
  if (!source) throw new Error('Nguồn tiền không hợp lệ');
  const sourceNote = clean_(input.sourceNote);
  if (toBool_(source.requireNote, BOOL_DEFAULTS.requireNote) && !sourceNote) {
    throw new Error('Nguồn "' + name + '" cần ghi chú nguồn');
  }
  saveEntry_('transfers', { source: name, sourceNote, amount, note: clean_(input.note) });
  return getAppData();
}

function deleteEntry(kind, id) {
  if (ENTRY_KINDS.indexOf(kind) === -1) throw new Error('Loại dữ liệu không hợp lệ');
  withLock_(() => {
    const row = readRows_(kind).find(r => String(r.id) === String(id));
    if (!row) throw new Error('Không tìm thấy dòng cần xoá (có thể đã bị xoá)');
    sheet_(kind).deleteRow(row._row);
  });
  return getAppData();
}

// ───────────────────────── Setup ─────────────────────────

/** Tạo / bổ sung các sheet theo SCHEMA. Chạy an toàn nhiều lần. */
function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(SCHEMA).forEach(key => {
    const def = SCHEMA[key];
    let sh = ss.getSheetByName(def.sheet);
    const isNew = !sh;
    if (isNew) sh = ss.insertSheet(def.sheet);

    const header = headerRow_(sh);
    const missing = Object.values(def.cols).filter(label => header.indexOf(label) === -1);
    if (missing.length) sh.getRange(1, header.length + 1, 1, missing.length).setValues([missing]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold');

    applyFormats_(sh, def);
    if (isNew && DEFAULT_ROWS[key]) {
      const rows = DEFAULT_ROWS[key].map((r, i) => Object.assign({ active: true, order: i + 1 }, r));
      appendRows_(key, rows);
      addCheckboxes_(sh, def, rows.length);
    }
  });

  // Xoá sheet trống mặc định của file mới.
  ss.getSheets().forEach(sh => {
    const isSchema = Object.values(SCHEMA).some(d => d.sheet === sh.getName());
    if (!isSchema && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });
}

function ensureSetup_() {
  const ss = SpreadsheetApp.getActive();
  if (Object.values(SCHEMA).some(d => !ss.getSheetByName(d.sheet))) setup();
}

function applyFormats_(sh, def) {
  const header = headerRow_(sh);
  const rows = Math.max(sh.getMaxRows() - 1, 1);
  Object.keys(def.cols).forEach(key => {
    const col = header.indexOf(def.cols[key]) + 1;
    if (col && COLUMN_FORMATS[key]) sh.getRange(2, col, rows, 1).setNumberFormat(COLUMN_FORMATS[key]);
  });
}

function addCheckboxes_(sh, def, count) {
  const header = headerRow_(sh);
  Object.keys(BOOL_DEFAULTS).forEach(key => {
    const col = header.indexOf(def.cols[key]) + 1;
    if (col) sh.getRange(2, col, count, 1).insertCheckboxes();
  });
}

// ───────────────────────── Tính toán ─────────────────────────

function getConfig_() {
  const s = getSettings_();
  return {
    title: String(s.APP_TITLE || 'Sổ chi tiêu'),
    defaultSign: String(s.DEFAULT_SIGN || '-').trim() === '+' ? 1 : -1,
    currentMonth: currentMonth_(),
    categories: activeList_('categories').map(c => ({
      name: String(c.name), icon: String(c.icon || ''), color: String(c.color || '').trim(),
    })),
    sources: activeList_('sources').map(src => ({
      name: String(src.name),
      requireNote: toBool_(src.requireNote, BOOL_DEFAULTS.requireNote),
      trackBalance: toBool_(src.trackBalance, BOOL_DEFAULTS.trackBalance),
    })),
  };
}

/**
 * Balance tháng M = balance tháng trước − tổng chi + tiền lưu động.
 * Số tiền lưu có dấu: chi tiêu âm = chi, dương = thu/hoàn; lưu động dương = tiền vào ví.
 * Balance tháng trước = OPENING_BALANCE + mọi giao dịch trước tháng M (từ START_MONTH).
 */
function getMonthData_(month) {
  const s = getSettings_();
  const start = normMonth_(s.START_MONTH);
  const inRange = r => r.month && (!start || r.month >= start);
  const expenses = readRows_('expenses').map(normEntry_).filter(inRange);
  const transfers = readRows_('transfers').map(normEntry_).filter(inRange);

  const sum = rows => rows.reduce((t, r) => t + r.amount, 0);
  const before = r => r.month < month;
  const inMonth = r => r.month === month;
  const monthExpenses = expenses.filter(inMonth);
  const monthTransfers = transfers.filter(inMonth);

  const prevBalance = num_(s.OPENING_BALANCE) + sum(expenses.filter(before)) + sum(transfers.filter(before));
  const totalSpent = -sum(monthExpenses);
  const totalFlow = sum(monthTransfers);

  const byCategory = {};
  monthExpenses.forEach(r => { byCategory[r.category] = (byCategory[r.category] || 0) - r.amount; });

  // Tài sản: tiền vào ví từ một nguồn (+) làm nguồn đó giảm, và ngược lại.
  const assets = activeList_('sources')
    .filter(src => toBool_(src.trackBalance, BOOL_DEFAULTS.trackBalance))
    .map(src => {
      const own = r => r.source === src.name;
      return {
        name: String(src.name),
        balance: num_(src.openingBalance) - sum(transfers.filter(r => own(r) && r.month <= month)),
        changeThisMonth: -sum(monthTransfers.filter(own)),
      };
    });

  const newestFirst = (a, b) => (a.createdAt < b.createdAt ? 1 : -1);
  return {
    month,
    prevBalance,
    totalSpent,
    totalFlow,
    balance: prevBalance - totalSpent + totalFlow,
    byCategory: Object.keys(byCategory).map(k => ({ category: k, amount: byCategory[k] })),
    expenses: monthExpenses.sort(newestFirst),
    transfers: monthTransfers.sort(newestFirst),
    assets,
  };
}

// ───────────────────────── Đọc / ghi sheet ─────────────────────────

function saveEntry_(kind, fields) {
  withLock_(() => {
    const now = new Date();
    appendRows_(kind, [Object.assign({
      id: Utilities.getUuid().slice(0, 8),
      createdAt: now,
      month: Utilities.formatDate(now, tz_(), 'yyyy-MM'),
    }, fields)]);
  });
}

function sheet_(key) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SCHEMA[key].sheet);
  if (!sh) throw new Error('Thiếu sheet "' + SCHEMA[key].sheet + '" — hãy chạy setup()');
  return sh;
}

function headerRow_(sh) {
  const cols = sh.getLastColumn();
  return cols ? sh.getRange(1, 1, 1, cols).getValues()[0].map(v => String(v).trim()) : [];
}

/** Đọc toàn bộ dòng thành object. Cột có trong SCHEMA → key; cột tự thêm → giữ tiêu đề. */
function readRows_(key) {
  const sh = sheet_(key);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const labelToKey = invert_(SCHEMA[key].cols);
  const keys = values[0].map(h => labelToKey[String(h).trim()] || String(h).trim());
  const rows = [];
  values.slice(1).forEach((r, i) => {
    if (r.every(v => v === '')) return;
    const obj = { _row: i + 2 };
    keys.forEach((k, c) => { if (k) obj[k] = r[c]; });
    rows.push(obj);
  });
  return rows;
}

function appendRows_(key, objs) {
  const sh = sheet_(key);
  const header = headerRow_(sh);
  const labelToKey = invert_(SCHEMA[key].cols);
  const rows = objs.map(o => header.map(h => {
    const v = o[labelToKey[h] || h];
    return v === undefined || v === null ? '' : v;
  }));
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, header.length).setValues(rows);
}

function activeList_(key) {
  return readRows_(key)
    .filter(r => String(r.name || '').trim() && toBool_(r.active, BOOL_DEFAULTS.active))
    .map(r => Object.assign(r, { name: String(r.name).trim() }))
    .sort((a, b) => (Number(a.order) || 999) - (Number(b.order) || 999));
}

function getSettings_() {
  const out = {};
  readRows_('settings').forEach(r => { if (r.key) out[String(r.key).trim()] = r.value; });
  return out;
}

/** Chuẩn hoá một dòng giao dịch để gửi về trình duyệt (không được gửi kiểu Date). */
function normEntry_(r) {
  const out = {};
  Object.keys(r).forEach(k => {
    if (k === '_row') return;
    out[k] = r[k] instanceof Date ? r[k].toISOString() : r[k];
  });
  out.month = normMonth_(r.month);
  out.amount = num_(r.amount);
  out.createdAt = r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt || '');
  return out;
}

// ───────────────────────── Tiện ích ─────────────────────────

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function tz_() { return Session.getScriptTimeZone(); }
function currentMonth_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM'); }

function normMonth_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'yyyy-MM');
  const m = String(v || '').trim().match(/^(\d{4})-(\d{1,2})/);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) : '';
}

function num_(v) {
  if (typeof v === 'number') return v;
  const n = Number(String(v || '').replace(/[^\d-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function toAmount_(v) {
  const n = Math.round(Number(v));
  if (!n || !isFinite(n)) throw new Error('Số tiền phải là số khác 0');
  return n;
}

function toBool_(v, fallback) {
  if (v === true || v === false) return v;
  const s = String(v === undefined || v === null ? '' : v).trim().toLowerCase();
  if (!s) return fallback;
  return ['true', 'x', '1', 'yes', 'có', 'co'].indexOf(s) !== -1;
}

function clean_(v) { return String(v || '').trim().slice(0, 500); }

function invert_(obj) {
  const out = {};
  Object.keys(obj).forEach(k => { out[obj[k]] = k; });
  return out;
}
