/**
 * Sổ chi tiêu — API Google Apps Script, gắn vào một Google Sheet.
 * Giao diện (index.html) chạy trên GitHub Pages và gọi API này bằng POST.
 *
 * Danh mục, nguồn tiền / tài sản và số dư đầu kỳ nằm trong các sheet cấu hình
 * (Danh mục, Tài sản, Cài đặt) — sửa trên sheet, app tự nhận, không cần sửa code.
 *
 * Lần đầu: chạy setup() → Deploy dạng Web app (Anyone) → chạy showSetupInfo() để lấy mã kết nối.
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
const TOKEN_PROP = 'API_TOKEN';

// ───────────────────────── API ─────────────────────────

const API = {
  getAppData: p => getAppData_(p.month),
  getMonthData: p => getMonthData_(normMonth_(p.month) || currentMonth_()),
  addExpense: p => addExpense_(p),
  addTransfer: p => addTransfer_(p),
  deleteEntry: p => deleteEntry_(p.kind, p.id),
};

/** Body: {"token": "...", "action": "addExpense", "payload": {...}} → {"ok": true, "result": ...} */
function doPost(e) {
  let res;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    checkToken_(req.token);
    ensureSetup_();
    const fn = API[req.action];
    if (!fn) throw apiError_('Không có hành động "' + req.action + '"', 'INVALID');
    res = { ok: true, result: fn(req.payload || {}) };
  } catch (err) {
    res = { ok: false, error: (err && err.message) || String(err), code: (err && err.code) || 'SERVER' };
  }
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}

/** Mở URL web app trên trình duyệt để kiểm tra API đang chạy. */
function doGet() {
  return ContentService.createTextOutput('Sổ chi tiêu API đang chạy. Mở app từ link GitHub Pages.');
}

function getAppData_(month) {
  return { config: getConfig_(), data: getMonthData_(normMonth_(month) || currentMonth_()) };
}

function addExpense_(p) {
  const amount = toAmount_(p.amount);
  const category = String(p.category || '').trim();
  if (activeList_('categories').every(c => c.name !== category)) throw apiError_('Danh mục "' + category + '" không còn trong sheet Danh mục', 'INVALID');
  saveEntry_('expenses', p, { category, amount, note: clean_(p.note) });
  return getAppData_();
}

function addTransfer_(p) {
  const amount = toAmount_(p.amount);
  const name = String(p.source || '').trim();
  const source = activeList_('sources').find(s => s.name === name);
  if (!source) throw apiError_('Nguồn "' + name + '" không còn trong sheet Tài sản', 'INVALID');
  const sourceNote = clean_(p.sourceNote);
  if (toBool_(source.requireNote, BOOL_DEFAULTS.requireNote) && !sourceNote) {
    throw apiError_('Nguồn "' + name + '" cần ghi chú nguồn', 'INVALID');
  }
  saveEntry_('transfers', p, { source: name, sourceNote, amount, note: clean_(p.note) });
  return getAppData_();
}

/** Xoá theo ID. Không tìm thấy (đã xoá trước đó) vẫn coi là thành công, để gửi lại không báo lỗi. */
function deleteEntry_(kind, id) {
  if (ENTRY_KINDS.indexOf(kind) === -1) throw apiError_('Loại dữ liệu không hợp lệ', 'INVALID');
  withLock_(() => {
    const row = readRows_(kind).find(r => String(r.id) === String(id));
    if (!row) return;
    sheet_(kind).deleteRow(row._row);
    delete ROWS_CACHE[kind];
  });
  return getAppData_();
}

// ───────────────────────── Setup ─────────────────────────

/** Tạo / bổ sung các sheet theo SCHEMA và tạo mã bí mật. Chạy an toàn nhiều lần. */
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

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty(TOKEN_PROP)) props.setProperty(TOKEN_PROP, Utilities.getUuid().replace(/-/g, '').slice(0, 16));
  showSetupInfo();
}

/** In ra URL web app và mã bí mật để nhập vào app trên điện thoại. Chạy sau khi đã Deploy. */
function showSetupInfo() {
  const token = PropertiesService.getScriptProperties().getProperty(TOKEN_PROP);
  const url = ScriptApp.getService().getUrl();
  Logger.log('Mã bí mật: ' + token);
  Logger.log('URL web app: ' + (url || '(chưa Deploy — Deploy rồi chạy lại showSetupInfo)'));
}

/** Đổi mã bí mật (khi nghi bị lộ). Sau đó nhập mã mới vào app. */
function resetToken() {
  PropertiesService.getScriptProperties().setProperty(TOKEN_PROP, Utilities.getUuid().replace(/-/g, '').slice(0, 16));
  showSetupInfo();
}

