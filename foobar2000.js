/**
 *
 * foobar2000 adapter
 *
 *
 *  file io-package.json comments:
 *
 *  {
 *      "common": {
 *          "name":         "foobar2000",                  // name has to be set and has to be equal to adapters folder name and main file name excluding extension
 *          "version":      "0.0.0",                    // use "Semantic Versioning"! see http://semver.org/
 *          "title":        "Node.js foobar2000 Adapter",  // Adapter title shown in User Interfaces
 *          "authors":  [                               // Array of authord
 *              "name <mail@foobar2000.com>"
 *          ]
 *          "desc":         "foobar2000 adapter",          // Adapter description shown in User Interfaces. Can be a language object {de:"...",ru:"..."} or a string
 *          "platform":     "Javascript/Node.js",       // possible values "javascript", "javascript/Node.js" - more coming
 *          "mode":         "daemon",                   // possible values "daemon", "schedule", "subscribe"
 *          "schedule":     "0 0 * * *"                 // cron-style schedule. Only needed if mode=schedule
 *          "loglevel":     "info"                      // Adapters Log Level
 *      },
 *      "native": {                                     // the native object is available via adapter.config in your adapters code - use it for configuration
 *          "test1": true,
 *          "test2": 42
 *      }
 *  }
 *
 */

/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

// you have to require the utils module and call adapter function
var utils = require(__dirname + '/lib/utils');
var http   = require('http');
var exec = require('child_process').exec;
var fs = require('fs');

//var foobarPath = 'C:/Program Files (x86)/foobar2000/';
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

    // you can use the ack flag to detect if it is status (true) or command (false)
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
   /* adapter.log.info('config test1: ' + adapter.config.test1);
    adapter.log.info('config test1: ' + adapter.config.test2);*/

    /*launchFoobar();
    sendCommand('Start');*/

    /*adapter.setObject('testVariable', {
        type: 'state',
        common: {
            name: 'testVariable',
            type: 'boolean',
            role: 'indicator'
        },
        native: {}
    });*/

    // in this foobar2000 all states changes inside the adapters namespace are subscribed
    adapter.subscribeStates('*');

    // the variable testVariable is set to true as command (ack=false)
   /* adapter.setState('testVariable', true);

    // same thing, but the value is flagged "ack"
    // ack should be always set to true if the value is received from or acknowledged from the target system
    adapter.setState('testVariable', {val: true, ack: true});

    // same thing, but the state is deleted after 30s (getState will return null afterwards)
    adapter.setState('testVariable', {val: true, ack: true, expire: 30});*/

    // examples for the checkPassword/checkGroup functions
    /*adapter.checkPassword('admin', 'iobroker', function (res) {
        console.log('check user admin pw ioboker: ' + res);
    });

    adapter.checkGroup('admin', 'admin', function (res) {
        console.log('check group user admin group admin: ' + res);
    });*/
}
function sendCommand(command) {
    var data = 'cmd=' + command + '&param1=';
    //'/default/?cmd='+command+'&param1='
    //var parts = adapter.config.ip.split(':');
    var options = {
        host: adapter.config.ip,
        port: adapter.config.port,
        path: '/default/?' + data
    };
    adapter.log.debug('Send command "' + data + '" to ' /*+ adapter.config.ip*/);
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