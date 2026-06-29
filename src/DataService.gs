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

function _getTenantHistorySheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ประวัติผู้เช่า');
  if (!sheet) throw new Error('ไม่พบ Sheet "ประวัติผู้เช่า"');
  return sheet;
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
  var data = _getSettingsSheet().getRange('A2:D3').getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === building) {
      return { water: data[i][1], electricity: data[i][2], waterMin: data[i][3] };
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
    total:        d[18], paid:       d[19], status:      d[20],
    meterStatus:  d[22]  // col 23: สถานะมิเตอร์
  };
}

// data: { monthYear, roomId, elecStart?, elecEnd?, waterStart?, waterEnd?,
//         item1Name?, item1Amount?, item2Name?, item2Amount? }
// meterType: 'elec' | 'water' | 'both' (default: 'both')
// ไม่แตะ col 14 (ค่าปรับ), col 20 (จ่ายจริง), col 21 (สถานะ)
// row ที่เป็น 'confirmed' แล้ว → throw error
function saveRecord(data, meterType) {
  if (!meterType) meterType = 'both';

  var room  = getRoom(data.roomId);
  var rates = getRates(data.roomId[0]);
  if (!room || !rates) throw new Error('ไม่พบข้อมูลห้อง: ' + data.roomId);

  var elecUsed = 0, elecAmount = 0;
  if (meterType === 'elec' || meterType === 'both') {
    elecUsed   = (data.elecEnd || 0) - (data.elecStart || 0);
    elecAmount = elecUsed * rates.electricity;
  }

  var waterUsed = 0, waterAmount = 0;
  if (meterType === 'water' || meterType === 'both') {
    waterUsed   = (data.waterEnd || 0) - (data.waterStart || 0);
    waterAmount = waterUsed < 6 ? rates.waterMin : waterUsed * rates.water;
  }

  var item1Amount = data.item1Amount || 0;
  var item2Amount = data.item2Amount || 0;

  var prevMonth   = _getPrevMonth(data.monthYear);
  // คำนวณค้างเดือนก่อนเป็นตัวเลข — Sheets formula ทำให้เกิด circular ref กับ col S (total)
  var prevBalance = 0;
  var prevRow     = _findRecordRow(data.roomId, prevMonth);
  if (prevRow) {
    prevBalance = Math.max(0, (Number(prevRow.data[18]) || 0) - (Number(prevRow.data[19]) || 0));
  }

  var sheet    = _getRecordSheet();
  var existing = _findRecordRow(data.roomId, data.monthYear);
  var now      = new Date();

  if (existing) {
    var r             = existing.row;
    var currentStatus = existing.data[22]; // col 23: สถานะมิเตอร์ (0-indexed = 22)

    if (currentStatus === 'confirmed') {
      throw new Error('ห้อง ' + data.roomId + ' เดือน ' + data.monthYear + ' ถูก confirm แล้ว ไม่สามารถแก้ไขได้');
    }

    // update elec columns (3–6) เฉพาะเมื่อกรอกไฟ
    if (meterType === 'elec' || meterType === 'both') {
      sheet.getRange(r, 3, 1, 4).setValues([[
        data.elecStart || 0, data.elecEnd || 0, elecUsed, elecAmount
      ]]);
    }
    // update water columns (7–10) เฉพาะเมื่อกรอกน้ำ
    if (meterType === 'water' || meterType === 'both') {
      sheet.getRange(r, 7, 1, 4).setValues([[
        data.waterStart || 0, data.waterEnd || 0, waterUsed, waterAmount
      ]]);
    }
    // rent + furniture (cols 11–12) — ดึงจาก settings ล่าสุด
    sheet.getRange(r, 11, 1, 2).setValues([[room.rent, room.furniture]]);
    // col 13: ค้างเดือนก่อน
    sheet.getRange(r, 13).setValue(prevBalance);
    // cols 15–18: รายการอื่นๆ
    sheet.getRange(r, 15, 1, 4).setValues([[
      data.item1Name || '', item1Amount, data.item2Name || '', item2Amount
    ]]);
    // col 19: รวม formula
    sheet.getRange(r, 19).setFormula('=F'+r+'+J'+r+'+K'+r+'+L'+r+'+M'+r+'+N'+r+'+P'+r+'+R'+r);
    // cols 20–21 (จ่ายจริง, สถานะ): ไม่แตะ
    // col 22: timestamp
    sheet.getRange(r, 22).setValue(now);
    // col 23: สถานะมิเตอร์ — merge
    sheet.getRange(r, 23).setValue(_mergeMeterStatus(currentStatus, meterType));

  } else {
    sheet.appendRow([
      data.monthYear, data.roomId,
      data.elecStart || 0, data.elecEnd || 0, elecUsed, elecAmount,
      data.waterStart || 0, data.waterEnd || 0, waterUsed, waterAmount,
      room.rent, room.furniture,
      prevBalance,   // col 13: ค้างเดือนก่อน
      0,             // col 14: ค่าปรับ
      data.item1Name || '', item1Amount,
      data.item2Name || '', item2Amount,
      '',            // col 19: รวม — formula set ด้านล่าง
      0,             // col 20: จ่ายจริง
      'ค้าง',        // col 21: สถานะ
      now,           // col 22: วันที่จด
      _meterStatusForNew(meterType)  // col 23: สถานะมิเตอร์
    ]);
    var r = sheet.getLastRow();
    // appendRow ไม่ inherit column format และ auto-convert "6/2026" → Date serial
    // ต้อง setNumberFormat('@') ก่อน แล้ว setValue ทับเพื่อบังคับเก็บเป็น string
    sheet.getRange(r, 1).setNumberFormat('@').setValue(data.monthYear);
    sheet.getRange(r, 19).setFormula('=F'+r+'+J'+r+'+K'+r+'+L'+r+'+M'+r+'+N'+r+'+P'+r+'+R'+r);
  }

  SpreadsheetApp.flush();
}

