var util = require('util'),
  ack = require('ac-koa'),
  hipchat = ack.require('hipchat'),
  moment = require('moment-timezone'),
  pkg = require('./package.json');

if (process.env.NODE_ENV === 'development') {
  pkg.name = 'bourbot-dev';
  pkg.displayName = 'Bourbot (Dev)';
}

var app = ack(pkg);
var addon = app
  .addon()
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

  var match, em;
  var parsedLocation = location;
  var emoticonExp = /\(([^)]+)\)/g;
  while ((match = emoticonExp.exec(location)) !== null) {
    try {
      em = yield context.tenantClient.getEmoticon(match[1]);
    } catch (e) {} finally {
      if (em) {
        parsedLocation = parsedLocation.replace(
          match[0],
          util.format('<img src="%s">', em.url)
        );
      }

      em = null;
    }
  }

  context.tenantStore.set('location', parsedLocation);

  var message = util.format('You shall imbibe at %s <img src="%s">',
    parsedLocation,
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

  context.tenantStore.set('day', day);

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

  var timeRegex = /([0-1]{1}[0-9]{1}|20|21|22|23):[0-5]{1}[0-9]{1}/g,
    emoticon,
    color;

  if (!time || !timeRegex.test(time)) {
    time = pkg.settings.time;
    emoticon = yield context.tenantClient.getEmoticon('unknown');
    color = 'yellow';
  } else {
    emoticon = yield context.tenantClient.getEmoticon('successful');
    color = 'gray';
  }

  context.tenantStore.set('time', time);

  var target = moment(time, 'HH:mm');

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

  context.tenantStore.set('duration', duration);

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

  context.tenantStore.set('timezone', timezone);

  var message = util.format('You shall imbibe relative to %s <img src="%s">',
    timezone,
    emoticon.url
  );

  yield context.roomClient.sendNotification(message, {
    color: color,
    format: 'html'
  });
}

function* help(context) {
  var message = 'Command format: /imbibe <i>command</i> <i>value</i><br/><br/>' +
    'Available commands:<br/>' +
    '<b>location</b> - sets location<br/>' +
    '<b>day</b> - sets day of the week (0 - 6)<br/>' +
    '<b>time</b> - sets time of day (00:00 - 23:59)<br/>' +
    '<b>duration</b> - sets duration in hours (0 - 23)<br/>' +
    '<b>timezone</b> - sets <a href="https://en.wikipedia.org/wiki/List_of_tz_database_time_zones">timezone</a><br/><br/>' +
    'Example: /imbibe location My House';

  yield context.roomClient.sendNotification(message, {
    color: 'green',
    format: 'html'
  });
}

function* imbibe(context) {
  var location = yield context.tenantStore.get('location');
  location || (location = pkg.settings.location);

  var day = yield context.tenantStore.get('day');
  day || (day = pkg.settings.day);

  var time = yield context.tenantStore.get('time');
  time || (time = pkg.settings.time);

  var duration = yield context.tenantStore.get('duration');
  duration || (duration = pkg.settings.duration);

  var timezone = yield context.tenantStore.get('timezone');
  timezone || (timezone = pkg.settings.timezone);

  var now = moment().tz(timezone),
    start = moment.tz(time, 'HH:mm', timezone).day(day),
    end = moment(start).add(duration, 'hours');

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

addon.webhook('room_message', /^\/imbibe(?:\s+(.+?)(\s+(.+?))?\s*$)?/i, function*() {
  var command = this.match && this.match[1];
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
    } else if (command === 'help') {
      yield help(this);
    }
  } else if (!this.match[1]) {
    yield imbibe(this);
  }
});

app.listen();
