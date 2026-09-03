/**
 * API đọc thời khóa biểu từ Google Sheet.
 * Cấu trúc tương thích trực tiếp với ba trang tính:
 *   1. TKBHocSinh
 *   2. TKBGiaoVien
 *   3. ThoiGianBieu
 *
 * Không đặt Spreadsheet ID hoặc thông tin bí mật trong mã nguồn GitHub.
 * Chạy hàm setup() một lần trong Apps Script để lưu ID vào Script Properties.
 */

const TKB_SETTINGS = Object.freeze({
  STUDENT_SHEET: "TKBHocSinh",
  TEACHER_SHEET: "TKBGiaoVien",
  TIME_SHEET: "ThoiGianBieu",
  CACHE_SECONDS: 300,
  RETURN_STUDENT_PHONE: false,
});

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat"];
const SESSION_NAMES = ["Sáng", "Chiều"];
const CACHE_KEYS = Object.freeze({
  STUDENTS: "tkb_students_v1",
  TEACHERS: "tkb_teachers_v1",
  TIMES: "tkb_times_v1",
  BOOTSTRAP: "tkb_bootstrap_v2",
});

function doGet(e) {
  try {
    const action = clean_(e && e.parameter && e.parameter.action) || "bootstrap";

    if (action === "ping") {
      return json_({ success: true, message: "API thời khóa biểu đang hoạt động." });
    }

    if (action === "bootstrap") {
      return json_({
        success: true,
        data: getBootstrap_(),
        updatedAt: new Date().toISOString(),
      });
    }

    if (action === "timetable") {
      const type = clean_(e.parameter.type);
      const id = clean_(e.parameter.id);
      if (!id || (type !== "student" && type !== "teacher")) {
        throw new Error("Tham số type hoặc id không hợp lệ.");
      }

      const timetable = getTimetable_(type, id);
      if (!timetable) throw new Error("Không tìm thấy thời khóa biểu đã chọn.");

      return json_({
        success: true,
        data: timetable,
        updatedAt: new Date().toISOString(),
      });
    }

    throw new Error("Hành động không được hỗ trợ.");
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return json_({
      success: false,
      message: error && error.message ? error.message : "Có lỗi khi đọc thời khóa biểu.",
    });
  }
}

/**
 * Chạy một lần sau khi dán mã vào Apps Script gắn với Google Sheet.
 */
function setup() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error("Hãy mở Apps Script từ chính Google Sheet: Tiện ích mở rộng > Apps Script.");
  }

  validateSheets_(spreadsheet);
  PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", spreadsheet.getId());
  clearCache_();
  console.log("Đã cấu hình thành công cho bảng tính: " + spreadsheet.getName());
}

/**
 * Có thể chạy hàm này để kiểm tra dữ liệu trước khi triển khai Web app.
 */
function testApi() {
  const bootstrap = getBootstrap_();
  console.log(JSON.stringify({
    soLop: bootstrap.classes.length,
    soGiaoVien: bootstrap.teachers.length,
    soMocThoiGian: bootstrap.timeBlocks.length,
    lopDauTien: bootstrap.classes[0] || null,
    giaoVienDauTien: bootstrap.teachers[0] || null,
  }));
}

function getBootstrap_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(CACHE_KEYS.BOOTSTRAP);
  if (cached) return JSON.parse(cached);

  const students = getStudents_();
  const teachers = getTeachers_();
  const data = {
    classes: students.map(function (item) {
      return { id: item.id, name: item.title };
    }),
    teachers: teachers.map(function (item) {
      return { id: item.id, name: item.title };
    }),
    timeBlocks: getTimeBlocks_(),
  };

  putCacheSafely_(CACHE_KEYS.BOOTSTRAP, data);
  return data;
}

function getTimetable_(type, id) {
  const items = type === "student" ? getStudents_() : getTeachers_();
  const wanted = id.toLocaleUpperCase("vi-VN");
  return items.find(function (item) {
    return item.id.toLocaleUpperCase("vi-VN") === wanted;
  }) || null;
}

