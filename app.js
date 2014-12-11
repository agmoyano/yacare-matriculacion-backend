var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var debug = require('debug')('expressapp');
var fs = require('fs');

var config = JSON.parse(fs.readFileSync('/etc/nodejs-config/form-yacare-backend.json'));


var api = require('./routes/api')(config);




var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// app.use(favicon(__dirname + '/public/img/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({
  extended: true,
  limit: '50mb'
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'frontend', 'app')));
app.use('/bower_components', express.static(path.join(__dirname, 'frontend', 'bower_components')));
app.use('/photos', express.static(path.join(__dirname, 'photos')));
app.use(session({secret: 'uxoo6Ke7', resave: true, saveUninitialized: true}));

/*app.use('/', routes);
app.use('/users', users);*/

app.use('/api', api);

/// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err,
            title: 'error'
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {},
        title: 'error'
    });
});

var server = app.listen(config.port, function() {
  debug('Express server listening on port ' + config.port);
});
//module.exports = app;
