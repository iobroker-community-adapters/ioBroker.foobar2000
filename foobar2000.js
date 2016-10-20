/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

// you have to require the utils module and call adapter function
var utils  = require(__dirname + '/lib/utils');
var http   = require('http');
var exec   = require('child_process').exec;
var fs     = require('fs');
var adapter = utils.adapter('foobar2000');
var foobarPath = null;
var timer;
var delay = 10000;
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
    'SAC': 'SAC',
    'SAQ': 'SAQ',
    'EmptyPlaylist': 'EmptyPlaylist',
    'SwitchPlaylist': 'SwitchPlaylist'
};

/**
 * cmd=PlaybackOrder&param1=0 //default
 * cmd=PlaybackOrder&param1=3 //random
 * cmd=PlaybackOrder&param1=1 //repeat playlist
 * cmd=PlaybackOrder&param1=2 //repeat track
 * cmd=PlaybackOrder&param1=4 //shuffle tracks
 * cmd=PlaybackOrder&param1=5 // shuffle album
 * cmd=PlaybackOrder&param1=6 //shuffle folders
 * cmd=SAC&param1=1 (0) // остановить после этого  трека
 * cmd=SAQ&param1=1 (0) // остановить после
 * cmd=QueueAlbum&param1=
 * cmd=QueueRandomItems&param1=21
 * cmd=EmptyPlaylist&param1= //Очистить пейлист
 * cmd=SwitchPlaylist&param1=1 //переключится на плейлист по номеру
 * http://127.0.0.1:8888/default/albumart_20586 картинга альбома
 *
 * http://127.0.0.1:8888/foobar2000controller/?cmd=browser.json
 * http://127.0.0.1:8888/foobar2000controller/?param3=state.json
 * http://127.0.0.1:8888/foobar2000controller/?param3=info.json
 * http://127.0.0.1:8888/foobar2000controller/?param3=playlists.json
 * http://127.0.0.1:8888/foobar2000controller/?param3=version.json
 * http://127.0.0.1:8888/foobar2000controller/?param3=playlist_options.json
 * http://127.0.0.1:8888/foobar2000controller/?param3=library.json
 * http://192.168.1.10:8585/?cmd=foobar
 */

function GetPlaylist(){
    httpGet('&param3=playlist.json', null, function(data){
        if (data.playlist){
            adapter.setState('playlist', data.playlist.js, true);
            adapter.setState('playlists', data.playlists.js, true);
        }
    });
}
function GetState(){
    clearTimeout(timer);
    httpGet('&param3=info.json', null, function(data){
            var key;
            for (key in data) {
                if (objState[key] !== data[key]){
                    objState[key] = data[key];
                    _SetState(key);
                }
            }
            adapter.setState('info.connection', true, true);
            adapter.log.debug('Response info "' + JSON.stringify(objState) + '"');
            timer = setTimeout(function (){
                GetState();
            }, delay);
    });
}
function _SetState(key){
    GetPlaylist();
    adapter.setState(key, objState[key], true);
    if (key ==='isPlaying' || key ==='isPaused'){
        IsPlaying(objState.isPlaying, objState.isPaused);
    }
}

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
        if (state.val !== 'true' && state.val !== 'false'){
            param = state.val;
        } else {
            param = '';
        }
        var ids = id.split(".");
        adapter.log.info('id.split ' + JSON.stringify(ids));
        var idst = ids[ids.length - 1].toString().toLowerCase();
        adapter.log.info('stateChange ids ' + idst);
        if (idst === 'start' || idst === 'exit'){
            launch(idst);
        } else {
            var cmd = Commands[idst];
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

function launch(cmd){
    adapter.log.info('launch ' + JSON.stringify(cmd));
    /*if (foobarPath){ //TODO переписать запуск. Локально либо удаленно
        launchFoobar();
    }*/ /*else */
    if (adapter.config.cmdstart){
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
        adapter.setState('info.connection', true, true);
    });
}

function sendShellCommand(command) {
    exec('foobar2000.exe /' + command, { cwd: foobarPath });
}

function launchFoobar() {
    exec('foobar2000.exe', { cwd: foobarPath });
}

function httpGet(data, option, callback){
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
    adapter.log.info('foobar2000 httpGet("' + data + ' - ' +JSON.stringify(option)+'")');
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
            try {
                jsondata = JSON.parse(jsondata);
                if (!jsondata) {
                    throw new SyntaxError("JSON data error");
                }
                else {
                    delay = 2000;
                    callback (jsondata);
                }
            } catch (err) {
                adapter.log.debug('JSON.Parse data error ' + err.toString());
                jsondata = null;
                delay = 2000;
                GetState();
            }
        });
    }).on('error', function (e) {
        adapter.log.warn('Got error by post request ' + e.toString());
        adapter.setState('info.connection', false, true);
        delay = 10000;
        adapter.log.info('Reconnect to ' + delay/1000 + ' sec.');
    });
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