function getStudents_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(CACHE_KEYS.STUDENTS);
  if (cached) return JSON.parse(cached);

  const spreadsheet = getSpreadsheet_();
  const sheet = spreadsheet.getSheetByName(TKB_SETTINGS.STUDENT_SHEET);
  if (!sheet) throw new Error("Không tìm thấy trang tính “" + TKB_SETTINGS.STUDENT_SHEET + "”.");

  const values = sheet.getDataRange().getDisplayValues();
  validateStudentHeaders_(values[0] || []);

  const byId = {};
  const ordered = [];
  let current = null;
  let currentSession = "";

  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    const classId = clean_(row[0]);

    if (classId) {
      if (!byId[classId]) {
        byId[classId] = {
          type: "student",
          id: classId,
          title: "Lớp " + classId,
          homeroomTeacher: clean_(row[1]),
          phone: TKB_SETTINGS.RETURN_STUDENT_PHONE ? clean_(row[2]) : "",
          note: "",
          schedule: emptySchedule_(),
        };
        ordered.push(byId[classId]);
      }
      current = byId[classId];
      if (clean_(row[1])) current.homeroomTeacher = clean_(row[1]);
      if (TKB_SETTINGS.RETURN_STUDENT_PHONE && clean_(row[2])) current.phone = clean_(row[2]);
      currentSession = "";
    }

    if (!current) continue;

    const sessionOrNote = clean_(row[3]);
    const normalizedMarker = sessionOrNote.toLocaleUpperCase("vi-VN");

    if (normalizedMarker.indexOf("GHI CHÚ") === 0) {
      current.note = sessionOrNote.replace(/^Ghi\s*chú\s*/i, "").trim();
      continue;
    }

    if (normalizedMarker === "SÁNG") currentSession = "Sáng";
    if (normalizedMarker === "CHIỀU") currentSession = "Chiều";

    const period = Number(clean_(row[4]));
    if (!currentSession || period < 1 || period > 5) continue;

    for (let dayIndex = 0; dayIndex < DAY_KEYS.length; dayIndex += 1) {
      current.schedule[currentSession][String(period)][DAY_KEYS[dayIndex]] = clean_(row[5 + dayIndex]);
    }
  }

  putCacheSafely_(CACHE_KEYS.STUDENTS, ordered);
  return ordered;
}

function getTeachers_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(CACHE_KEYS.TEACHERS);
  if (cached) return JSON.parse(cached);

  const spreadsheet = getSpreadsheet_();
  const sheet = spreadsheet.getSheetByName(TKB_SETTINGS.TEACHER_SHEET);
  if (!sheet) throw new Error("Không tìm thấy trang tính “" + TKB_SETTINGS.TEACHER_SHEET + "”.");

  const values = sheet.getDataRange().getDisplayValues();
  const teachers = [];
  let current = null;
  let currentSession = "";

  for (let rowIndex = 0; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    const first = clean_(row[0]);
    const upper = first.toLocaleUpperCase("vi-VN");
    const restIsEmpty = row.slice(1, 7).every(function (value) {
      return !clean_(value);
    });
    const isControl = upper === "SÁNG" || upper === "CHIỀU" || upper === "TIẾT";
    const isPeriod = /^[1-5]$/.test(first);

    if (first && restIsEmpty && !isControl && !isPeriod) {
      current = {
        type: "teacher",
        id: first,
        title: first,
        note: "",
        schedule: emptySchedule_(),
      };
      teachers.push(current);
      currentSession = "";
      continue;
    }

    if (!current) continue;
    if (upper === "SÁNG") {
      currentSession = "Sáng";
      continue;
    }
    if (upper === "CHIỀU") {
      currentSession = "Chiều";
      continue;
    }
    if (upper === "TIẾT" || !isPeriod || !currentSession) continue;

    for (let dayIndex = 0; dayIndex < DAY_KEYS.length; dayIndex += 1) {
      current.schedule[currentSession][first][DAY_KEYS[dayIndex]] = clean_(row[1 + dayIndex]);
    }
  }

  putCacheSafely_(CACHE_KEYS.TEACHERS, teachers);
  return teachers;
}

