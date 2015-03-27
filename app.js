var ack = require('ac-koa').require('hipchat'),
  moment = require('moment'),
  pkg = require('./package.json'),
  app = ack(pkg);

var addon = app
  .addon()
  .hipchat()
  .allowRoom(true)
  .scopes('send_notification');

addon.webhook('room_message', /^\/till$/, function*() {
  var target = moment().zone('-06:00').hour(16).minute(0).second(0).utc(),
    now = moment.utc(),
    diff = target.diff(now);

  yield this.roomClient.sendNotification('You shall imbibe in ' + moment.duration(diff, "milliseconds").humanize());
});

app.listen();
