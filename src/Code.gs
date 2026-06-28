// Code.gs — doGet routing + client-callable entry points

function doGet(e) {
  var page     = (e && e.parameter && e.parameter.page) || 'staff';
  var template = HtmlService.createTemplateFromFile(page === 'admin' ? 'admin' : 'staff');
  return template.evaluate()
    .setTitle('App-Room')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// เรียกจาก admin.html: google.script.run.checkPassword(pw)
function checkPassword(pw) {
  var stored = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  return pw === stored;
}

// เรียกจาก staff.html: ดึงข้อมูลทุกอย่างที่ต้องใช้ในครั้งเดียว
function getRoomForStaff(roomId, monthYear) {
  var room = getRoom(roomId);
  if (!room) return { found: false };

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
