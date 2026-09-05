/** Thêm file này vào dự án Apps Script hiện có; KHÔNG thay/xóa Code.gs của giáo viên.
 * Trong doGet(e), thêm ngay sau dấu { :
 * if (e && e.parameter && e.parameter.action === 'studentOnly') return lhpStudentOnlyResponse_();
 * Nhánh này chỉ đọc TKBHocSinh và ThoiGianBieu, không gọi bootstrap/getSpreadsheet_ cũ.
 */
function lhpStudentOnlyResponse_() {
  var result;
  try {
    var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    var book = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
    if (!book) throw new Error('Chưa cấu hình SPREADSHEET_ID trong Thuộc tính tập lệnh.');
    var sheet = book.getSheetByName('TKBHocSinh') || book.getSheetByName('tkbhocsinh');
    if (!sheet) throw new Error('Không tìm thấy sheet TKBHocSinh (hoặc tkbhocsinh).');
    var rows = sheet.getDataRange().getDisplayValues();
    var timeSheet = book.getSheetByName('ThoiGianBieu') || book.getSheetByName('thoigianbieu');
    if (!timeSheet) throw new Error('Không tìm thấy sheet ThoiGianBieu (hoặc thoigianbieu).');
    var timeRows = timeSheet.getDataRange().getDisplayValues();
    // Không đưa số điện thoại GVCN ra API công khai; giữ độ dài và vị trí các cột.
    var phoneCols = [];
    rows.slice(0, 10).some(function(row) {
      var labels = row.map(function(value) {
        return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').trim();
      });
      if (labels.indexOf('lop') < 0 || labels.indexOf('tiet') < 0) return false;
      labels.forEach(function(label, index) {
        if (/dien thoai|sdt|phone/.test(label)) phoneCols.push(index);
      });
      return true;
    });
    rows.forEach(function(row, index) { if (index > 0) phoneCols.forEach(function(col) { row[col] = ''; }); });
    result = { success: true, source: sheet.getName(), rows: rows, timeSource: timeSheet.getName(), timeRows: timeRows, updatedAt: new Date().toISOString() };
  } catch (error) {
    result = { success: false, message: error.message || 'Không đọc được thời khóa biểu học sinh.' };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