function _meterStatusForNew(meterType) {
  if (meterType === 'elec')  return 'draft-elec';
  if (meterType === 'water') return 'draft-water';
  return 'draft';
}

function _mergeMeterStatus(currentStatus, meterType) {
  if (meterType === 'both') return 'draft';
  if (meterType === 'elec'  && currentStatus === 'draft-water') return 'draft';
  if (meterType === 'water' && currentStatus === 'draft-elec')  return 'draft';
  return currentStatus; // re-save ประเภทเดิม หรือ draft อยู่แล้ว → คงสถานะ
}

function getMonthMeterSummary(monthStr) {
  var allData = _getRecordSheet().getDataRange().getValues();
  var nameMap = {};
  _getSettingsSheet().getRange('A6:B51').getValues().forEach(function(r) {
    if (r[0]) nameMap[r[0]] = r[1];
  });

  var rooms = [], warnings = [], vacantAlerts = [];
  for (var i = 1; i < allData.length; i++) {
    var d = allData[i];
    if (_toMonthYear(d[0]) !== monthStr) continue;
    var roomId      = d[1];
    var tenantName  = nameMap[roomId] || '';
    var isEmpty     = !tenantName;
    var elecUsed    = Number(d[4])  || 0;
    var waterUsed   = Number(d[8])  || 0;
    var meterStatus = d[22]         || '';
    rooms.push({
      room: roomId, tenantName: tenantName, isEmpty: isEmpty,
      elecStart: d[2],  elecEnd:   d[3],  elecUsed:   elecUsed,
      waterStart: d[6], waterEnd:  d[7],  waterUsed:  waterUsed,
      meterStatus: meterStatus
    });
    if (meterStatus === 'draft-elec' || meterStatus === 'draft-water') warnings.push(roomId);
    if (isEmpty && (elecUsed > 0 || waterUsed > 0)) vacantAlerts.push(roomId);
  }
  return { rooms: rooms, warnings: warnings, vacantAlerts: vacantAlerts };
}

// เปลี่ยน status มิเตอร์ทุกห้องของเดือนนั้นจาก draft* → confirmed
function confirmMonth(monthStr) {
  var sheet    = _getRecordSheet();
  var data     = sheet.getDataRange().getValues();
  var draftSet = { 'draft': true, 'draft-elec': true, 'draft-water': true };
  var confirmed = 0;
  for (var i = 1; i < data.length; i++) {
    if (_toMonthYear(data[i][0]) !== monthStr) continue;
    if (draftSet[data[i][22]]) {
      sheet.getRange(i + 1, 23).setValue('confirmed');
      confirmed++;
    }
  }
  SpreadsheetApp.flush();
  return { confirmed: confirmed };
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

function getCheckOutInfo(roomId) {
  var data = _getSettingsSheet().getRange('A6:J51').getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] !== roomId) continue;
    var moveInDate = data[i][6] instanceof Date
      ? Utilities.formatDate(data[i][6], 'Asia/Bangkok', 'dd/MM/yyyy') : (data[i][6] || '');
    return {
      name:        data[i][1] || '',
      phone:       data[i][8] || '',
      moveInDate:  moveInDate,
      deposit:     data[i][7] || 0,
      outstanding: getOutstandingBalance(roomId).outstanding
    };
  }
  throw new Error('ไม่พบห้อง ' + roomId);
}

function checkOutRoom(roomId, deductions) {
  var sheet = _getSettingsSheet();
  var data  = sheet.getRange('A6:J51').getValues();
  var rowIndex = -1, name = '', moveInDate = '', deposit = 0, phone = '';
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] !== roomId) continue;
    rowIndex   = i + 6;
    name       = data[i][1];
    moveInDate = data[i][6];
    deposit    = data[i][7] || 0;
    phone      = data[i][8] || '';
    break;
  }
  if (rowIndex === -1) throw new Error('ไม่พบห้อง ' + roomId);

  var outstanding = getOutstandingBalance(roomId).outstanding;
  var d1 = (deductions && deductions.deduct1Amount) || 0;
  var d2 = (deductions && deductions.deduct2Amount) || 0;
  var refund = deposit - outstanding - d1 - d2;

  _getTenantHistorySheet().appendRow([
    roomId, name, phone,
    moveInDate, new Date(),
    deposit,
    (deductions && deductions.deduct1Name) || '', d1,
    (deductions && deductions.deduct2Name) || '', d2,
    outstanding, refund
  ]);

  // ล้างข้อมูลผู้เช่า (col J = note เก็บไว้)
  sheet.getRange(rowIndex, 2).setValue('');  // ชื่อ
  sheet.getRange(rowIndex, 3).setValue(0);   // ค่าเช่า
  sheet.getRange(rowIndex, 4).setValue(0);   // เฟอร์
  sheet.getRange(rowIndex, 7).setValue('');  // วันย้ายเข้า
  sheet.getRange(rowIndex, 8).setValue(0);   // มัดจำ
  sheet.getRange(rowIndex, 9).setValue('');  // เบอร์
  SpreadsheetApp.flush();
  return { success: true, refund: refund, outstanding: outstanding };
}

