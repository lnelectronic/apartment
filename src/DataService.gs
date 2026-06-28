// DataService.gs — อ่าน/เขียน Sheets ทั้งหมด

// ------------------------------------------------------------------ //
// Private helpers
// ------------------------------------------------------------------ //

function _getSettingsSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ตั้งค่า');
}

function _getRecordSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName('บันทึก');
}

function _getPrevMonth(monthYear) {
  var parts = monthYear.split('/');
  var m = parseInt(parts[0]);
  var y = parseInt(parts[1]);
  if (m === 1) return '12/' + (y - 1);
  return (m - 1) + '/' + y;
}

function _getNextMonth(monthYear) {
  var parts = monthYear.split('/');
  var m = parseInt(parts[0]);
  var y = parseInt(parts[1]);
  if (m === 12) return '1/' + (y + 1);
  return (m + 1) + '/' + y;
}

function _toMonthYear(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'Asia/Bangkok', 'M/yyyy');
  }
  return String(val);
}

function _findRecordRow(roomId, monthYear) {
  var sheet = _getRecordSheet();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (_toMonthYear(data[i][0]) === monthYear && data[i][1] === roomId) {
      return { row: i + 1, data: data[i] };
    }
  }
  return null;
}

// ------------------------------------------------------------------ //
// Public API
// ------------------------------------------------------------------ //

function getRoom(roomId) {
  var data = _getSettingsSheet().getRange('A6:F51').getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === roomId) {
      return {
        roomId:    data[i][0],
        name:      data[i][1],
        rent:      data[i][2],
        furniture: data[i][3],
        elecInit:  data[i][4] || 0,
        waterInit: data[i][5] || 0
      };
    }
  }
  return null;
}

function getRates(building) {
  var data = _getSettingsSheet().getRange('A2:C3').getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === building) {
      return { water: data[i][1], electricity: data[i][2] };
    }
  }
  return null;
}

function getPrevMeter(roomId, monthYear) {
  var prevMonth = _getPrevMonth(monthYear);
  var found = _findRecordRow(roomId, prevMonth);
  if (found) {
    return {
      elecEnd:  found.data[3],  // col 4: ไฟ-ถึง
      waterEnd: found.data[7]   // col 8: น้ำ-ถึง
    };
  }
  // fallback: ใช้ค่าเริ่มต้นที่แอดมินกรอกไว้ใน "ตั้งค่า"
  var room = getRoom(roomId);
  if (room) {
    return { elecEnd: room.elecInit, waterEnd: room.waterInit };
  }
  return null;
}

function getRecordThisMonth(roomId, monthYear) {
  var found = _findRecordRow(roomId, monthYear);
  if (!found) return null;
  var d = found.data;
  return {
    row:          found.row,
    monthYear:    d[0],
    roomId:       d[1],
    elecStart:    d[2],  elecEnd:    d[3],  elecUsed:    d[4],  elecAmount:    d[5],
    waterStart:   d[6],  waterEnd:   d[7],  waterUsed:   d[8],  waterAmount:   d[9],
    rent:         d[10], furniture:  d[11], prevBalance: d[12], fine:          d[13],
    item1Name:    d[14], item1Amount:d[15], item2Name:   d[16], item2Amount:   d[17],
    total:        d[18], paid:       d[19], status:      d[20]
  };
}

