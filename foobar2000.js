
/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

// you have to require the utils module and call adapter function
var http   = require('http');

var foobarPath = 'C:/Program Files (x86)/foobar2000/';
/**if (fs.readdirSync(foobarPath).indexOf('foobar2000.exe') === -1) {
    throw adapter.log.info('Foobar2000.exe was not found');
}**/

var Commands = {
    'play': 'Start',
    'stop': 'Stop'
};

var adapter = utils.adapter('foobar2000');

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        adapter.log.info('cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});

// is called if a subscribed object changes
adapter.on('objectChange', function (id, obj) {
    // Warning, obj can be null if it was deleted
    adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
});

// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
    // Warning, state can be null if it was deleted
    adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));

    if (state && !state.ack) {
        var param;
        if (state.val !== 'true' || state.val !== 'false'){
            param = state.val;
        } else {
            param = '';
        }
        var ids = id.split(".");
        if (ids[ids.length - 2].toString().toLowerCase() == 'start'){
            launchFoobar();
        } else {
            var cmd = Commands[ids[ids.length - 2].toString().toLowerCase()];
            sendCommand(cmd, param);
        }
    }
});

// Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
adapter.on('message', function (obj) {
    if (typeof obj == 'object' && obj.message) {
        if (obj.command == 'send') {
            // e.g. send email or pushover or whatever
            console.log('send command');

            // Send response in callback if required
            if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
        }
    }
});

// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    main();
});

function main() {
    adapter.setState('info.connection', false, true);
    //foobar.connect(onData, onError);
    // The adapters config (in the instance object everything under the attribute "native") is accessible via
    // adapter.config:

    /*launchFoobar();

    /*adapter.setObject('testVariable', {

    // in this foobar2000 all states changes inside the adapters namespace are subscribed
    adapter.subscribeStates('*');

    // the variable testVariable is set to true as command (ack=false)



    // examples for the checkPassword/checkGroup functions
    /*adapter.checkPassword('admin', 'iobroker', function (res) {

}
    var data = 'cmd=' + command + '&param1=';
    //'/default/?cmd='+command+'&param1='
    //var parts = adapter.config.ip.split(':');
    var options = {
        host: adapter.config.ip,
        port: adapter.config.port,
        path: '/default/?' + data
    };
    // Set up the request
    http.get(options, function (res) {
        var jsondata = '';
        res.setEncoding('utf8');
        res.on('error', function (e) {
            adapter.log.warn(e.toString());
        });
        res.on('data', function (chunk) {
            jsondata += chunk;
        });
        res.on('end', function () {
            adapter.setState('info.connection', false, true);
            adapter.log.debug('Response "' + jsondata + '"');

        });
    }).on('error', function (e) {
        adapter.log.warn('Got error by post request ' + e.toString());
    });
}

function sendShellCommand(command) {
    exec('foobar2000.exe /' + command, { cwd: foobarPath });
}

function launchFoobar() {
    exec('foobar2000.exe', { cwd: foobarPath });
}
/**
 * Stop
 * PlayOrPause
 * Start
 * StartPrevious
 * StartNext
 * StartRandom
 * ?cmd=Volume&param1=100
 * ?cmd=Seek&param1=97
 *
 *
 *
 * Browse
 *
 *
 */