function getAllRoomsInfo() {
  var data = _getSettingsSheet().getRange('A6:J51').getValues();
  return data
    .filter(function(r) { return r[0] !== ''; })
    .map(function(r) {
      return {
        roomId:     r[0], name:      r[1], rent:      r[2], furniture: r[3],
        elecInit:   r[4], waterInit: r[5],
        moveInDate: r[6] instanceof Date
          ? Utilities.formatDate(r[6], 'Asia/Bangkok', 'dd/MM/yyyy') : (r[6] || ''),
        deposit:    r[7] || 0,
        phone:      r[8] || '',
        note:       r[9] || ''
      };
    });
}

function updateRoomInfo(roomId, info) {
  var sheet = _getSettingsSheet();
  var data  = sheet.getRange('A6:J51').getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] !== roomId) continue;
    var r = i + 6; // data row → sheet row (ข้อมูลเริ่ม row 6)
    if (info.name       !== undefined) sheet.getRange(r, 2).setValue(info.name);
    if (info.rent       !== undefined) sheet.getRange(r, 3).setValue(info.rent);
    if (info.furniture  !== undefined) sheet.getRange(r, 4).setValue(info.furniture);
    if (info.elecInit   !== undefined) sheet.getRange(r, 5).setValue(info.elecInit);
    if (info.waterInit  !== undefined) sheet.getRange(r, 6).setValue(info.waterInit);
    if (info.moveInDate !== undefined) sheet.getRange(r, 7).setValue(info.moveInDate);
    if (info.deposit    !== undefined) sheet.getRange(r, 8).setValue(info.deposit);
    if (info.phone      !== undefined) sheet.getRange(r, 9).setValue(info.phone);
    if (info.note       !== undefined) sheet.getRange(r, 10).setValue(info.note);
    SpreadsheetApp.flush();
    return;
  }
  throw new Error('ไม่พบห้อง ' + roomId + ' ใน ตั้งค่า');
}

function getAllRoomsWithPrevMeter(monthStr, meterType, building) {
  var settingsData = _getSettingsSheet().getRange('A6:F51').getValues();
  var allRecords   = _getRecordSheet().getDataRange().getValues();
  var prevMonth    = _getPrevMonth(monthStr);
  var rates        = getRates(building);

  var result = [];
  for (var i = 0; i < settingsData.length; i++) {
    var r = settingsData[i];
    if (!r[0] || String(r[0])[0] !== building) continue;

    var roomId     = r[0];
    var tenantName = r[1] || '';
    var elecInit   = r[4] || 0;
    var waterInit  = r[5] || 0;
    var prevMeter  = null;
    var existingEnd = null;

    for (var j = 1; j < allRecords.length; j++) {
      var d = allRecords[j];
      if (d[1] !== roomId) continue;
      var rowMonth = _toMonthYear(d[0]);
      if (rowMonth === prevMonth) {
        prevMeter = meterType === 'water' ? (d[7] || 0) : (d[3] || 0);
      }
      if (rowMonth === monthStr) {
        var status = d[22];
        var recorded = meterType === 'elec'
          ? (status === 'draft-elec' || status === 'draft' || status === 'confirmed')
          : (status === 'draft-water' || status === 'draft' || status === 'confirmed');
        if (recorded) existingEnd = meterType === 'water' ? d[7] : d[3];
      }
    }

    if (prevMeter === null) {
      prevMeter = meterType === 'water' ? waterInit : elecInit;
    }

    result.push({
      room:        roomId,
      tenantName:  tenantName,
      isEmpty:     !tenantName,
      prevMeter:   prevMeter,
      existingEnd: existingEnd
    });
  }

  return { rooms: result, rates: rates };
}

function saveBatchMeters(records, meterType) {
  for (var i = 0; i < records.length; i++) {
    var rec  = records[i];
    var data = { monthYear: rec.monthYear, roomId: rec.roomId };
    if (meterType === 'elec' || meterType === 'both') {
      data.elecStart = rec.prevMeter;
      data.elecEnd   = rec.endMeter;
    }
    if (meterType === 'water' || meterType === 'both') {
      data.waterStart = rec.prevMeter;
      data.waterEnd   = rec.endMeter;
    }
    saveRecord(data, meterType);
  }
  SpreadsheetApp.flush();
  return { saved: records.length };
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
