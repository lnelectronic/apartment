// รัน function นี้ครั้งเดียวหลัง clasp push เพื่อสร้าง Sheets และข้อมูลเริ่มต้น
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // ล้าง named ranges ทั้งหมดก่อน (ป้องกัน conflict จากการรันซ้ำที่ fail กลางคัน)
  ss.getNamedRanges().forEach(function(nr) { nr.remove(); });
  SpreadsheetApp.flush();

  // สร้าง sheets ที่ต้องการก่อน แล้วค่อยลบ default sheets
  var settingsSheet = ss.getSheetByName('ตั้งค่า') || ss.insertSheet('ตั้งค่า');
  var recordSheet   = ss.getSheetByName('บันทึก')  || ss.insertSheet('บันทึก');

  // ลบ sheets อื่นที่ Google สร้าง default ไว้
  ss.getSheets().forEach(function(sheet) {
    var name = sheet.getName();
    if (name !== 'ตั้งค่า' && name !== 'บันทึก') {
      ss.deleteSheet(sheet);
    }
  });

  _setupSettingsSheet(settingsSheet, ss);
  _setupRecordSheet(recordSheet);

  SpreadsheetApp.flush();
  Logger.log('Setup สำเร็จ! ห้องทั้งหมด ' + _getRoomList().length + ' ห้อง พร้อมใช้งาน');
}

// ------------------------------------------------------------------ //

function _setupSettingsSheet(sheet, ss) {
  sheet.clearContents();
  sheet.clearFormats();

  // ส่วนที่ 1: ราคาสาธารณูปโภค (row 1-3)
  var rateHeaders = [['ตึก', 'ราคาน้ำต่อหน่วย (บาท)', 'ราคาไฟต่อหน่วย (บาท)']];
  sheet.getRange('A1:C1').setValues(rateHeaders);
  sheet.getRange('A2:C3').setValues([
    ['C', 10, 5],
    ['R', 10, 5]
  ]);

  // row 4 ว่าง (spacer)

  // ส่วนที่ 2: รายชื่อห้อง (row 5 = header, row 6+ = data)
  sheet.getRange('A5:F5').setValues([[
    'เลขห้อง', 'ชื่อผู้เช่า', 'ค่าเช่า (บาท)', 'ค่าเฟอร์นิเจอร์ (บาท)',
    'ไฟ-เริ่มต้น (หน่วย)', 'น้ำ-เริ่มต้น (หน่วย)'
  ]]);

  var rooms = _getRoomList();
  var roomData = rooms.map(function(roomId, i) {
    var rent = (i % 2 === 0) ? 2000 : 5000; // ค่าทดสอบ — แอดมินแก้ได้
    return [roomId, '', rent, 0, 0, 0];
  });
  sheet.getRange(6, 1, roomData.length, 6).setValues(roomData);

  // Formatting
  var headerStyle = SpreadsheetApp.newTextStyle().setBold(true).build();
  sheet.getRange('A1:C1').setTextStyle(headerStyle).setBackground('#4a86e8').setFontColor('#ffffff');
  sheet.getRange('A5:F5').setTextStyle(headerStyle).setBackground('#6aa84f').setFontColor('#ffffff');
  sheet.getRange('A1:F1').setHorizontalAlignment('center');
  sheet.getRange('A5:F5').setHorizontalAlignment('center');
  sheet.setColumnWidth(1, 100);
  sheet.setColumnWidth(2, 180);
  sheet.setColumnWidth(3, 140);
  sheet.setColumnWidth(4, 160);
  sheet.setColumnWidth(5, 150);
  sheet.setColumnWidth(6, 150);
  sheet.setFrozenRows(0);

  // DataService.gs ใช้ hardcoded range แทน named range เพื่อความเรียบง่าย
}

function _setupRecordSheet(sheet) {
  sheet.clearContents();
  sheet.clearFormats();

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

function _getRoomList() {
  return [
    // ตึก C (ชยางกูร) — 19 ห้อง
    'C101',
    'C201', 'C202', 'C203', 'C204', 'C205', 'C206', 'C207', 'C208', 'C209',
    'C301', 'C302', 'C303', 'C304', 'C305', 'C306', 'C307', 'C308', 'C309',
    // ตึก R (Runway) — 27 ห้อง
    'R15', 'R16', 'R17', 'R18', 'R19', 'R20A',
    'R21', 'R22', 'R23', 'R24', 'R25', 'R26', 'R27', 'R28', 'R29',
    'R30A', 'R32', 'R33', 'R34', 'R35', 'R36', 'R37', 'R39',
    'RC1', 'RC2', 'RC3', 'RC4'
  ];
}
