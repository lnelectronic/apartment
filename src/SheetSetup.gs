// รัน function นี้ครั้งเดียวหลัง clasp push เพื่อสร้าง Sheets และข้อมูลเริ่มต้น
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // ล้าง named ranges ทั้งหมดก่อน (ป้องกัน conflict จากการรันซ้ำที่ fail กลางคัน)
  ss.getNamedRanges().forEach(function(nr) { nr.remove(); });
  SpreadsheetApp.flush();

  // สร้าง sheets ที่ต้องการก่อน แล้วค่อยลบ default sheets
  var settingsSheet = ss.getSheetByName('ตั้งค่า')      || ss.insertSheet('ตั้งค่า');
  var recordSheet   = ss.getSheetByName('บันทึก')       || ss.insertSheet('บันทึก');
  var histSheet     = ss.getSheetByName('ประวัติผู้เช่า') || ss.insertSheet('ประวัติผู้เช่า');

  // ลบ sheets อื่นที่ Google สร้าง default ไว้
  ss.getSheets().forEach(function(sheet) {
    var name = sheet.getName();
    if (name !== 'ตั้งค่า' && name !== 'บันทึก' && name !== 'ประวัติผู้เช่า') {
      ss.deleteSheet(sheet);
    }
  });

  _setupSettingsSheet(settingsSheet, ss);
  _setupRecordSheet(recordSheet);
  _setupTenantHistorySheet(histSheet);

  SpreadsheetApp.flush();
  Logger.log('Setup สำเร็จ! ห้องทั้งหมด ' + _getRoomList().length + ' ห้อง พร้อมใช้งาน');
}

// ------------------------------------------------------------------ //

function _setupTenantHistorySheet(sheet) {
  sheet.clearContents();
  sheet.clearFormats();

  var headers = [
    'เลขห้อง', 'ชื่อผู้เช่า', 'เบอร์โทร',
    'วันย้ายเข้า', 'วันย้ายออก', 'เงินมัดจำ',
    'หัก-1 รายการ', 'หัก-1 จำนวน',
    'หัก-2 รายการ', 'หัก-2 จำนวน',
    'ยอดค้าง', 'ยอดคืน/ขาด'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  var headerStyle = SpreadsheetApp.newTextStyle().setBold(true).build();
  sheet.getRange(1, 1, 1, headers.length)
    .setTextStyle(headerStyle)
    .setBackground('#cc4125')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 40);

  sheet.setColumnWidth(1,  90);   // เลขห้อง
  sheet.setColumnWidth(2,  160);  // ชื่อผู้เช่า
  sheet.setColumnWidth(3,  130);  // เบอร์โทร
  sheet.setColumnWidth(4,  110);  // วันย้ายเข้า
  sheet.setColumnWidth(5,  110);  // วันย้ายออก
  sheet.setColumnWidth(6,  110);  // เงินมัดจำ
  sheet.setColumnWidth(7,  160);  // หัก-1 รายการ
  sheet.setColumnWidth(8,  90);   // หัก-1 จำนวน
  sheet.setColumnWidth(9,  160);  // หัก-2 รายการ
  sheet.setColumnWidth(10, 90);   // หัก-2 จำนวน
  sheet.setColumnWidth(11, 90);   // ยอดค้าง
  sheet.setColumnWidth(12, 110);  // ยอดคืน/ขาด
}

// ------------------------------------------------------------------ //
// Backup / Restore — ใช้ก่อน/หลังแก้โครงสร้าง Sheet เพื่อไม่ให้ข้อมูลหาย
// ──────────────────────────────────────────────────────────────────
// Workflow ทั่วไป:
//   1. backupRoomData()          → ได้ชื่อ Backup_YYYYMMDD_HHmmss
//   2. แก้โครงสร้าง (setupSheets / migrate ใดๆ)
//   3. restoreFromBackup()       → ดึงข้อมูลกลับโดย match roomId
//
// หรือใช้ safeSetupSheets() แทน setupSheets() เพื่อทำทั้ง 3 ขั้นอัตโนมัติ
// ------------------------------------------------------------------ //

function backupRoomData() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = _getSettingsSheet();

  var ts     = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmmss');
  var name   = 'Backup_' + ts;
  var backup = ss.insertSheet(name);

  // rates A1:D3 (header + แถว C + แถว R)
  var ratesData = sheet.getRange('A1:D3').getValues();
  backup.getRange(1, 1, ratesData.length, ratesData[0].length).setValues(ratesData);

  // room header + data จาก row 5 ขึ้นไป (col A-J)
  var lastRow = sheet.getLastRow();
  if (lastRow >= 5) {
    var roomData = sheet.getRange(5, 1, lastRow - 4, 10).getValues();
    backup.getRange(5, 1, roomData.length, roomData[0].length).setValues(roomData);
  }

  SpreadsheetApp.flush();
  var roomCount = Math.max(0, lastRow - 5);
  Logger.log('backupRoomData: สร้าง "' + name + '" สำเร็จ (' + roomCount + ' ห้อง)');
  return name;
}