function ensureSetup_() {
  if (Object.keys(SCHEMA).some(key => !sheetOrNull_(key))) setup();
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
      name: c.name, icon: String(c.icon || ''), color: String(c.color || '').trim(),
    })),
    sources: activeList_('sources').map(src => ({
      name: src.name,
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
        name: src.name,
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

// Bộ nhớ tạm trong một lần gọi API: mỗi sheet chỉ đọc một lần.
const ROWS_CACHE = {};
const SHEET_CACHE = {};

/**
 * Ghi một giao dịch. ID do app tạo sẵn, nên gửi lại cùng một khoản (khi mạng chập chờn)
 * không bị ghi trùng. Thời gian lấy lúc bấm Lưu trên điện thoại nếu hợp lệ, không thì giờ server.
 */
function saveEntry_(kind, p, fields) {
  withLock_(() => {
    const id = String(p.id || '').trim() || Utilities.getUuid().slice(0, 8);
    if (readRows_(kind).some(r => String(r.id) === id)) return;
    const at = entryTime_(p.at);
    appendRows_(kind, [Object.assign({ id, createdAt: at, month: Utilities.formatDate(at, tz_(), 'yyyy-MM') }, fields)]);
  });
}

function entryTime_(iso) {
  const now = new Date();
  const at = iso ? new Date(iso) : null;
  const ok = at && !isNaN(at) && at <= new Date(now.getTime() + 5 * 60e3) && at >= new Date(now.getTime() - 7 * 864e5);
  return ok ? at : now;
}

function sheetOrNull_(key) {
  if (!SHEET_CACHE[key]) SHEET_CACHE[key] = SpreadsheetApp.getActive().getSheetByName(SCHEMA[key].sheet);
  return SHEET_CACHE[key];
}

function sheet_(key) {
  const sh = sheetOrNull_(key);
  if (!sh) throw new Error('Thiếu sheet "' + SCHEMA[key].sheet + '" — hãy chạy setup()');
  return sh;
}

function headerRow_(sh) {
  const cols = sh.getLastColumn();
  return cols ? sh.getRange(1, 1, 1, cols).getValues()[0].map(v => String(v).trim()) : [];
}

/** Đọc toàn bộ dòng thành object. Cột có trong SCHEMA → key; cột tự thêm → giữ tiêu đề. */
function readRows_(key) {
  if (ROWS_CACHE[key]) return ROWS_CACHE[key];
  const values = sheet_(key).getDataRange().getValues();
  const labelToKey = invert_(SCHEMA[key].cols);
  const keys = (values[0] || []).map(h => labelToKey[String(h).trim()] || String(h).trim());
  const rows = [];
  values.slice(1).forEach((r, i) => {
    if (r.every(v => v === '')) return;
    const obj = { _row: i + 2 };
    keys.forEach((k, c) => { if (k) obj[k] = r[c]; });
    rows.push(obj);
  });
  ROWS_CACHE[key] = rows;
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
  delete ROWS_CACHE[key];
}

function activeList_(key) {
  return readRows_(key)
    .filter(r => String(r.name || '').trim() && toBool_(r.active, BOOL_DEFAULTS.active))
    .map(r => Object.assign({}, r, { name: String(r.name).trim() }))
    .sort((a, b) => (Number(a.order) || 999) - (Number(b.order) || 999));
}

function getSettings_() {
  const out = {};
  readRows_('settings').forEach(r => { if (r.key) out[String(r.key).trim()] = r.value; });
  return out;
}

/** Chuẩn hoá một dòng giao dịch để trả về dạng JSON. */
function normEntry_(r) {
  const out = {};
  Object.keys(r).forEach(k => {
    if (k === '_row') return;
    out[k] = r[k] instanceof Date ? r[k].toISOString() : r[k];
  });
  out.id = String(r.id);
  out.month = normMonth_(r.month);
  out.amount = num_(r.amount);
  out.createdAt = r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt || '');
  return out;
}

// ───────────────────────── Tiện ích ─────────────────────────

function checkToken_(token) {
  const expected = PropertiesService.getScriptProperties().getProperty(TOKEN_PROP);
  if (!expected) throw apiError_('API chưa có mã bí mật — chạy setup() trong Apps Script', 'AUTH');
  if (String(token || '') !== expected) throw apiError_('Sai mã bí mật', 'AUTH');
}

function apiError_(message, code) {
  const err = new Error(message);
  err.code = code;
  return err;
}

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
  if (!n || !isFinite(n)) throw apiError_('Số tiền phải là số khác 0', 'INVALID');
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