// data: { monthYear, roomId, elecStart, elecEnd, waterStart, waterEnd,
//         item1Name?, item1Amount?, item2Name?, item2Amount? }
// เมื่อแก้ไขทับ: ไม่แตะ col 14 (ค่าปรับ), col 20 (จ่ายจริง), col 21 (สถานะ)
function saveRecord(data) {
  var room  = getRoom(data.roomId);
  var rates = getRates(data.roomId[0]);
  if (!room || !rates) throw new Error('ไม่พบข้อมูลห้อง: ' + data.roomId);

  var elecUsed    = data.elecEnd   - data.elecStart;
  var elecAmount  = elecUsed       * rates.electricity;
  var waterUsed   = data.waterEnd  - data.waterStart;
  var waterAmount = waterUsed      * rates.water;
  var item1Amount = data.item1Amount || 0;
  var item2Amount = data.item2Amount || 0;

  var prevMonth = _getPrevMonth(data.monthYear);
  // คำนวณค้างเดือนก่อนเป็นตัวเลข — Sheets formula ทำให้เกิด circular ref กับ col S (total)
  var prevBalance = 0;
  var prevRow = _findRecordRow(data.roomId, prevMonth);
  if (prevRow) {
    var prevTotal = Number(prevRow.data[18]) || 0;
    var prevPaid  = Number(prevRow.data[19]) || 0;
    prevBalance = Math.max(0, prevTotal - prevPaid);
  }

  var sheet    = _getRecordSheet();
  var existing = _findRecordRow(data.roomId, data.monthYear);

  var now = new Date();

  if (existing) {
    var r = existing.row;
    // cols 1-12: ข้อมูลที่คำนวณใหม่
    sheet.getRange(r, 1, 1, 12).setValues([[
      data.monthYear, data.roomId,
      data.elecStart, data.elecEnd, elecUsed, elecAmount,
      data.waterStart, data.waterEnd, waterUsed, waterAmount,
      room.rent, room.furniture
    ]]);
    // col 13: ค้างเดือนก่อน (static value — formula จะเกิด circular ref กับ col S)
    sheet.getRange(r, 13).setValue(prevBalance);
    // cols 15-18: รายการอื่นๆ
    sheet.getRange(r, 15, 1, 4).setValues([[
      data.item1Name || '', item1Amount, data.item2Name || '', item2Amount
    ]]);
    // col 19: รวม formula
    sheet.getRange(r, 19).setFormula('=F'+r+'+J'+r+'+K'+r+'+L'+r+'+M'+r+'+N'+r+'+P'+r+'+R'+r);
    // cols 20-21 (จ่ายจริง, สถานะ): ไม่แตะ
    // col 22: timestamp อัปเดตทุกครั้งที่แก้ไข
    sheet.getRange(r, 22).setValue(now);
  } else {
    sheet.appendRow([
      data.monthYear, data.roomId,
      data.elecStart, data.elecEnd, elecUsed, elecAmount,
      data.waterStart, data.waterEnd, waterUsed, waterAmount,
      room.rent, room.furniture,
      prevBalance, // col 13: ค้างเดือนก่อน
      0,           // col 14: ค่าปรับ
      data.item1Name || '', item1Amount,
      data.item2Name || '', item2Amount,
      '',          // col 19: รวม — formula set ด้านล่าง
      0,           // col 20: จ่ายจริง
      'ค้าง',      // col 21: สถานะ
      now          // col 22: วันที่จด
    ]);
    var r = sheet.getLastRow();
    // appendRow ไม่ inherit column format และ auto-convert "6/2026" → Date serial
    // ต้อง setNumberFormat('@') ก่อน แล้ว setValue ทับเพื่อบังคับเก็บเป็น string
    sheet.getRange(r, 1).setNumberFormat('@').setValue(data.monthYear);
    sheet.getRange(r, 19).setFormula('=F'+r+'+J'+r+'+K'+r+'+L'+r+'+M'+r+'+N'+r+'+P'+r+'+R'+r);
  }

  SpreadsheetApp.flush();
}

function updatePayment(roomId, monthYear, paidAmount) {
  var found = _findRecordRow(roomId, monthYear);
  if (!found) throw new Error('ไม่พบข้อมูลห้อง ' + roomId + ' เดือน ' + monthYear);
  var sheet  = _getRecordSheet();
  var r      = found.row;
  var total  = sheet.getRange(r, 19).getValue();
  var status = paidAmount >= total ? 'จ่ายแล้ว' : 'ค้าง';
  sheet.getRange(r, 20).setValue(paidAmount);
  sheet.getRange(r, 21).setValue(status);

  // อัปเดต prevBalance ของเดือนถัดไป (ถ้ามีข้อมูลอยู่แล้ว)
  var nextMonth = _getNextMonth(monthYear);
  var nextRow = _findRecordRow(roomId, nextMonth);
  if (nextRow) {
    var newPrevBalance = Math.max(0, (Number(total) || 0) - paidAmount);
    sheet.getRange(nextRow.row, 13).setValue(newPrevBalance);
  }

  SpreadsheetApp.flush();
}

function updateFine(roomId, monthYear, fineAmount) {
  var found = _findRecordRow(roomId, monthYear);
  if (!found) throw new Error('ไม่พบข้อมูลห้อง ' + roomId + ' เดือน ' + monthYear);
  _getRecordSheet().getRange(found.row, 14).setValue(fineAmount);
  SpreadsheetApp.flush();
}

function getDashboardData(monthYear) {
  var allData      = _getRecordSheet().getDataRange().getValues();
  var settingsData = _getSettingsSheet().getRange('A6:D51').getValues();

  var nameMap       = {};
  var totalRooms    = 0;
  var occupiedRooms = 0;
  settingsData.forEach(function(r) {
    if (!r[0]) return;
    totalRooms++;
    nameMap[r[0]] = r[1];
    if (r[1]) occupiedRooms++;
  });

  var rooms        = [];
  var totalAmount  = 0;
  var totalPaid    = 0;
  var totalPending = 0;

  for (var i = 1; i < allData.length; i++) {
    var d = allData[i];
    if (_toMonthYear(d[0]) !== monthYear) continue;
    var rec = {
      roomId:      d[1],
      name:        nameMap[d[1]] || '',
      elecStart:   d[2],  elecEnd:     d[3],  elecUsed:    d[4],  elecAmount:  d[5],
      waterStart:  d[6],  waterEnd:    d[7],  waterUsed:   d[8],  waterAmount: d[9],
      rent:        d[10], furniture:   d[11], prevBalance: d[12], fine:        d[13],
      item1Name:   d[14], item1Amount: d[15], item2Name:   d[16], item2Amount: d[17],
      total:       d[18], paid:        d[19], status:      d[20]
    };
    rooms.push(rec);
    totalAmount += rec.total  || 0;
    if (rec.status === 'จ่ายแล้ว') {
      totalPaid    += rec.paid  || 0;
    } else {
      totalPending += rec.total || 0;
    }
  }

  return {
    monthYear:     monthYear,
    totalRooms:    totalRooms,
    occupiedRooms: occupiedRooms,
    vacantRooms:   totalRooms - occupiedRooms,
    totalAmount:   totalAmount,
    totalPaid:     totalPaid,
    totalPending:  totalPending,
    rooms:         rooms
  };
}