// ถ้าไม่ระบุ backupSheetName จะใช้ backup ล่าสุดอัตโนมัติ
function restoreFromBackup(backupSheetName) {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var backup = backupSheetName
    ? ss.getSheetByName(backupSheetName)
    : _getLatestBackupSheet(ss);

  if (!backup) throw new Error('ไม่พบ backup sheet' + (backupSheetName ? ' "' + backupSheetName + '"' : ' ใดๆ'));

  var settings = _getSettingsSheet();

  // restore rates A2:D3
  var ratesBackup = backup.getRange('A2:D3').getValues();
  if (ratesBackup[0][0]) {
    settings.getRange('A2:D3').setValues(ratesBackup);
    Logger.log('restoreFromBackup: rates สำเร็จ');
  }

  // อ่าน room data จาก backup (row 6+)
  var backupLastRow = backup.getLastRow();
  if (backupLastRow < 6) {
    Logger.log('restoreFromBackup: ไม่มีข้อมูลห้องใน backup');
    return;
  }
  var backupRooms = backup.getRange(6, 1, backupLastRow - 5, 10).getValues();

  // map roomId → cols B-J
  var backupMap = {};
  backupRooms.forEach(function(row) {
    if (row[0]) backupMap[String(row[0])] = row.slice(1);
  });

  // เขียนกลับโดย match roomId ใน settings ปัจจุบัน
  var settingsLastRow = settings.getLastRow();
  if (settingsLastRow < 6) { Logger.log('restoreFromBackup: ไม่มีห้องใน settings'); return; }

  var settingsRooms = settings.getRange(6, 1, settingsLastRow - 5, 1).getValues();
  var restored = 0, skipped = 0;
  settingsRooms.forEach(function(row, i) {
    var roomId = String(row[0]);
    if (!roomId || !backupMap[roomId]) { skipped++; return; }
    settings.getRange(i + 6, 2, 1, 9).setValues([backupMap[roomId]]);
    restored++;
  });

  SpreadsheetApp.flush();
  Logger.log('restoreFromBackup: สำเร็จ — restore ' + restored + ' ห้อง, ข้าม ' + skipped + ' (จาก "' + backup.getName() + '")');
}

function listBackups() {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var backups = ss.getSheets().filter(function(s) { return s.getName().indexOf('Backup_') === 0; });
  if (!backups.length) { Logger.log('ไม่มี backup sheets'); return; }
  backups.sort(function(a, b) { return a.getName() < b.getName() ? 1 : -1; }); // ล่าสุดก่อน
  Logger.log('Backup sheets (' + backups.length + ' รายการ):');
  backups.forEach(function(s, i) { Logger.log((i + 1) + '. ' + s.getName()); });
}

function _getLatestBackupSheet(ss) {
  var backups = ss.getSheets().filter(function(s) { return s.getName().indexOf('Backup_') === 0; });
  if (!backups.length) return null;
  backups.sort(function(a, b) { return a.getName() < b.getName() ? 1 : -1; });
  return backups[0];
}

// safeSetupSheets: backup → setupSheets() → restore ในครั้งเดียว
// ใช้แทน setupSheets() เสมอเมื่อมีข้อมูลจริงอยู่ใน sheet แล้ว
function safeSetupSheets() {
  Logger.log('safeSetupSheets: เริ่ม [1/3] backup...');
  var backupName = backupRoomData();

  Logger.log('safeSetupSheets: [2/3] setupSheets...');
  setupSheets();

  Logger.log('safeSetupSheets: [3/3] restore จาก "' + backupName + '"...');
  restoreFromBackup(backupName);

  Logger.log('safeSetupSheets: เสร็จสมบูรณ์ — ข้อมูลห้องพักได้รับการ restore แล้ว');
}

// ------------------------------------------------------------------ //
// Migration: เพิ่ม col G-J (ตั้งค่า) + สร้าง Sheet "ประวัติผู้เช่า"
// รันครั้งเดียวบน Sheet ที่มีข้อมูลผู้เช่าอยู่แล้ว
function migrateAddTenantFields() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = _getSettingsSheet();

  // ตรวจว่า col G มีแล้วหรือยัง (ป้องกันรันซ้ำ)
  var existing = sheet.getRange('G5').getValue();
  if (existing && existing !== '') {
    Logger.log('migrateAddTenantFields: col G5 มีข้อมูลอยู่แล้ว ("' + existing + '") — ข้าม');
    return;
  }

  // เพิ่ม header G5:J5
  sheet.getRange('G5:J5').setValues([[
    'วันที่ย้ายเข้า', 'เงินมัดจำ (บาท)', 'เบอร์โทรศัพท์', 'Note ห้อง'
  ]]);
  var headerStyle = SpreadsheetApp.newTextStyle().setBold(true).build();
  sheet.getRange('G5:J5')
    .setTextStyle(headerStyle)
    .setBackground('#6aa84f')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  sheet.setColumnWidth(7,  120);
  sheet.setColumnWidth(8,  120);
  sheet.setColumnWidth(9,  140);
  sheet.setColumnWidth(10, 160);

  // อัป banding ให้ครอบ 10 cols
  _applyRoomBanding(sheet);

  // สร้าง Sheet "ประวัติผู้เช่า" ถ้ายังไม่มี
  var histSheet = ss.getSheetByName('ประวัติผู้เช่า') || ss.insertSheet('ประวัติผู้เช่า');
  _setupTenantHistorySheet(histSheet);

  SpreadsheetApp.flush();
  Logger.log('migrateAddTenantFields: สำเร็จ — เพิ่ม col G-J (ตั้งค่า) + Sheet "ประวัติผู้เช่า"');
}

