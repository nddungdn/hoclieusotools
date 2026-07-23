/**
 * API đọc bộ đề thi Ngữ văn 10 từ Google Sheets.
 *
 * Cấu trúc sheet:
 * ID | TinhThanh | Nam | LoaiDe | DeThi | DapAn | TrangThai
 */

const TEN_SHEET = 'Nam2026';

function doGet(e) {
  try {
    const result = {
      ok: true,
      updatedAt: new Date().toISOString(),
      exams: getExams_()
    };
    return output_(result, e);
  } catch (error) {
    return output_({
      ok: false,
      message: error && error.message ? error.message : String(error),
      exams: []
    }, e);
  }
}

function getExams_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TEN_SHEET);
  if (!sheet) {
    throw new Error('Không tìm thấy sheet "' + TEN_SHEET + '".');
  }

  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return [];

  const headers = values[0].map(function (item) {
    return String(item || '').trim();
  });
  const required = ['ID', 'TinhThanh', 'Nam', 'LoaiDe', 'DeThi', 'DapAn', 'TrangThai'];
  required.forEach(function (name) {
    if (headers.indexOf(name) === -1) {
      throw new Error('Thiếu cột "' + name + '".');
    }
  });

  return values.slice(1).filter(function (row) {
    return row.some(function (cell) {
      return String(cell || '').trim() !== '';
    });
  }).map(function (row) {
    const item = {};
    headers.forEach(function (header, index) {
      item[header] = row[index] == null ? '' : String(row[index]);
    });
    return item;
  });
}

function output_(payload, e) {
  const json = JSON.stringify(payload);
  const callback = e && e.parameter ? String(e.parameter.callback || '') : '';

  if (callback && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return ContentService
      .createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

