var util = require('util'),
  ack = require('ac-koa'),
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
  store = redis(redisUrl, 'bourbot');

var addon = app.addon()
  .hipchat()
  .allowRoom(true)
  .scopes(['send_notification', 'view_group']);

function* imbibe(context) {
  var location = yield store.get(context.room.id + ':location');
  location || (location = pkg.settings.location);

  var time = yield store.get(context.room.id + ':time');
  time || (time = pkg.settings.time);

  var target = moment()
    .day(pkg.settings.day)
    .hour(time)
    .minute(0)
    .second(0);

  var emoticon, message;
  if (target.isBefore(moment())) {
    emoticon = yield context.tenantClient.getEmoticon('disapproval');
    message = util.format('You should have been imbibing %s <img src="%s">',
      target.fromNow(),
      emoticon.url
    );

    yield context.roomClient.sendNotification(message, {
      color: 'red',
      format: 'html'
    });
  } else {
    emoticon = yield context.tenantClient.getEmoticon('beer');
    message = util.format('You shall imbibe in %s (%s) at %s <img src="%s">',
      target.fromNow(),
      target.format('dddd LT z'),
      location,
      emoticon.url
    );

    yield context.roomClient.sendNotification(message, {
      color: 'green',
      format: 'html'
    });
  }
}

function* imbibeWhen(context, time) {
  time = (time || '').trim();

  if (!time || !(/^\d+$/g.test(time)) || time < 0 || time > 23) {
    time = pkg.settings.time;
  }

  store.set(context.room.id + ':time', time);

  var target = moment()
    .hour(time)
    .minute(0)
    .second(0);

  var successfulEmoticon = yield context.tenantClient.getEmoticon('successful');
  var message = util.format('You shall imbibe at %s <img src="%s">',
    target.format('LT z'),
    successfulEmoticon.url
  );

  yield context.roomClient.sendNotification(message, {
    color: 'gray',
    format: 'html'
  });
}

function* imbibeWhere(context, location) {
  location = (location || '').trim();

  if (!location) {
    location = pkg.settings.location;
  }

  store.set(context.room.id + ':location', location);

  var successfulEmoticon = yield context.tenantClient.getEmoticon('successful');
  var message = util.format('You shall imbibe at %s <img src="%s">',
    location,
    successfulEmoticon.url
  );

  yield context.roomClient.sendNotification(message, {
    color: 'gray',
    format: 'html'
  });
}

addon.webhook('room_message', /^\/imbibe(?:\s+(:)?(.+?)(\s+(.+?))?\s*$)?/i, function*() {
  var command = this.match && this.match[1] === ':' && this.match[2];
  if (command) {
    if (command === 'where') {
      yield imbibeWhere(this, this.match[3]);
    } else if (command === 'when') {
      yield imbibeWhen(this, this.match[3]);
    }
  } else if (!this.match[1]) {
    yield imbibe(this);
  }
});

app.listen();