function getMissingRooms(monthYear) {
  var allData  = _getRecordSheet().getDataRange().getValues();
  var recorded = {};
  for (var i = 1; i < allData.length; i++) {
    if (_toMonthYear(allData[i][0]) === monthYear) recorded[allData[i][1]] = true;
  }
  // เฉพาะห้องที่มีผู้เช่าอยู่ปัจจุบัน (ชื่อไม่ว่าง)
  var occupied = _getSettingsSheet().getRange('A6:B51').getValues()
    .filter(function(r) { return r[0] && r[1]; })
    .map(function(r) { return r[0]; });
  return occupied.filter(function(r) { return !recorded[r]; });
}

function getOutstandingBalance(roomId) {
  var allData = _getRecordSheet().getDataRange().getValues();
  var outstanding = 0;
  for (var i = 1; i < allData.length; i++) {
    if (allData[i][1] !== roomId) continue;
    if (allData[i][20] === 'จ่ายแล้ว') continue;
    outstanding += Math.max(0, (allData[i][18] || 0) - (allData[i][19] || 0));
  }
  return { outstanding: outstanding };
}

function checkOutRoom(roomId) {
  var sheet = _getSettingsSheet();
  var data  = sheet.getRange('A6:D51').getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] !== roomId) continue;
    var r = i + 6;
    sheet.getRange(r, 2).setValue('');
    sheet.getRange(r, 3).setValue(0);
    sheet.getRange(r, 4).setValue(0);
    SpreadsheetApp.flush();
    return { success: true };
  }
  throw new Error('ไม่พบห้อง ' + roomId);
}

function getAllRoomsInfo() {
  var data = _getSettingsSheet().getRange('A6:F51').getValues();
  return data
    .filter(function(r) { return r[0] !== ''; })
    .map(function(r) {
      return { roomId: r[0], name: r[1], rent: r[2], furniture: r[3], elecInit: r[4], waterInit: r[5] };
    });
}

function updateRoomInfo(roomId, info) {
  var sheet = _getSettingsSheet();
  var data  = sheet.getRange('A6:F51').getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] !== roomId) continue;
    var r = i + 6; // data row → sheet row (ข้อมูลเริ่ม row 6)
    if (info.name      !== undefined) sheet.getRange(r, 2).setValue(info.name);
    if (info.rent      !== undefined) sheet.getRange(r, 3).setValue(info.rent);
    if (info.furniture !== undefined) sheet.getRange(r, 4).setValue(info.furniture);
    if (info.elecInit  !== undefined) sheet.getRange(r, 5).setValue(info.elecInit);
    if (info.waterInit !== undefined) sheet.getRange(r, 6).setValue(info.waterInit);
    SpreadsheetApp.flush();
    return;
  }
  throw new Error('ไม่พบห้อง ' + roomId + ' ใน ตั้งค่า');
}

// รันจาก Apps Script editor เพื่อแปลง Column A ที่เป็น Date → string ทุก row
// ทำครั้งเดียวเพื่อแก้ข้อมูลเก่าที่บันทึกก่อน fix
function fixRecordSheetDates() {
  var sheet = _getRecordSheet();
  var data  = sheet.getDataRange().getValues();
  var fixed = 0;
  for (var i = 1; i < data.length; i++) {
    var cell = data[i][0];
    if (cell instanceof Date) {
      var str = Utilities.formatDate(cell, 'Asia/Bangkok', 'M/yyyy');
      sheet.getRange(i + 1, 1).setNumberFormat('@').setValue(str);
      fixed++;
      Logger.log('fixed row ' + (i + 1) + ': ' + cell + ' → ' + str);
    }
  }
  SpreadsheetApp.flush();
  Logger.log('Done. Fixed ' + fixed + ' rows.');
}

// รันจาก Apps Script editor เพื่อ diagnose ปัญหา duplicate row
function debugRecordSheet() {
  var sheet = _getRecordSheet();
  var data = sheet.getDataRange().getValues();
  Logger.log('Total rows (incl header): ' + data.length);
  for (var i = 0; i < Math.min(data.length, 6); i++) {
    var cell = data[i][0];
    Logger.log('row ' + (i+1) + ' | col-A type=' + typeof cell
      + ' isDate=' + (cell instanceof Date)
      + ' value=' + cell
      + ' | col-B=' + data[i][1]);
  }
}
