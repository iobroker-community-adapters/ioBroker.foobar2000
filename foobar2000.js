/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

var utils  = require(__dirname + '/lib/utils');
var http   = require('http');
var exec   = require('child_process').exec;
var fs     = require('fs');
var adapter = utils.adapter('foobar2000');
var foobarPath = null;
var timer;
var objState ={};

/*if (fs.readdirSync(foobarPath).indexOf('foobar2000.exe') === -1) {
    throw adapter.log.error('Foobar2000.exe was not found');
}*/

var Commands = {
    'play': 'Start',
    'stop': 'Stop',
    'next': 'StartNext',
    'pause': 'PlayOrPause',
    'prev': 'StartPrevious',
    'random': 'StartRandom',
    'seek': 'Seek',
    'volume': 'Volume',
    'sac': 'SAC',
    'saq': 'SAQ',
    'emptyplaylist': 'EmptyPlaylist',
    'switchplaylist': 'SwitchPlaylist',
    'search': 'SearchMediaLibrary',
    'browser': 'Browse'
};

/**
 * cmd=PlaybackOrder&param1=0 //default
 * cmd=PlaybackOrder&param1=3 //random
 * cmd=PlaybackOrder&param1=1 //repeat playlist
 * cmd=PlaybackOrder&param1=2 //repeat track
 * cmd=PlaybackOrder&param1=4 //shuffle tracks
 * cmd=PlaybackOrder&param1=5 // shuffle album
 * cmd=PlaybackOrder&param1=6 //shuffle folders
 */

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
    adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));
    if (state && !state.ack) {
        var param;
        if (state.val !== 'true' && state.val !== 'false'){
            param = state.val;
        } else {
            param = '';
        }
        var ids = id.split(".");
        var idst = ids[ids.length - 1].toString().toLowerCase();
        if (idst === 'start' || idst === 'exit'){
            launch(idst);
        } else {
            if (idst === 'search'){
                param = encodeURIComponent(param);
            }
            if (idst === 'browser'){
                browser(Commands[idst], encodeURIComponent(param));
            } else {
                var cmd = Commands[idst];
                sendCommand(cmd, param);
            }
        }
    }
});

// Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
/*adapter.on('message', function (obj) {
    if (typeof obj == 'object' && obj.message) {
        if (obj.command == 'send') {
            console.log('send command');
            if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
        }
    }
});*/

function launch(cmd){
    adapter.log.debug('launch ' + JSON.stringify(cmd));
    if (adapter.config.remote !== 'on'){
        launchFoobar();
    } else if (adapter.config.cmdstart){
        var parts = adapter.config.path.split(':');
        var options = {
            host: parts[0],
            port: parts[1],
            path: ''
        };
        if (cmd === 'start'){
            options.path = '/?cmd=' + adapter.config.cmdstart;
        } else {
            options.path = '/?cmd=' + adapter.config.cmdexit;
        }
        adapter.log.info('launch ' + JSON.stringify(options));
        httpGet('', options, function(data){
            adapter.log.info('Start foobar2000');
        });
    } else {
        adapter.log.warn('foobar2000 can not be started');
    }
}
adapter.on('ready', function () {
    main();
});

function main() {
    adapter.setState('info.connection', false, true);
    GetState();
    if (adapter.config.path){
        foobarPath = adapter.config.path;
    }
    adapter.subscribeStates('*');
}
function sendCommand(command, param) {
    var data = 'cmd=' + command + '&param1=' + param;
    var options = {
        host: adapter.config.ip,
        port: adapter.config.port,
        path: '/default/?' + data
    };
    adapter.log.info('Send command "' + JSON.stringify(data) + '" to ' + options.host);
    httpGet('', options, function(data){
    });
}

function sendShellCommand(command) {
    exec('foobar2000.exe /' + command, { cwd: foobarPath });
}

function launchFoobar() {
    exec('foobar2000.exe', { cwd: foobarPath });
}