// ------------------------------------------------------------------ //
// Migration: เพิ่ม col D ราคาน้ำขั้นต่ำ โดยไม่แตะข้อมูลห้องเดิม
// รันครั้งเดียวบน Sheet ที่มีข้อมูลผู้เช่าอยู่แล้ว
function migrateAddWaterMin() {
  var sheet = _getSettingsSheet();

  // ตรวจว่า col D มีค่าแล้วหรือยัง (ป้องกันรันซ้ำ)
  var existing = sheet.getRange('D1').getValue();
  if (existing && existing !== '') {
    Logger.log('migrateAddWaterMin: col D มีข้อมูลอยู่แล้ว (' + existing + ') — ข้าม');
    return;
  }

  // เพิ่ม header col D
  sheet.getRange('D1').setValue('ราคาน้ำขั้นต่ำ (บาท)');

  // ใส่ค่า 120 ทั้ง row C (row 2) และ R (row 3)
  sheet.getRange('D2:D3').setValues([[120], [120]]);

  // จัด style header ให้เข้ากับ A1:C1 เดิม
  var headerStyle = SpreadsheetApp.newTextStyle().setBold(true).build();
  sheet.getRange('D1').setTextStyle(headerStyle).setBackground('#4a86e8').setFontColor('#ffffff').setHorizontalAlignment('center');
  sheet.setColumnWidth(4, 160);

  // ใส่สีสลับบรรทัดให้ส่วนรายชื่อห้อง
  _applyRoomBanding(sheet);

  SpreadsheetApp.flush();
  Logger.log('migrateAddWaterMin: เพิ่ม col D ราคาน้ำขั้นต่ำ = 120 + สีสลับบรรทัด สำเร็จ');
}

function _applyRoomBanding(sheet) {
  // ลบ banding เก่าออกก่อน (ป้องกัน error ถ้ารันซ้ำ)
  sheet.getBandings().forEach(function(b) { b.remove(); });

  var lastRow = sheet.getLastRow();
  if (lastRow < 6) return; // ยังไม่มีข้อมูลห้อง

  sheet.getRange(6, 1, lastRow - 5, 10)
    .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false);
}

// ------------------------------------------------------------------ //

function _setupSettingsSheet(sheet, ss) {
  sheet.clearContents();
  sheet.clearFormats();

  // ส่วนที่ 1: ราคาสาธารณูปโภค (row 1-3)
  var rateHeaders = [['ตึก', 'ราคาน้ำต่อหน่วย (บาท)', 'ราคาไฟต่อหน่วย (บาท)', 'ราคาน้ำขั้นต่ำ (บาท)']];
  sheet.getRange('A1:D1').setValues(rateHeaders);
  sheet.getRange('A2:D3').setValues([
    ['C', 10, 5, 120],
    ['R', 10, 5, 120]
  ]);

  // row 4 ว่าง (spacer)

  // ส่วนที่ 2: รายชื่อห้อง (row 5 = header, row 6+ = data)
  sheet.getRange('A5:J5').setValues([[
    'เลขห้อง', 'ชื่อผู้เช่า', 'ค่าเช่า (บาท)', 'ค่าเฟอร์นิเจอร์ (บาท)',
    'ไฟ-เริ่มต้น (หน่วย)', 'น้ำ-เริ่มต้น (หน่วย)',
    'วันที่ย้ายเข้า', 'เงินมัดจำ (บาท)', 'เบอร์โทรศัพท์', 'Note ห้อง'
  ]]);

  var rooms = _getRoomList();
  var roomData = rooms.map(function(roomId, i) {
    var rent = (i % 2 === 0) ? 2000 : 5000; // ค่าทดสอบ — แอดมินแก้ได้
    return [roomId, '', rent, 0, 0, 0, '', 0, '', ''];
  });
  sheet.getRange(6, 1, roomData.length, 10).setValues(roomData);

  // Formatting
  var headerStyle = SpreadsheetApp.newTextStyle().setBold(true).build();
  sheet.getRange('A1:D1').setTextStyle(headerStyle).setBackground('#4a86e8').setFontColor('#ffffff');
  sheet.getRange('A5:J5').setTextStyle(headerStyle).setBackground('#6aa84f').setFontColor('#ffffff');
  sheet.getRange('A1:D1').setHorizontalAlignment('center');
  sheet.getRange('A5:J5').setHorizontalAlignment('center');
  sheet.setColumnWidth(1, 100);
  sheet.setColumnWidth(2, 180);
  sheet.setColumnWidth(3, 140);
  sheet.setColumnWidth(4, 160);
  sheet.setColumnWidth(5, 150);
  sheet.setColumnWidth(6, 150);
  sheet.setColumnWidth(7, 120);
  sheet.setColumnWidth(8, 120);
  sheet.setColumnWidth(9, 140);
  sheet.setColumnWidth(10, 160);
  sheet.setFrozenRows(0);

  // สีสลับบรรทัดส่วนรายชื่อห้อง
  _applyRoomBanding(sheet);

  // DataService.gs ใช้ hardcoded range แทน named range เพื่อความเรียบง่าย
}

