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
