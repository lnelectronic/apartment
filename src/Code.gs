// Code.gs — doGet routing + client-callable entry points

function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) || 'staff';
  var file = (page === 'admin') ? 'admin' : (page === 'meter') ? 'meter' : 'staff';
  var tmpl = HtmlService.createTemplateFromFile(file);
  tmpl.appUrl = ScriptApp.getService().getUrl();
  return tmpl.evaluate()
    .setTitle('App-Room')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// เรียกจาก admin.html: google.script.run.checkPassword(pw)
// Script Properties: OWNER_PASSWORD (ใหม่) หรือ ADMIN_PASSWORD (fallback เดิม)
function checkPassword(pw) {
  var props = PropertiesService.getScriptProperties();
  var ownerPw = props.getProperty('OWNER_PASSWORD') || props.getProperty('ADMIN_PASSWORD');
  return pw === ownerPw;
}

// เรียกจาก staff.html: google.script.run.checkStaffPassword(pw)
// Script Properties: STAFF_PASSWORD
function checkStaffPassword(pw) {
  var props = PropertiesService.getScriptProperties();
  return pw === props.getProperty('STAFF_PASSWORD');
}

// เรียกจาก meter.html: ตรวจสอบห้องและดึงมิเตอร์เริ่มต้น ไม่ส่งข้อมูลการเงิน
function getRoomForMeter(roomId, monthYear) {
  var room = getRoom(roomId);
  if (!room) return { found: false };
  if (!room.name) return { found: true, vacant: true };

  var existing = getRecordThisMonth(roomId, monthYear);
  if (existing) return { found: true, blocked: true };

  var prevMeter = getPrevMeter(roomId, monthYear);

  var prevBalance = 0;
  var prevRecord  = _findRecordRow(roomId, _getPrevMonth(monthYear));
  if (prevRecord) {
    prevBalance = (prevRecord.data[18] || 0) - (prevRecord.data[19] || 0);
  }

  return {
    found:      true,
    blocked:    false,
    name:       room.name,
    status:     prevBalance > 0 ? 'ค้างจ่าย' : 'ปกติ',
    elecStart:  prevMeter ? prevMeter.elecEnd  : 0,
    waterStart: prevMeter ? prevMeter.waterEnd : 0
  };
}

// เรียกจาก staff.html: ดึงข้อมูลทุกอย่างที่ต้องใช้ในครั้งเดียว
function getRoomForStaff(roomId, monthYear) {
  var room = getRoom(roomId);
  if (!room) return { found: false };
  if (!room.name) return { found: true, vacant: true };

  var rates      = getRates(roomId[0]) || { water: 0, electricity: 0 };
  var existing   = getRecordThisMonth(roomId, monthYear);
  var prevMeter  = getPrevMeter(roomId, monthYear);

  var prevBalance = 0;
  var prevRecord  = _findRecordRow(roomId, _getPrevMonth(monthYear));
  if (prevRecord) {
    prevBalance = (prevRecord.data[18] || 0) - (prevRecord.data[19] || 0);
  }

  return {
    found:       true,
    room:        room,
    rates:       rates,
    existing:    existing,
    prevMeter:   prevMeter,
    prevBalance: prevBalance
  };
}