function _setupRecordSheet(sheet) {
  sheet.clearContents();
  sheet.clearFormats();

  // ป้องกัน Sheets auto-convert "6/2026" → Date object (จะทำให้ _findRecordRow เจอ type mismatch)
  sheet.getRange('A:A').setNumberFormat('@');

  var headers = [
    'เดือน/ปี',       // col 1  A
    'เลขห้อง',        // col 2  B
    'ไฟ-เริ่ม',       // col 3  C
    'ไฟ-ถึง',         // col 4  D
    'ไฟ-ใช้ไป',       // col 5  E
    'ไฟ-เป็นเงิน',    // col 6  F
    'น้ำ-เริ่ม',       // col 7  G
    'น้ำ-ถึง',         // col 8  H
    'น้ำ-ใช้ไป',       // col 9  I
    'น้ำ-เป็นเงิน',    // col 10 J
    'ค่าเช่า',         // col 11 K
    'ค่าเฟอร์นิเจอร์', // col 12 L
    'ค้างเดือนก่อน',   // col 13 M
    'ค่าปรับ',         // col 14 N
    'รายการอื่น-1 ชื่อ',   // col 15 O
    'รายการอื่น-1 จำนวน',  // col 16 P
    'รายการอื่น-2 ชื่อ',   // col 17 Q
    'รายการอื่น-2 จำนวน',  // col 18 R
    'รวม',             // col 19 S
    'จ่ายจริง',        // col 20 T
    'สถานะ',           // col 21 U
    'วันที่จด'         // col 22 V
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Formatting
  var headerStyle = SpreadsheetApp.newTextStyle().setBold(true).build();
  sheet.getRange(1, 1, 1, headers.length)
    .setTextStyle(headerStyle)
    .setBackground('#434343')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center')
    .setWrap(true);

  sheet.setRowHeight(1, 50);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);

  // ปรับความกว้าง column
  [1,2].forEach(function(c) { sheet.setColumnWidth(c, 80); });
  [3,4,5,6,7,8,9,10].forEach(function(c) { sheet.setColumnWidth(c, 80); });
  [11,12,13,14].forEach(function(c) { sheet.setColumnWidth(c, 110); });
  [15,17].forEach(function(c) { sheet.setColumnWidth(c, 140); });
  [16,18].forEach(function(c) { sheet.setColumnWidth(c, 90); });
  sheet.setColumnWidth(19, 90);
  sheet.setColumnWidth(20, 90);
  sheet.setColumnWidth(21, 90);
  sheet.setColumnWidth(22, 140);
}

// ------------------------------------------------------------------ //
// Test Data (ลบออกก่อนส่งมอบงานจริง)
// ------------------------------------------------------------------ //

