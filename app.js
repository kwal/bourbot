var ack = require('ac-koa'),
  hipchat = ack.require('hipchat'),
  redis = require('ac-node').RedisStore,
  moment = require('moment-timezone'),
  pkg = require('./package.json');

if (process.env.NODE_ENV === 'development') {
  pkg.name = 'bourbot-dev';
  pkg.displayName = 'Bourbot (Dev)';
}

moment.tz.setDefault(pkg.settings.timezone);

var app = ack(pkg),
  redisUrl = app.config.REDIS_ENV && process.env[app.config.REDIS_ENV],
  store = redis(redisUrl, 'bourbot'),
  addon = app.addon()
    .hipchat()
    .allowRoom(true)
    .scopes('send_notification');

function* imbibe(roomClient, room) {
  var location = yield store.get(room.id + ':location');
  var time = yield store.get(room.id + ':time') || pkg.settings.time;
  var now = moment();
  var target = moment()
    .hour(time)
    .minute(0)
    .second(0);

  if (now.isAfter(target)) {
    target.add(1, 'd');
  }

  yield roomClient.sendNotification('You shall imbibe in ' + target.from(now, true) + ' (' + target.format('LT z') + ') at ' + location);
}

function* imbibeWhen(roomClient, room, time) {
  if (!time) {
    time = pkg.settings.time;
  }

  store.set(room.id + ':time', time);

  var target = moment()
    .hour(time)
    .minute(0)
    .second(0);

  yield roomClient.sendNotification('You shall imbibe at ' + target.format('LT z'));
}

function* imbibeWhere(roomClient, room, location) {
  if (!location) {
    location = pkg.settings.location;
  }

  store.set(room.id + ':location', location);

  yield roomClient.sendNotification('You shall imbibe at ' + location);
}

addon.webhook('room_message', /^\/imbibe(?:\s+(:)?(.+?)(\s+(.+?))?\s*$)?/i, function*() {
  var command = this.match && this.match[1] === ':' && this.match[2];
  if (command) {
    if (command === 'where') {
      yield imbibeWhere(this.roomClient, this.room, this.match[3]);
    } else if (command === 'when') {
      yield imbibeWhen(this.roomClient, this.room, this.match[3]);
    }
  } else if (!this.match[1]) {
    yield imbibe(this.roomClient, this.room);
  }
});

app.listen();
