"use strict";
const utils = require('@iobroker/adapter-core');
let http = require('http');
let exec = require('child_process').exec;
let adapter, foobarPath = null, timerPoll, timeout, muteVol = 100, request, old_states,
    states = {
        playlist: []
    };

let Commands = {
    'play':            'Start',
    'stop':            'Stop',
    'next':            'StartNext',
    'pause':           'PlayOrPause',
    'prev':            'StartPrevious',
    'nextrandom':      'StartRandom',
    'repeat':          'PlaybackOrder',
    'shuffle':         'PlaybackOrder',
    'random':          'PlaybackOrder',
    'seek':            'Seek',
    'volume':          'Volume',
    'volumedb':        'VolumeDB',
    'rating':          'PlayingCommand',
    'sac':             'SAC',
    'saq':             'SAQ',
    'switch_playlist': 'SwitchPlaylist',
    'search':          'SearchMediaLibrary',
    'browser':         'Browse',
    'playid':          'Start',
    'itemplaying':     'Start',
    'clear':           'EmptyPlaylist'
};

function startAdapter(options){
    return adapter = utils.adapter(Object.assign({}, options, {
        systemConfig: true,
        name:         'foobar2000',
        ready:        main,
        unload:       callback => {
            timerPoll && clearInterval(timerPoll);
            timeout && clearTimeout(timeout);
            try {
                debug('cleaned everything up...');
                callback();
            } catch (e) {
                callback();
            }
        },
        stateChange:  (id, state) => {
            if (id && state && !state.ack){
                adapter.log.debug(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
                let param;
                id = id.split(".")[2].toString().toLowerCase();
                if (id === 'start' || id === 'exit'){
                    launch(id);
                    return;
                }
                if (id === 'repeat'){
                    param = state.val;
                }
                if (id === 'switch_playlist'){
                    param = state.val;
                }
                if (id === 'rating'){
                    if (state.val > 5) state.val = 5;
                    if (state.val < 0) state.val = 0;
                    param = encodeURIComponent('Playback Statistics/Rating/' + state.val);
                }
                if (id === 'seek'){
                    if (state.val > 100) state.val = 100;
                    if (state.val < 0) state.val = 0;
                    param = state.val;
                }
                if (id === 'volume'){
                    if (state.val > 100) state.val = 100;
                    if (state.val < 0) state.val = 0;
                    param = state.val;
                }
                if (id === 'volumedb'){ //volume level, 0...665 (0...-66.5 db), or 1000 to mute
                    if (state.val > 665) state.val = 665;
                    if (state.val < 0) state.val = 0;
                    param = state.val;
                }
                if (id === 'playid'){
                    param = state.val - 1;
                }
                if (id === 'shuffle'){
                    if (state.val){
                        param = '4';
                    } else {
                        param = '0';
                    }
                }
                if (id === 'sac'){
                    if (state.val){
                        param = '1';
                    } else {
                        param = '0';
                    }
                }
                if (id === 'random'){
                    if (state.val){
                        param = '3';
                    } else {
                        param = '0';
                    }
                }
                if (id === 'mute'){
                    if (state.val){
                        id = 'volume';
                        muteVol = states.volume || 100;
                        param = '0';
                    } else {
                        id = 'volume';
                        param = muteVol;
                    }
                }
                if (id === 'search'){
                    param = encodeURIComponent(param);
                }
                if (id === 'clear'){
                    getPlaylist();
                }
                if (id === 'browser'){
                    param = state.val;
                    if (param === '/'){
                        param = ' ';
                    }
                    browser(Commands[id], param);
                }
                if (id === 'add'){
                    if (id === 'add'){
                        param = encodeURIComponent(state.val);
                        /*let options = {
                            host: adapter.config.ip,
                            port: adapter.config.port,
                            path: '/foobar2000controller/?cmd=Browse&param1=' + param + '&param2=EnqueueDirSubdirs' //&param3=browser.json
                        };*/
                        timeout && clearTimeout(timeout);
                        httpGet('Browse', [param, 'EnqueueDirSubdirs'], (data) => {
                            timeout = setTimeout(() => {
                                getPlaylist();
                            }, 1000);
                        });
                    }
                } else {
                    let cmd = Commands[id];
                    if (cmd){
                        if (param !== undefined){
                            httpGet(cmd, [param]);
                        } else {
                            httpGet(cmd, '');
                        }
                    }
                }
            }
        }
    }));
}

function httpGet(cmd, param, cb){
    let params = '';
    if (Array.isArray(param)){
        param.forEach((key, i) => {
            params += '&param' + (i + 1) + '=' + key;
        });
    }
    let options = {
        host: adapter.config.ip || '127.0.0.1',
        port: adapter.config.port || 8888,
        path: '/foobar2000controller/?cmd=' + cmd + params
    };
    if (adapter.config.login && adapter.config.password){
        options.headers = {'Authorization': 'Basic ' + new Buffer(adapter.config.login + ':' + adapter.config.password).toString('base64')};
    }
    adapter.log.debug('foobar2000 httpGet("' + cmd + ' - ' + JSON.stringify(options) + '")');
    request = http.get(options, (res) => {
        let jsondata = '';
        res.setEncoding('utf8');
        res.on('error', (e) => {
            adapter.log.debug(e.toString());
        });
        res.on('data', chunk => jsondata += chunk);
        res.on('end', () => {
            if (res.statusCode === 200){
                setInfoConnection(true);
                if (!~jsondata.indexOf('Invalid request')){
                    try {
                        jsondata = JSON.parse(jsondata);
                        cb && cb(jsondata, false);
                    } catch (err) {
                        jsondata = null;
                        cb && cb(false, err);
                    }
                } else {
                    cb && cb(jsondata, false);
                }
            } else {
                setInfoConnection(false);
                adapter.log.debug('STATUS: ' + res.statusCode);
                if (res.statusCode === 401){
                    adapter.log.error('Foobar2000 Connection Authorization Error has ocurred. Check login or pass!');
                }
                jsondata = null;
            }
        });
    });
    request.shouldKeepAlive = false;
    request.on('error', (e) => {
        setInfoConnection(false);
        cb && cb(false, ' Error: ' + e);
    });
}

function getCurrentTrackInfo(cb){
    httpGet('PlaylistItemsPerPage', [1], (res) => {
        if (res){
            states.volume = res.volume;
            states.state = statePlaying(res.isPlaying, res.playingItem);
            states.album = res.playlist[0].album === '?' ? '' :res.playlist[0].album;
            states.artist = res.playlist[0].artist === '?' ? res.playlist[0].track :res.playlist[0].artist;
            states.title = res.playlist[0].track;
            states.current_duration = res.playlist[0].len;
            states.rating = res.playlist[0].rating !== '?' ? res.playlist[0].rating :'';
            states.current_elapsed = secToText(res.trackPosition);
            states.playlistId = parseInt(res.currentPlaylist, 10);
            states.itemPlaying = parseInt(res.playingItem, 10) + 1;
            states.playid = parseInt(res.playingItem, 10) + 1;
            states.codec = res.codec.split('|')[0];
            states.bitrate = res.codec && parseInt(res.codec.split('|')[1], 10);
            states.sampleRate = res.codec && parseInt(res.codec.split('|')[2], 10);
            states.bits = res.codec && parseInt(res.codec.split('|')[3], 10);
            states.channels = res.codec && res.codec.split('|')[4] || res.codec.split('|')[3];
            states.albumArt = adapter.config.ip + ':' + adapter.config.port + res.albumArt;
            states.volumeDB = parseInt(res.volumeDB, 10);
            states.trackLength = parseInt(res.trackLength, 10);
            states.elapsedTime = parseInt(res.trackPosition, 10);
            states.seek = isNaN(parseFloat((res.trackPosition / res.trackLength) * 100).toFixed(4)) ? 0 :parseFloat((res.trackPosition / res.trackLength) * 100).toFixed(4);
            states.mute = res.volume === 0;
            cb && cb();
        }
    });
}

function clearStatePlay(){
    states.album = '';
    states.artist = '';
    states.title = '';
    states.albumArt = '';
    states.current_duration = '00:00';
    states.rating = '';
}

function getInfo(cb){
    httpGet('', ['', '', '{"order":"[PLAYBACK_ORDER]","sac":"[SAC]","saq":"[SAQ]","active_playlist":"[PLAYLIST_ACTIVE]"}.json'], (res) => {
        if (res){
            let obj = res.match(/<p>.*({.*}).json/)[1];
            if (obj){
                try {
                    obj = JSON.parse(obj);
                    const order = parseInt(obj.order, 10);
                    states.sac = !!obj.sac;
                    states.switch_playlist = obj.active_playlist;
                    switch (order) {
                        case 0:
                            states.repeat = 'Off';
                            states.shuffle = false;
                            break;
                        case 1:
                            states.repeat = 'All';
                            states.shuffle = false;
                            break;
                        case 2:
                            states.repeat = 'One';
                            states.shuffle = false;
                            break;
                        default:
                    }
                    if (order === 3){
                        states.random = true;
                    } else {
                        states.random = false;
                    }
                    if (order === 3 || order === 4 || order === 5 || order === 6){
                        states.repeat = 'Off';
                        states.shuffle = true;
                    }
                } catch (e) {
                    adapter.log.debug('Error parse obj');
                }
            }
            cb && cb();
        }
    });
}

function statePlaying(play, item){
    let state;
    if (play === '1'){
        state = 'play';
    } else {
        if (item !== '?'){
            state = 'pause';
        } else {
            state = 'stop';
            clearStatePlay();
        }
    }
    return state;
}

function setStates(){
    Object.keys(states).forEach((key) => {
        if (states[key] !== old_states[key]){
            if (key === 'playid'){
                getPlaylist();
            }
            old_states[key] = states[key];
            adapter.setState(key, states[key], true);
        }
    });
}

function poll(){
    timerPoll && clearInterval(timerPoll);
    timerPoll = setInterval(() => {
        getCurrentTrackInfo(() => {
            getInfo(() => {
                setStates();
            });
        });
    }, 2000);
}

function main(){
    adapter.setState('info.connection', false, true);
    old_states = JSON.parse(JSON.stringify(states));
    if (adapter.config.path){
        foobarPath = adapter.config.path;
    }
    adapter.subscribeStates('*');
    poll();
    //getPlaylist(); // test
}

function setInfoConnection(val){
    adapter.getState('info.connection', (err, state) => {
        if (!err && state.val !== val){
            adapter.setState('info.connection', val, true);
            if (val) adapter.log.info('Foobar2000 ' + adapter.config.ip + ':' + adapter.config.port + ' connected');
        }
    });
}

function secToText(sec){
    let res;
    let m = Math.floor(sec / 60);
    let s = sec % 60;
    let h = Math.floor(m / 60);
    m = m % 60;
    if (h > 0){
        res = pad2(h) + ":" + pad2(m) + ":" + pad2(s);
    } else {
        res = pad2(m) + ":" + pad2(s);
    }
    return res;
}

function pad2(num){
    let s = num.toString();
    return (s.length < 2) ? "0" + s :s;
}

function getPlaylist(){
    httpGet('PlaylistItemsPerPage', [16384], (res) => {
        if (res && res.playlist){
            let playlist = [];
            let arr = res.songs;
            res.playlist.forEach((key, i) => {
                playlist[i] = {
                    "id":      i + 1,
                    "artist":  key.artist,
                    "album":   key.album,
                    "bitrate": 0,
                    "title":   key.track,
                    "file":    "",
                    "genre":   "",
                    "year":    0,
                    "len":     key.len,
                    "rating":  key.rating,
                    "cover":   ""
                }
            });
            states.playlist = JSON.stringify(playlist);
            states.playlists = JSON.stringify(res.playlists);
        }
    });
}

function launch(cmd){
    adapter.log.debug('launch ' + JSON.stringify(cmd));
    if (adapter.config.remote !== 'on'){
        if (cmd === 'start'){
            launchFoobar();
        } else if (cmd === 'exit'){
            sendShellCommand('exit');
        }
    } else if (adapter.config.cmdstart){
        let parts = adapter.config.path.split(':');
        let options = {
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
        request = http.get(options, (res) => {
            res.on('end', () => {
                if (res.statusCode === 200){
                    adapter.log.debug('foobar2000 send start ok');
                } else {
                    adapter.log.error('foobar2000 send start false');
                }
            });
        });
        request.shouldKeepAlive = false;
    } else {
        adapter.log.warn('foobar2000 can not be started');
    }
}

function sendShellCommand(command){
    exec('foobar2000.exe /' + command, {cwd: foobarPath});
}

function launchFoobar(){
    exec('foobar2000.exe', {cwd: foobarPath});
}

function browser(cmd, param){
    param = encodeURIComponent(param); //'&param3=browser.json'
    // let data = 'cmd=' + cmd + '&param1=' + param;
    if (cmd){
        httpGet(cmd, [param], (data) => {
            if (data){
                data = data.browser;
                filemanager('', data);
            }
        });
    }
}

function filemanager(val, arr){
    let browser = {}, files = [];
    arr.forEach((item, i, arr) => {
        let obj = {};
        let size = parseFloat(arr[i].fs) * 1024;
        if (!isNaN(size)){
            obj.size = (parseFloat(arr[i].fs.replace(',', '.')) * 1024).toFixed(0);
        } else {
            obj.size = '';
        }
        if (arr[i].ft && ~arr[i].ft.indexOf(':')){
            let mod = arr[i].ft.split(' '); //"27.05.2004 01:50"  2016-02-27 16:05:46
            let d = mod[0].split('.').reverse().join('-');
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
        if (i === arr.length - 1){
            browser.files = files;
            adapter.setState('browser', JSON.stringify(browser), true);
        }
    });
}

if (module.parent){
    module.exports = startAdapter;
} else {
    startAdapter();
}