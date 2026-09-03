/**
 * API đọc thời khóa biểu từ Google Sheet.
 * Cấu trúc tương thích trực tiếp với bốn trang tính:
 *   1. TKBHocSinh
 *   2. TKBGiaoVien
 *   3. ThoiGianBieu
 *   4. DanhMucGiaoVien
 *
 * Không đặt Spreadsheet ID hoặc thông tin bí mật trong mã nguồn GitHub.
 * Chạy hàm setup() một lần trong Apps Script để lưu ID vào Script Properties.
 */

const TKB_SETTINGS = Object.freeze({
  STUDENT_SHEET: "TKBHocSinh",
  TEACHER_SHEET: "TKBGiaoVien",
  TIME_SHEET: "ThoiGianBieu",
  DIRECTORY_SHEET: "DanhMucGiaoVien",
  CACHE_SECONDS: 300,
  RETURN_STUDENT_PHONE: false,
});

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat"];
const SESSION_NAMES = ["Sáng", "Chiều"];
const DEPARTMENT_NAMES = [
  "Ngữ văn - GDCD",
  "Khoa học tự nhiên",
  "Toán - Tin",
  "Lịch sử và Địa lí",
  "GDTC - Nghệ thuật",
  "Tiếng Anh",
  "Văn phòng",
];
const SCHOOL_SITES = ["Trụ sở", "Phân hiệu", "Cả hai"];
const CACHE_KEYS = Object.freeze({
  STUDENTS: "tkb_students_v2",
  TEACHERS: "tkb_teachers_v3",
  TIMES: "tkb_times_v2",
  DIRECTORY: "tkb_teacher_directory_v1",
  BOOTSTRAP: "tkb_bootstrap_v4",
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

    if (action === "findFreeTeachers") {
      const teachers = findFreeTeachers_(
        clean_(e.parameter.buoi),
        clean_(e.parameter.thu),
        Number(clean_(e.parameter.tiet)),
        clean_(e.parameter.toCM),
        clean_(e.parameter.diemTruong)
      );
      return json_({
        success: true,
        data: teachers,
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
    soToChuyenMon: bootstrap.departments.length,
    soDiemTruong: bootstrap.sites.length,
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
      return {
        id: item.id,
        name: item.title,
        department: item.department || "",
        site: item.site || "",
      };
    }),
    departments: DEPARTMENT_NAMES.slice(),
    sites: ["Trụ sở", "Phân hiệu"],
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

function findFreeTeachers_(sessionValue, dayValue, period, departmentValue, siteValue) {
  const session = normalizeSession_(sessionValue);
  const day = normalizeDayKey_(dayValue);
  if (SESSION_NAMES.indexOf(session) === -1) throw new Error("Buổi phải là Sáng hoặc Chiều.");
  if (DAY_KEYS.indexOf(day) === -1) throw new Error("Thứ không hợp lệ.");
  if (period < 1 || period > 5) throw new Error("Tiết phải từ 1 đến 5.");

  const wantedDepartment = normalizeText_(departmentValue);
  const wantedSite = normalizeText_(siteValue);
  return getTeachers_().filter(function (teacher) {
    const scheduled = clean_(teacher.schedule[session][String(period)][day]);
    if (scheduled) return false;
    if (wantedDepartment && normalizeText_(teacher.department) !== wantedDepartment) return false;
    if (wantedSite) {
      const teacherSite = normalizeText_(teacher.site);
      if (teacherSite !== wantedSite && teacherSite !== normalizeText_("Cả hai")) return false;
    }
    return true;
  }).map(function (teacher) {
    return {
      id: teacher.id,
      name: teacher.title,
      department: teacher.department || "",
      site: teacher.site || "",
    };
  });
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

  const directory = getTeacherDirectory_();
  const directoryByName = {};
  directory.forEach(function (item) {
    directoryByName[normalizeNameKey_(item.name)] = item;
  });

  teachers.forEach(function (teacher) {
    const metadata = directoryByName[normalizeNameKey_(teacher.id)];
    teacher.department = metadata ? metadata.department : "";
    teacher.site = metadata ? metadata.site : "";
    if (metadata && metadata.name) teacher.title = metadata.name;
  });

  putCacheSafely_(CACHE_KEYS.TEACHERS, teachers);
  return teachers;
}

function getTeacherDirectory_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(CACHE_KEYS.DIRECTORY);
  if (cached) return JSON.parse(cached);

  const spreadsheet = getSpreadsheet_();
  const sheet = spreadsheet.getSheetByName(TKB_SETTINGS.DIRECTORY_SHEET);
  if (!sheet) throw new Error("Không tìm thấy trang tính “" + TKB_SETTINGS.DIRECTORY_SHEET + "”.");

  const values = sheet.getDataRange().getDisplayValues();
  validateDirectoryHeaders_(values[0] || []);
  const directory = [];
  const seen = {};

  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const name = clean_(values[rowIndex][0]);
    const department = clean_(values[rowIndex][1]);
    const site = clean_(values[rowIndex][2]);
    if (!name) continue;

    const key = normalizeNameKey_(name);
    if (seen[key]) throw new Error("Giáo viên bị lặp trong DanhMucGiaoVien: “" + name + "”.");
    seen[key] = true;
    if (department && DEPARTMENT_NAMES.map(normalizeText_).indexOf(normalizeText_(department)) === -1) {
      throw new Error("Tổ chuyên môn chưa đúng quy ước ở giáo viên “" + name + "”.");
    }
    if (site && SCHOOL_SITES.map(normalizeText_).indexOf(normalizeText_(site)) === -1) {
      throw new Error("Điểm trường chưa đúng quy ước ở giáo viên “" + name + "”.");
    }

    directory.push({ name: name, department: department, site: site });
  }

  putCacheSafely_(CACHE_KEYS.DIRECTORY, directory);
  return directory;
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
    const candidateSession = normalizeSession_(sessionCell);
    if (SESSION_NAMES.indexOf(candidateSession) !== -1) currentSession = candidateSession;

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
  [
    TKB_SETTINGS.STUDENT_SHEET,
    TKB_SETTINGS.TEACHER_SHEET,
    TKB_SETTINGS.TIME_SHEET,
    TKB_SETTINGS.DIRECTORY_SHEET,
  ].forEach(function (sheetName) {
    if (!spreadsheet.getSheetByName(sheetName)) {
      throw new Error("Thiếu trang tính bắt buộc: “" + sheetName + "”.");
    }
  });
}

function validateDirectoryHeaders_(headers) {
  const expected = ["Giáo viên", "Tổ chuyên môn", "Điểm trường"];
  expected.forEach(function (name, index) {
    if (normalizeText_(headers[index]) !== normalizeText_(name)) {
      throw new Error("Trang “" + TKB_SETTINGS.DIRECTORY_SHEET + "” sai tiêu đề tại cột " + (index + 1) + ". Cần là “" + name + "”.");
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

function normalizeDayKey_(value) {
  const normalized = normalizeText_(value).replace(/\s+/g, "");
  const aliases = {
    mon: "mon", t2: "mon", thu2: "mon", hai: "mon",
    tue: "tue", t3: "tue", thu3: "tue", ba: "tue",
    wed: "wed", t4: "wed", thu4: "wed", tu: "wed",
    thu: "thu", t5: "thu", thu5: "thu", nam: "thu",
    fri: "fri", t6: "fri", thu6: "fri", sau: "fri",
    sat: "sat", t7: "sat", thu7: "sat", bay: "sat",
  };
  return aliases[normalized] || "";
}

function formatTimeCell_(rawValue, displayValue) {
  const match = clean_(displayValue).match(/^(\d{1,2}):(\d{2})/);
  if (match) return String(match[1]).padStart(2, "0") + ":" + match[2];

  if (rawValue instanceof Date && !isNaN(rawValue.getTime())) {
    return Utilities.formatDate(rawValue, Session.getScriptTimeZone(), "HH:mm");
  }
  return "";
}

function normalizeText_(value) {
  return clean_(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function normalizeNameKey_(value) {
  return clean_(value).normalize("NFC").toLocaleLowerCase("vi-VN");
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
    CACHE_KEYS.DIRECTORY,
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
