var ack = require('ac-koa'),
  hipchat = ack.require('hipchat'),
  moment = require('moment-timezone'),
  pkg = require('./package.json'),
  app = ack(pkg);

moment.tz.setDefault(pkg.settings.timezone);

var addon = app.addon()
  .hipchat()
  .allowRoom(true)
  .scopes('send_notification');

addon.webhook('room_message', /^\/till$/, function*() {
  var now = moment();
  var target = moment()
    .hour(pkg.settings.time)
    .minute(0)
    .second(0);

  if (now.isAfter(target)) {
    target.add(1, 'd');
  }

  yield this.roomClient.sendNotification('You shall imbibe in ' + target.from(now, true));
});

app.listen();
