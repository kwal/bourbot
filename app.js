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

var app = ack(pkg),
  redisUrl = app.config.REDIS_ENV && process.env[app.config.REDIS_ENV],
  store = redis(redisUrl, 'bourbot');

var addon = app.addon()
  .hipchat()
  .allowRoom(true)
  .scopes(['send_notification', 'view_group']);

function* setLocation(context, location) {
  location = (location || '').trim();

  var emoticon, color;
  if (!location) {
    location = pkg.settings.location;
    emoticon = yield context.tenantClient.getEmoticon('unknown');
    color = 'yellow';
  } else {
    emoticon = yield context.tenantClient.getEmoticon('successful');
    color = 'gray';
  }

  store.set(context.room.id + ':location', location);

  var message = util.format('You shall imbibe at %s <img src="%s">',
    location,
    emoticon.url
  );

  yield context.roomClient.sendNotification(message, {
    color: color,
    format: 'html'
  });
}

function* setDay(context, day) {
  day = (day || '').trim();

  var emoticon, color;
  if (!day || !(/^\d+$/g.test(day)) || day < 0 || day > 6) {
    day = pkg.settings.day;
    emoticon = yield context.tenantClient.getEmoticon('unknown');
    color = 'yellow';
  } else {
    emoticon = yield context.tenantClient.getEmoticon('successful');
    color = 'gray';
  }

  store.set(context.room.id + ':day', day);

  var target = moment().day(day);
  var message = util.format('You shall imbibe on %s <img src="%s">',
    target.format('dddd'),
    emoticon.url
  );

  yield context.roomClient.sendNotification(message, {
    color: color,
    format: 'html'
  });
}

function* setTime(context, time) {
  time = (time || '').trim();

  var emoticon, color;
  if (!time || !(/^\d+$/g.test(time)) || time < 0 || time > 23) {
    time = pkg.settings.time;
    emoticon = yield context.tenantClient.getEmoticon('unknown');
    color = 'yellow';
  } else {
    emoticon = yield context.tenantClient.getEmoticon('successful');
    color = 'gray';
  }

  store.set(context.room.id + ':time', time);

  var target = moment()
    .hour(time)
    .minute(0)
    .second(0);

  var message = util.format('You shall imbibe at %s <img src="%s">',
    target.format('LT z'),
    emoticon.url
  );

  yield context.roomClient.sendNotification(message, {
    color: color,
    format: 'html'
  });
}

function* setDuration(context, duration) {
  duration = (duration || '').trim();

  var emoticon, color;
  if (!duration || !(/^\d+$/g.test(duration)) || duration < 1 || duration > 24) {
    duration = pkg.settings.duration;
    emoticon = yield context.tenantClient.getEmoticon('unknown');
    color = 'yellow';
  } else {
    emoticon = yield context.tenantClient.getEmoticon('successful');
    color = 'gray';
  }

  store.set(context.room.id + ':duration', duration);

  var message = util.format('You shall imbibe for %s hours <img src="%s">',
    duration,
    emoticon.url
  );

  yield context.roomClient.sendNotification(message, {
    color: color,
    format: 'html'
  });
}

function* setTimezone(context, timezone) {
  timezone = (timezone || '').trim();

  var emoticon, color;
  if (!timezone || !moment.tz.zone(timezone)) {
    timezone = pkg.settings.timezone;
    emoticon = yield context.tenantClient.getEmoticon('unknown');
    color = 'yellow';
  } else {
    emoticon = yield context.tenantClient.getEmoticon('successful');
    color = 'gray';
  }

  store.set(context.room.id + ':timezone', timezone);

  var message = util.format('You shall imbibe relative to %s <img src="%s">',
    timezone,
    emoticon.url
  );

  yield context.roomClient.sendNotification(message, {
    color: color,
    format: 'html'
  });
}

function* imbibe(context) {
  var location = yield store.get(context.room.id + ':location');
  location || (location = pkg.settings.location);

  var day = yield store.get(context.room.id + ':day');
  day || (day = pkg.settings.day);

  var time = yield store.get(context.room.id + ':time');
  time || (time = pkg.settings.time);

  var duration = yield store.get(context.room.id + ':duration');
  duration || (duration = pkg.settings.duration);

  var timezone = yield store.get(context.room.id + ':timezone');
  timezone || (timezone = pkg.settings.timezone);

  var now = moment().tz(timezone);
  var start = moment(now)
    .day(day)
    .hour(time)
    .minute(0)
    .second(0);

  var end = moment(start).add(duration, 'hours');

  var emoticon, message;
  if (now.isBetween(start, end)) {
    emoticon = yield context.tenantClient.getEmoticon('disapproval');
    message = util.format('You should have started imbibing %s %s <img src="%s">',
      start.fromNow(),
      context.sender.name,
      emoticon.url
    );

    yield context.roomClient.sendNotification(message, {
      color: 'red',
      format: 'html'
    });
  } else {
    if (now.isAfter(end)) {
      start.add(1, 'weeks');
    }

    emoticon = yield context.tenantClient.getEmoticon('beer');
    message = util.format('You shall imbibe %s (%s) at %s <img src="%s">',
      start.fromNow(),
      start.format('dddd LT z'),
      location,
      emoticon.url
    );

    yield context.roomClient.sendNotification(message, {
      color: 'green',
      format: 'html'
    });
  }
}

addon.webhook('room_message', /^\/imbibe(?:\s+(:)?(.+?)(\s+(.+?))?\s*$)?/i, function*() {
  var command = this.match && this.match[1] === ':' && this.match[2];
  if (command) {
    if (command === 'location') {
      yield setLocation(this, this.match[3]);
    } else if (command === 'day') {
      yield setDay(this, this.match[3]);
    } else if (command === 'time') {
      yield setTime(this, this.match[3]);
    } else if (command === 'duration') {
      yield setDuration(this, this.match[3]);
    } else if (command === 'timezone') {
      yield setTimezone(this, this.match[3]);
    }
  } else if (!this.match[1]) {
    yield imbibe(this);
  }
});

app.listen();