function GetState(e){
    clearTimeout(timer);
    httpGet('&param3=info.json', null, function(data){
        if (data){
            var key;
            for (key in data) {
                if (objState[key] !== data[key]){
                    objState[key] = data[key];
                    _SetState(key);
                }
            }
            //adapter.setState('info.connection', true, true);
            adapter.log.debug('Response info "' + JSON.stringify(objState) + '"');
            timer = setTimeout(function (){
                GetState();
            }, 2000);
        }
    });
}

function httpGet(data, option, callback){
    clearTimeout(timer);
    var options;
    if (option){
        options = {
            host: option.host,
            port: option.port,
            path: option.path
        };
    } else {
        options = {
            host: adapter.config.ip,
            port: adapter.config.port,
            path: '/foobar2000controller/?' + data
        };
    }
    if (adapter.config.login && adapter.config.password){
        options.headers = {'Authorization': 'Basic ' + new Buffer(adapter.config.login+':'+adapter.config.password).toString('base64')};
    }
    adapter.log.debug('foobar2000 httpGet("' + data + ' - ' +JSON.stringify(options)+'")');
    http.get(options, function (res) {
        var jsondata = '';
        res.setEncoding('utf8');
        res.on('error', function (e) {
            adapter.log.warn(e.toString());
        });
        res.on('data', function (chunk) {
            jsondata += chunk;
        });
        res.on('end', function (){
            if (res.statusCode === 200){
                adapter.getState(adapter.namespace + '.info.connection', function (err, state){
                    if (!state.val){
                        adapter.setState('info.connection', true, true);
                    }
                });
                try {
                    jsondata = JSON.parse(jsondata);
                    if (!jsondata){
                        throw new SyntaxError("JSON data error");
                    }
                    else {
                        callback(jsondata);
                    }
                } catch (err) {
                    //adapter.log.debug('JSON.Parse data error ' + err.toString());
                    jsondata = null;
                    timer = setTimeout(function (){
                        GetState();
                    }, 10000);
                }
            } else {
                adapter.log.debug('STATUS: ' + res.statusCode);
                if (res.statusCode == 401){
                    adapter.log.error('Foobar2000 Connection Authorization Error has ocurred. Check login or pass!');
                    adapter.stop();
                }
                adapter.setState('info.connection', false, true);
                jsondata = null;
                res.destroy();
            }
        });
    }).on('error', function (e) {
        adapter.log.warn('Got error by post request ' + e.toString());
        adapter.setState('info.connection', false, true);
        adapter.log.info('Reconnect to 10 sec...');
        timer = setTimeout(function (){
            GetState();
        }, 10000);
    });
}
function GetPlaylist(){
    httpGet('&param3=playlist.json', null, function(data){
        if (data.playlist){
            //adapter.log.error('GetPlaylist "' + JSON.stringify(data.playlist) + '"');
            adapter.setState('playlist', JSON.stringify(data.playlist.js), true);
            adapter.setState('playlists', JSON.stringify(data.playlists.js), true);
        }
    });
}
function _SetState(key){
    if (key ==='trackLength' || key ==='page'){
        GetPlaylist();
    }
    adapter.setState(key, objState[key], true);
    if (key ==='isPlaying' || key ==='isPaused'){
        IsPlaying(objState.isPlaying, objState.isPaused);
    }
}
function IsPlaying(play ,pause){
    if (play === '1'){
        adapter.setState('play', true, true);
        adapter.setState('pause', false, true);
        adapter.setState('stop', false, true);
    } else {
        if (pause === '1'){
            adapter.setState('play', false, true);
            adapter.setState('stop', false, true);
            adapter.setState('pause', true, true);
        } else {
            adapter.setState('stop', true, true);
            adapter.setState('pause', false, true);
            adapter.setState('play', false, true);
        }
    }
}
function browser(cmd, param){
    var data = 'cmd=' + cmd + '&param1=' + param + '&' + 'param3=browser.json';
    httpGet(data, null, function(data){
        adapter.setState('browser', JSON.stringify(data), true);
    });
}