// Scenario ทดสอบ (1/2026–6/2026):
//   C101: 3/2026 จ่ายไม่ครบ → 4/2026 มีค้าง 365 / 5/2026 จ่ายไม่ครบ → 6/2026 จะเห็นค้าง 400
//   C201: จ่ายหมดทุกเดือน / 3/2026 มีค่าซ่อม 500 / 6/2026 จดแล้ว (บล็อก+แก้ไขทับ)
//   C202: ว่าง (ทดสอบ error ห้องว่าง)
//   R15:  5/2026 ไม่ได้จ่ายเลย → 6/2026 จะเห็นค้าง 3,980 + สถานะค้างจ่าย
//   R16:  จ่ายหมดทุกเดือน
//   RC1:  1/2026 มีค่าทำความสะอาด 300 / จ่ายหมดทุกเดือน
function seedTestData() {
  var ss            = SpreadsheetApp.getActiveSpreadsheet();
  var settingsSheet = ss.getSheetByName('ตั้งค่า');
  var recordSheet   = ss.getSheetByName('บันทึก');
  if (!settingsSheet || !recordSheet) {
    throw new Error('ยังไม่ได้รัน setupSheets() — กรุณารัน setupSheets() ก่อน');
  }

  // 1. ตั้งค่าห้องทดสอบใน "ตั้งค่า"
  var testRoomInfo = {
    'C101': { name: 'สมชาย มีสุข',       rent: 3000, furniture: 0,    elecInit: 1000, waterInit: 500 },
    'C201': { name: 'กาญจนา ดีงาม',      rent: 4000, furniture: 200,  elecInit: 800,  waterInit: 300 },
    'C202': { name: '',                   rent: 3000, furniture: 0,    elecInit: 0,    waterInit: 0   },
    'R15':  { name: 'วิชัย สบายดี',      rent: 3500, furniture: 0,    elecInit: 500,  waterInit: 200 },
    'R16':  { name: 'มานี รักดี',        rent: 3000, furniture: 500,  elecInit: 300,  waterInit: 150 },
    'RC1':  { name: 'ประยุทธ์ เข้มแข็ง', rent: 5000, furniture: 1000, elecInit: 1500, waterInit: 700 }
  };
  var settingsData = settingsSheet.getRange('A6:F51').getValues();
  settingsData.forEach(function(row, i) {
    var id = row[0];
    if (!id || !testRoomInfo[id]) return;
    var info = testRoomInfo[id];
    var r    = i + 6;
    settingsSheet.getRange(r, 2).setValue(info.name);
    settingsSheet.getRange(r, 3).setValue(info.rent);
    settingsSheet.getRange(r, 4).setValue(info.furniture);
    settingsSheet.getRange(r, 5).setValue(info.elecInit);
    settingsSheet.getRange(r, 6).setValue(info.waterInit);
  });

  // 2. Records 1/2026–6/2026
  // meter readings ต่อเนื่องทุกเดือน, ค้างเดือนก่อน = (รวมเดือนก่อน - จ่ายจริงเดือนก่อน)
  //
  // C101 (ค่าเช่า=3000, เฟอร์=0, ไฟ×5, น้ำ×10):
  //   1/26: ไฟ 1000→1042(210), น้ำ 500→513(130), ค้าง=0,   รวม=3340, paid=3340  ← จ่ายหมด
  //   2/26: ไฟ 1042→1085(215), น้ำ 513→526(130), ค้าง=0,   รวม=3345, paid=3345  ← จ่ายหมด
  //   3/26: ไฟ 1085→1130(225), น้ำ 526→540(140), ค้าง=0,   รวม=3365, paid=3000  ← ค้าง 365
  //   4/26: ไฟ 1130→1175(225), น้ำ 540→555(150), ค้าง=365, รวม=3740, paid=3740  ← จ่ายหมด
  //   5/26: ไฟ 1175→1225(250), น้ำ 555→570(150), ค้าง=0,   รวม=3400, paid=3000  ← ค้าง 400
  //   6/26: (ยังไม่จด → จะเห็น ค้างเดือนก่อน=400)
  //
  // C201 (ค่าเช่า=4000, เฟอร์=200, ไฟ×5, น้ำ×10):
  //   1/26: ไฟ 800→862(310),  น้ำ 300→317(170), ค้าง=0, รวม=4680, paid=4680  ← จ่ายหมด
  //   2/26: ไฟ 862→927(325),  น้ำ 317→334(170), ค้าง=0, รวม=4695, paid=4695  ← จ่ายหมด
  //   3/26: ไฟ 927→992(325),  น้ำ 334→352(180), ค้าง=0, ซ่อม=500, รวม=5205, paid=5205 ← จ่ายหมด
  //   4/26: ไฟ 992→1059(335), น้ำ 352→370(180), ค้าง=0, รวม=4715, paid=4715  ← จ่ายหมด
  //   5/26: ไฟ1059→1129(350), น้ำ 370→390(200), ค้าง=0, รวม=4750, paid=4750  ← จ่ายหมด
  //   6/26: ไฟ1129→1199(350), น้ำ 390→408(180), ค้าง=0, อินเตอร์=200, รวม=4930, paid=0 ← จดแล้ว
  //
  // R15 (ค่าเช่า=3500, เฟอร์=0, ไฟ×5, น้ำ×10):
  //   1/26: ไฟ 500→555(275),  น้ำ 200→217(170), ค้าง=0, รวม=3945, paid=3945  ← จ่ายหมด
  //   2/26: ไฟ 555→615(300),  น้ำ 217→234(170), ค้าง=0, รวม=3970, paid=3970  ← จ่ายหมด
  //   3/26: ไฟ 615→673(290),  น้ำ 234→251(170), ค้าง=0, รวม=3960, paid=3960  ← จ่ายหมด
  //   4/26: ไฟ 673→733(300),  น้ำ 251→268(170), ค้าง=0, รวม=3970, paid=3970  ← จ่ายหมด
  //   5/26: ไฟ 733→793(300),  น้ำ 268→286(180), ค้าง=0, รวม=3980, paid=0     ← ค้าง 3980
  //   6/26: (ยังไม่จด → จะเห็น ค้างเดือนก่อน=3980, สถานะค้างจ่าย)
  //
  // R16 (ค่าเช่า=3000, เฟอร์=500, ไฟ×5, น้ำ×10):
  //   1/26: ไฟ 300→338(190), น้ำ 150→163(130), ค้าง=0, รวม=3820, paid=3820  ← จ่ายหมด
  //   2/26: ไฟ 338→377(195), น้ำ 163→176(130), ค้าง=0, รวม=3825, paid=3825  ← จ่ายหมด
  //   3/26: ไฟ 377→415(190), น้ำ 176→189(130), ค้าง=0, รวม=3820, paid=3820  ← จ่ายหมด
  //   4/26: ไฟ 415→456(205), น้ำ 189→203(140), ค้าง=0, รวม=3845, paid=3845  ← จ่ายหมด
  //   5/26: ไฟ 456→496(200), น้ำ 203→218(150), ค้าง=0, รวม=3850, paid=3850  ← จ่ายหมด
  //   6/26: (ยังไม่จด)
  //
  // RC1 (ค่าเช่า=5000, เฟอร์=1000, ไฟ×5, น้ำ×10):
  //   1/26: ไฟ1500→1585(425), น้ำ 700→728(280), ค้าง=0, ทำสะอาด=300, รวม=7005, paid=7005 ← จ่ายหมด
  //   2/26: ไฟ1585→1673(440), น้ำ 728→756(280), ค้าง=0, รวม=6720, paid=6720  ← จ่ายหมด
  //   3/26: ไฟ1673→1763(450), น้ำ 756→786(300), ค้าง=0, รวม=6750, paid=6750  ← จ่ายหมด
  //   4/26: ไฟ1763→1853(450), น้ำ 786→817(310), ค้าง=0, รวม=6760, paid=6760  ← จ่ายหมด
  //   5/26: ไฟ1853→1945(460), น้ำ 817→848(310), ค้าง=0, รวม=6770, paid=6770  ← จ่ายหมด
  //   6/26: (ยังไม่จด)
  var allRecords = [
    // ---- 1/2026 ----
    { m:'1/2026', r:'C101', es:1000,ee:1042,eu:42, ea:210,  ws:500, we:517,wu:17, wa:170,  rent:3000,fur:0,   prev:0,   fine:0,i1n:'',           i1a:0,  i2n:'',i2a:0, paid:3340, st:'จ่ายแล้ว' },
    { m:'1/2026', r:'C201', es:800, ee:862, eu:62, ea:310,  ws:300, we:317,wu:17, wa:170,  rent:4000,fur:200, prev:0,   fine:0,i1n:'',           i1a:0,  i2n:'',i2a:0, paid:4680, st:'จ่ายแล้ว' },
    { m:'1/2026', r:'R15',  es:500, ee:555, eu:55, ea:275,  ws:200, we:217,wu:17, wa:170,  rent:3500,fur:0,   prev:0,   fine:0,i1n:'',           i1a:0,  i2n:'',i2a:0, paid:3945, st:'จ่ายแล้ว' },
    { m:'1/2026', r:'R16',  es:300, ee:338, eu:38, ea:190,  ws:150, we:163,wu:13, wa:130,  rent:3000,fur:500, prev:0,   fine:0,i1n:'',           i1a:0,  i2n:'',i2a:0, paid:3820, st:'จ่ายแล้ว' },
    { m:'1/2026', r:'RC1',  es:1500,ee:1585,eu:85, ea:425,  ws:700, we:728,wu:28, wa:280,  rent:5000,fur:1000,prev:0,   fine:0,i1n:'ค่าทำความสะอาด',i1a:300,i2n:'',i2a:0, paid:7005, st:'จ่ายแล้ว' },
    // ---- 2/2026 ----
    { m:'2/2026', r:'C101', es:1042,ee:1085,eu:43, ea:215,  ws:517, we:530,wu:13, wa:130,  rent:3000,fur:0,   prev:0,   fine:0,i1n:'',           i1a:0,  i2n:'',i2a:0, paid:3345, st:'จ่ายแล้ว' },
    { m:'2/2026', r:'C201', es:862, ee:927, eu:65, ea:325,  ws:317, we:334,wu:17, wa:170,  rent:4000,fur:200, prev:0,   fine:0,i1n:'',           i1a:0,  i2n:'',i2a:0, paid:4695, st:'จ่ายแล้ว' },
    { m:'2/2026', r:'R15',  es:555, ee:615, eu:60, ea:300,  ws:217, we:234,wu:17, wa:170,  rent:3500,fur:0,   prev:0,   fine:0,i1n:'',           i1a:0,  i2n:'',i2a:0, paid:3970, st:'จ่ายแล้ว' },
    { m:'2/2026', r:'R16',  es:338, ee:377, eu:39, ea:195,  ws:163, we:176,wu:13, wa:130,  rent:3000,fur:500, prev:0,   fine:0,i1n:'',           i1a:0,  i2n:'',i2a:0, paid:3825, st:'จ่ายแล้ว' },
    { m:'2/2026', r:'RC1',  es:1585,ee:1673,eu:88, ea:440,  ws:728, we:756,wu:28, wa:280,  rent:5000,fur:1000,prev:0,   fine:0,i1n:'',           i1a:0,  i2n:'',i2a:0, paid:6720, st:'จ่ายแล้ว' },
    // ---- 3/2026 ----
    { m:'3/2026', r:'C101', es:1085,ee:1130,eu:45, ea:225,  ws:530, we:544,wu:14, wa:140,  rent:3000,fur:0,   prev:0,   fine:0,i1n:'',           i1a:0,  i2n:'',i2a:0, paid:3000, st:'ค้าง'     },
    { m:'3/2026', r:'C201', es:927, ee:992, eu:65, ea:325,  ws:334, we:352,wu:18, wa:180,  rent:4000,fur:200, prev:0,   fine:0,i1n:'ค่าซ่อมแอร์', i1a:500,i2n:'',i2a:0, paid:5205, st:'จ่ายแล้ว' },
    { m:'3/2026', r:'R15',  es:615, ee:673, eu:58, ea:290,  ws:234, we:251,wu:17, wa:170,  rent:3500,fur:0,   prev:0,   fine:0,i1n:'',           i1a:0,  i2n:'',i2a:0, paid:3960, st:'จ่ายแล้ว' },
    { m:'3/2026', r:'R16',  es:377, ee:415, eu:38, ea:190,  ws:176, we:189,wu:13, wa:130,  rent:3000,fur:500, prev:0,   fine:0,i1n:'',           i1a:0,  i2n:'',i2a:0, paid:3820, st:'จ่ายแล้ว' },
    { m:'3/2026', r:'RC1',  es:1673,ee:1763,eu:90, ea:450,  ws:756, we:786,wu:30, wa:300,  rent:5000,fur:1000,prev:0,   fine:0,i1n:'',           i1a:0,  i2n:'',i2a:0, paid:6750, st:'จ่ายแล้ว' },
    // ---- 4/2026 — C101 มีค้างเดือนก่อน=365 (3365-3000) ----
    { m:'4/2026', r:'C101', es:1130,ee:1175,eu:45, ea:225,  ws:544, we:559,wu:15, wa:150,  rent:3000,fur:0,   prev:365, fine:0,i1n:'',           i1a:0,  i2n:'',i2a:0, paid:3740, st:'จ่ายแล้ว' },
    { m:'4/2026', r:'C201', es:992, ee:1059,eu:67, ea:335,  ws:352, we:370,wu:18, wa:180,  rent:4000,fur:200, prev:0,   fine:0,i1n:'',           i1a:0,  i2n:'',i2a:0, paid:4715, st:'จ่ายแล้ว' },
    { m:'4/2026', r:'R15',  es:673, ee:733, eu:60, ea:300,  ws:251, we:268,wu:17, wa:170,  rent:3500,fur:0,   prev:0,   fine:0,i1n:'',           i1a:0,  i2n:'',i2a:0, paid:3970, st:'จ่ายแล้ว' },
    { m:'4/2026', r:'R16',  es:415, ee:456, eu:41, ea:205,  ws:189, we:203,wu:14, wa:140,  rent:3000,fur:500, prev:0,   fine:0,i1n:'',           i1a:0,  i2n:'',i2a:0, paid:3845, st:'จ่ายแล้ว' },
    { m:'4/2026', r:'RC1',  es:1763,ee:1853,eu:90, ea:450,  ws:786, we:817,wu:31, wa:310,  rent:5000,fur:1000,prev:0,   fine:0,i1n:'',           i1a:0,  i2n:'',i2a:0, paid:6760, st:'จ่ายแล้ว' },
    // ---- 5/2026 — C101 paid ไม่ครบ(ค้าง400), R15 ไม่ได้จ่าย(ค้าง3980) ----
    { m:'5/2026', r:'C101', es:1175,ee:1225,eu:50, ea:250,  ws:559, we:574,wu:15, wa:150,  rent:3000,fur:0,   prev:0,   fine:0,i1n:'',           i1a:0,  i2n:'',i2a:0, paid:3000, st:'ค้าง'     },
    { m:'5/2026', r:'C201', es:1059,ee:1129,eu:70, ea:350,  ws:370, we:390,wu:20, wa:200,  rent:4000,fur:200, prev:0,   fine:0,i1n:'',           i1a:0,  i2n:'',i2a:0, paid:4750, st:'จ่ายแล้ว' },
    { m:'5/2026', r:'R15',  es:733, ee:793, eu:60, ea:300,  ws:268, we:286,wu:18, wa:180,  rent:3500,fur:0,   prev:0,   fine:0,i1n:'',           i1a:0,  i2n:'',i2a:0, paid:0,    st:'ค้าง'     },
    { m:'5/2026', r:'R16',  es:456, ee:496, eu:40, ea:200,  ws:203, we:218,wu:15, wa:150,  rent:3000,fur:500, prev:0,   fine:0,i1n:'',           i1a:0,  i2n:'',i2a:0, paid:3850, st:'จ่ายแล้ว' },
    { m:'5/2026', r:'RC1',  es:1853,ee:1945,eu:92, ea:460,  ws:817, we:848,wu:31, wa:310,  rent:5000,fur:1000,prev:0,   fine:0,i1n:'',           i1a:0,  i2n:'',i2a:0, paid:6770, st:'จ่ายแล้ว' },
    // ---- 6/2026 — C201 จดแล้ว (ค้างเดือนก่อน=0 เพราะ 5/2026 จ่ายหมด) ----
    { m:'6/2026', r:'C201', es:1129,ee:1199,eu:70, ea:350,  ws:390, we:408,wu:18, wa:180,  rent:4000,fur:200, prev:0,   fine:0,i1n:'ค่าอินเตอร์เน็ต',i1a:200,i2n:'',i2a:0, paid:0, st:'ค้าง' }
  ];

  var now = new Date();
  allRecords.forEach(function(rec) {
    // ตรวจซ้ำก่อน insert
    var data = recordSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var mv = data[i][0] instanceof Date
        ? Utilities.formatDate(data[i][0], 'Asia/Bangkok', 'M/yyyy')
        : String(data[i][0]);
      if (mv === rec.m && data[i][1] === rec.r) {
        Logger.log('ข้าม (มีอยู่แล้ว): ' + rec.r + ' ' + rec.m);
        return;
      }
    }
    recordSheet.appendRow([
      rec.m, rec.r,
      rec.es, rec.ee, rec.eu, rec.ea,
      rec.ws, rec.we, rec.wu, rec.wa,
      rec.rent, rec.fur,
      rec.prev, rec.fine,
      rec.i1n, rec.i1a, rec.i2n, rec.i2a,
      '',          // col 19: รวม — formula set below
      rec.paid, rec.st, now
    ]);
    var r = recordSheet.getLastRow();
    recordSheet.getRange(r, 1).setNumberFormat('@').setValue(rec.m);
    recordSheet.getRange(r, 19).setFormula(
      '=F'+r+'+J'+r+'+K'+r+'+L'+r+'+M'+r+'+N'+r+'+P'+r+'+R'+r
    );
  });

  SpreadsheetApp.flush();
  Logger.log('seedTestData() สำเร็จ — ' + allRecords.length + ' records (1–6/2026)');
}

