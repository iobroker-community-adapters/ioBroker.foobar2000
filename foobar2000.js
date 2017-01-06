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
var oldstates = {};
var playlist = [];
var mutevol = 100;
var curtrack;
objState.playlist = [];

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
    'switchplaylist': 'SwitchPlaylist',
    'search': 'SearchMediaLibrary',
    'browser': 'Browse',
    'playid': 'Start',
    'clear': 'EmptyPlaylist'
};



/*
TODO add
TODO albumArt заменить на урл
 */
/**
 *
 * /foobar2000controller/albumart_10335  - get album
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
        var ids = id.split(".");
        var idst = ids[ids.length - 1].toString().toLowerCase();
        if (idst === 'mute'){
            if (state.val){
                idst = 'volume';
                mutevol = objState.volume || 100;
                objState.mute = true;
                param =  '0';
            } else {
                idst = 'volume';
                param =  mutevol;
            }
        } else {
            if (state.val !== 'true' && state.val !== 'false'){
                param = state.val;
            } else {
                param = '';
            }
        }
        if (idst === 'start' || idst === 'exit'){
            launch(idst);
        } else {
            if (idst === 'search'){
                param = encodeURIComponent(param);
            }
            if (idst === 'clear'){
                GetPlaylist();
            }
            if (idst === 'browser'){
                if(param === '/'){
                    param = ' ';
                }
                browser(Commands[idst], param);
            } else if (idst === 'add') {
                if (idst === 'add'){
                    param = encodeURIComponent(param);
                    var options = {
                        host: adapter.config.ip,
                        port: adapter.config.port,
                        path: '/foobar2000controller/?cmd=Browse&param1=' + param + '&param2=EnqueueDirSubdirs&param3=browser.json'
                    };
                    httpGet('', options, function(data){
                        setTimeout(function (){
                            GetPlaylist();
                        }, 1000);
                    });
                }
            } else {
                var cmd = Commands[idst];
                if (cmd){
                    sendCommand(cmd, param);
                }
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
        if (cmd === 'start'){
            launchFoobar();
        } else if (cmd === 'exit'){
            sendShellCommand('exit');
        }
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
    GetPlaylist();
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
        GetState();
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
            for (var key in data) {
                objState[key] = data[key];
            }
            _SetState();
            //adapter.setState('info.connection', true, true);
            //adapter.log.debug('Response info "' + JSON.stringify(objState) + '"'); //TODO раскоментить
            timer = setTimeout(function (){
                GetState();
            }, 2000);
        }
    });
}

function _SetState(){
    for (var key in objState) {
        if (!oldstates[key]){
            oldstates[key] = '';
        }
        if (objState[key] !== oldstates[key]){
            oldstates[key] = objState[key];
            _shift(key, function (){
                adapter.setState(key, objState[key], true);
            });
        }
    }
}

function _shift(key, callback){

    curtrack = objState.itemplaying;
    if (objState.playlist && curtrack){
        objState.artist = objState.playlist[curtrack].artist;
        objState.album = objState.playlist[curtrack].album;
        objState.title = objState.playlist[curtrack].track;
    }
    if (key ==='codec'){
        var arr = objState.codec.split('|');
        objState.bitrate = parseInt(arr[1], 10);
    }
    if (key ==='elapsedTime'){
        objState.current_elapsed = SecToText(objState.elapsedTime);
    }
    if (key ==='trackLength' || key ==='page'){
        objState.current_duration = SecToText(objState.trackLength);
        GetPlaylist();
    }
    if (key ==='isPlaying' || key ==='isPaused'){
        IsPlaying(objState.isPlaying, objState.isPaused);
    }
    callback();
}

function SecToText(sec){
    var res;
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    var h = Math.floor(m / 60);
    m = m % 60;
    if (h > 0){
        res = pad2(h) + ":" + pad2(m) + ":" + pad2(s);
    } else {
        res = pad2(m) + ":" + pad2(s);
    }
    return res;
}
function pad2(num) {
    var s = num.toString();
    return (s.length < 2)? "0" + s : s;
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
    adapter.log.debug('httpGet options - ' + JSON.stringify(options));

    http.get(options, function (res) {
        var jsondata = '';
        res.setEncoding('utf8');
        res.on('error', function (e) {
            adapter.log.debug(e.toString());
        });
        res.on('data', function (chunk) {
            jsondata += chunk;
        });
        res.on('end', function (){
            if (res.statusCode === 200){
                adapter.getState(adapter.namespace + '.info.connection', function (err, state){
                    if (!state.val){
                        adapter.setState('info.connection', true, true);
                        adapter.log.info('Foobar2000 ' +adapter.config.ip +':'+ adapter.config.port + ' connected');
                    }
                });
                try {
                    jsondata = JSON.parse(jsondata);
                    if (!jsondata){
                        adapter.log.error('JSON data error');
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
                //res.destroy();
            }
        });
    }).on('error', function (e) {
        adapter.log.debug('Got error by post request ' + e.toString());
        adapter.setState('info.connection', false, true);
        adapter.log.debug('Reconnect to 10 sec...');
        timer = setTimeout(function (){
            GetState();
        }, 10000);
    });
}

function GetPlaylist(){
    httpGet('&param3=playlist.json', null, function(data){
        if (data.playlist){
            objState.playlist = convPlaylist(data.playlist.js);
            objState.playlists = convPlaylist(data.playlists.js);
            adapter.setState('playlist', JSON.stringify(objState.playlist), true);
            adapter.setState('playlists', JSON.stringify(objState.playlists), true);
        }
    });
}

function convPlaylist(arr){ //TODO Bring all playlists players to the same species
    for (var i = 0; i < arr.length; i++) {
        arr[i].file = arr[i].track;
    }
    return arr;
}

function IsPlaying(play ,pause){
    if (play === '1'){
        objState.state = 'play';
    } else {
        if (pause === '1'){
            objState.state = 'pause';
        } else {
            objState.state = 'stop';
        }
    }
}
function browser(cmd, param){
    param = encodeURIComponent(param + '&param3=browser.json');
    var data = 'cmd=' + cmd + '&param1=' + param;
    if (cmd){
        httpGet(data, null, function (data){
            if (data){
                data = data.browser;
                filemanager('', data);
            }
        });
    }
}
function filemanager(val, arr){
    var browser = {};
    var files = [];
    arr.forEach(function(item, i, arr) {
            var obj = {};
            var size = parseFloat(arr[i].fs) * 1024;
            if (!isNaN(size)){
                obj.size = (parseFloat(arr[i].fs.replace(',' , '.')) * 1024).toFixed(0);
            } else {
                obj.size = '';
            }
            if (arr[i].ft && ~arr[i].ft.indexOf(':')){
                var mod = arr[i].ft.split(' '); //"27.05.2004 01:50"  2016-02-27 16:05:46
                var d = mod[0].split('.').reverse().join('-');
                arr[i].ft = d + ' ' + mod[1];
            }
            if (arr[i].fs){
                obj.filetype = 'file';
            } else {
                obj.filetype = 'directory';
            }
            if (arr[i].fs === 'NTFS' || arr[i].fs === 'FAT32'){
                obj.filetype = 'directory';
            }
            obj.file = decodeURIComponent(arr[i].pu);
            obj.lastmodified = arr[i].ft;
            obj.label = arr[i].p;

            files.push(obj);
        if (i === arr.length-1){
            browser.files = files;
            adapter.setState('browser', JSON.stringify(browser), true);
        }
    });
}
function isFile(str){

}