function getTimeBlocks_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(CACHE_KEYS.TIMES);
  if (cached) return JSON.parse(cached);

  const spreadsheet = getSpreadsheet_();
  const sheet = spreadsheet.getSheetByName(TKB_SETTINGS.TIME_SHEET);
  if (!sheet) throw new Error("Không tìm thấy trang tính “" + TKB_SETTINGS.TIME_SHEET + "”.");

  const lastRow = Math.max(1, sheet.getLastRow());
  const range = sheet.getRange(1, 1, lastRow, 4);
  const rawValues = range.getValues();
  const displayValues = range.getDisplayValues();
  validateTimeHeaders_(displayValues[0] || []);

  const blocks = [];
  let currentSession = "";

  for (let rowIndex = 1; rowIndex < displayValues.length; rowIndex += 1) {
    const displayRow = displayValues[rowIndex];
    const rawRow = rawValues[rowIndex];
    const sessionCell = clean_(displayRow[0]);
    if (sessionCell) currentSession = normalizeSession_(sessionCell);

    const label = clean_(displayRow[1]);
    const start = formatTimeCell_(rawRow[2], displayRow[2]);
    const end = formatTimeCell_(rawRow[3], displayRow[3]);
    if (!currentSession || !label || !start || !end) continue;

    const numericPeriod = /^[1-5]$/.test(label);
    blocks.push({
      session: currentSession,
      type: numericPeriod ? "period" : "break",
      period: numericPeriod ? Number(label) : null,
      label: numericPeriod ? "Tiết " + label : label,
      start: start,
      end: end,
    });
  }

  putCacheSafely_(CACHE_KEYS.TIMES, blocks);
  return blocks;
}

function emptySchedule_() {
  const schedule = {};
  SESSION_NAMES.forEach(function (session) {
    schedule[session] = {};
    for (let period = 1; period <= 5; period += 1) {
      schedule[session][String(period)] = {};
      DAY_KEYS.forEach(function (dayKey) {
        schedule[session][String(period)][dayKey] = "";
      });
    }
  });
  return schedule;
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!id) throw new Error("Chưa cấu hình bảng tính. Hãy chạy hàm setup() một lần.");
  const spreadsheet = SpreadsheetApp.openById(id);
  validateSheets_(spreadsheet);
  return spreadsheet;
}

function validateSheets_(spreadsheet) {
  [TKB_SETTINGS.STUDENT_SHEET, TKB_SETTINGS.TEACHER_SHEET, TKB_SETTINGS.TIME_SHEET].forEach(function (sheetName) {
    if (!spreadsheet.getSheetByName(sheetName)) {
      throw new Error("Thiếu trang tính bắt buộc: “" + sheetName + "”.");
    }
  });
}

function validateStudentHeaders_(headers) {
  const expected = ["Lớp", "GVCN", "Điện thoại", "Buổi", "Tiết", "Thứ Hai"];
  expected.forEach(function (name, index) {
    if (clean_(headers[index]).toLocaleUpperCase("vi-VN") !== name.toLocaleUpperCase("vi-VN")) {
      throw new Error("Trang “" + TKB_SETTINGS.STUDENT_SHEET + "” sai tiêu đề tại cột " + (index + 1) + ". Cần là “" + name + "”.");
    }
  });
}

function validateTimeHeaders_(headers) {
  const expected = ["Buổi", "Tiết", "Thời gian bắt đầu", "Thời gian kết thúc"];
  expected.forEach(function (name, index) {
    if (clean_(headers[index]).toLocaleUpperCase("vi-VN") !== name.toLocaleUpperCase("vi-VN")) {
      throw new Error("Trang “" + TKB_SETTINGS.TIME_SHEET + "” sai tiêu đề tại cột " + (index + 1) + ". Cần là “" + name + "”.");
    }
  });
}

function normalizeSession_(value) {
  const upper = clean_(value).toLocaleUpperCase("vi-VN");
  if (upper === "SÁNG") return "Sáng";
  if (upper === "CHIỀU") return "Chiều";
  return clean_(value);
}

function formatTimeCell_(rawValue, displayValue) {
  if (rawValue instanceof Date && !isNaN(rawValue.getTime())) {
    return Utilities.formatDate(rawValue, Session.getScriptTimeZone(), "HH:mm");
  }

  const match = clean_(displayValue).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";
  return String(match[1]).padStart(2, "0") + ":" + match[2];
}

function putCacheSafely_(key, value) {
  try {
    CacheService.getScriptCache().put(key, JSON.stringify(value), TKB_SETTINGS.CACHE_SECONDS);
  } catch (error) {
    console.warn("Không thể lưu cache " + key + ": " + error.message);
  }
}

function clearCache_() {
  CacheService.getScriptCache().removeAll([
    CACHE_KEYS.STUDENTS,
    CACHE_KEYS.TEACHERS,
    CACHE_KEYS.TIMES,
    CACHE_KEYS.BOOTSTRAP,
  ]);
}

function clean_(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
