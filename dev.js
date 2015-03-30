var nodemon = require('nodemon'),
  localtunnel = require('localtunnel'),
  pkg = require('./package.json');

var tunnel = localtunnel(pkg.development.port, function(err, tunnel) {
  if (err) {
    throw err;
  }

  console.log('Tunnel opened at ' + tunnel.url);

  nodemon({
    env: {
      LOCAL_BASE_URL: tunnel.url
    },
    ignore: ['.git', 'node_modules'],
    execMap: {
      'js': 'node --harmony'
    }
  });

  nodemon.on('restart', function(files) {
    console.log('App restarted due to: ', files);
  });
});