// ลบข้อมูลทดสอบออก (รันก่อนส่งมอบงานจริง)
function clearTestData() {
  var ss            = SpreadsheetApp.getActiveSpreadsheet();
  var settingsSheet = ss.getSheetByName('ตั้งค่า');
  var recordSheet   = ss.getSheetByName('บันทึก');

  var testRoomIds = ['C101', 'C201', 'C202', 'R15', 'R16', 'RC1'];
  var testMonths  = ['1/2026','2/2026','3/2026','4/2026','5/2026','6/2026'];

  // ล้างชื่อผู้เช่า/ค่าเช่า/มิเตอร์เริ่มต้นของห้องทดสอบ
  var settingsData = settingsSheet.getRange('A6:F51').getValues();
  settingsData.forEach(function(row, i) {
    if (testRoomIds.indexOf(row[0]) === -1) return;
    settingsSheet.getRange(i + 6, 2, 1, 5).setValues([['', 0, 0, 0, 0]]);
  });

  // ลบ rows ใน "บันทึก" ของห้องทดสอบ (วนจากล่างขึ้นบน)
  var data = recordSheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    var mv = data[i][0] instanceof Date
      ? Utilities.formatDate(data[i][0], 'Asia/Bangkok', 'M/yyyy')
      : String(data[i][0]);
    if (testMonths.indexOf(mv) !== -1 && testRoomIds.indexOf(data[i][1]) !== -1) {
      recordSheet.deleteRow(i + 1);
    }
  }

  SpreadsheetApp.flush();
  Logger.log('clearTestData() สำเร็จ — ข้อมูลทดสอบถูกลบแล้ว');
}

// ------------------------------------------------------------------ //

function _getRoomList() {
  return [
    // ตึก C (ชยางกูร) — 19 ห้อง
    'C101',
    'C201', 'C202', 'C203', 'C204', 'C205', 'C206', 'C207', 'C208', 'C209',
    'C301', 'C302', 'C303', 'C304', 'C305', 'C306', 'C307', 'C308', 'C309',
    // ตึก R (Runway) — 27 ห้อง
    'R15', 'R16', 'R17', 'R18', 'R19', 'R20A',
    'R21', 'R22', 'R23', 'R24', 'R25', 'R26', 'R27', 'R28', 'R29',
    'R30A', 'R31', 'R32', 'R33', 'R34', 'R35', 'R36', 'R37', 'R39',
    'RC1', 'RC2', 'RC3', 'RC4'
  ];
}
