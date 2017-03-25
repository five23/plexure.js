/*global ActiveXObject:false, XMLHttpRequest:false, soundManager:false, Image:false */
(function (window) {
  "use strict";
  var tau = Math.PI * 2
    , polyphony = 60
    , samples = []
    , filter, last_x = 0
    , last_y = 0
    , selected_sample = null
    , over_sample = null
    , last_click = 0
    , last_sample = null
    , last_sample_id = 0
    , cvs = window.document.getElementById('canvas')
    , ctx = cvs.getContext("2d");
  cvs.width = window.document.body.offsetWidth;
  cvs.height = window.document.body.offsetHeight;
  window.addEventListener('resize', function (e, width, height) {
    if (typeof width === 'undefined') {
      width = window.document.body.offsetWidth;
    }
    if (typeof height === 'undefined') {
      height = window.document.body.offsetHeight;
    }
    if (typeof window.devicePixelRatio !== 'undefined') {
      width *= window.devicePixelRatio;
      height *= window.devicePixelRatio;
    }
    ctx.canvas.width = width;
    ctx.canvas.height = height;
    cvs.style.width = width / window.devicePixelRatio;
    cvs.style.height = height / window.devicePixelRatio;
  });
  soundManager.setup({
    onready: function () {
      var frame = new Frame();
      var input = new Input();
      input.init();
      frame.start();
    }
  });
  var Frame = function () {
    return {
      active: false
      , request: null
      , frame: 0
      , start: function () {
        if (!this.active) {
          var self = this
            , animationLoop = function () {
              self.request = window.requestAnimationFrame(animationLoop);
              self.step(self.frame);
              self.frame++;
            };
          if (typeof window.requestAnimationFrame === 'undefined') {
            window.requestAnimationFrame = (function () {
              return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function (callback) {
                window.setTimeout(callback, 1000 / 60);
              };
            }());
          }
          if (typeof window.cancelAnimationFrame === 'undefined') {
            window.cancelAnimationFrame = (function () {
              return window.cancelAnimationFrame || window.webkitCancelAnimationFrame || window.mozCancelAnimationFrame || window.oCancelAnimationFrame || window.msCancelAnimationFrame;
            }());
          }
          animationLoop();
          this.active = true;
        }
      }
      , stop: function () {
        if (this.active) {
          window.cancelAnimationFrame(this.request);
        }
      }
      , renderLoad: function (sample) {
        if (sample.loading && sample.audio.bytesLoaded) {
          ctx.font = "13px Arial";
          ctx.fillStyle = "#fff";
          ctx.fillText(Math.round(100 * sample.audio.bytesLoaded / sample.audio.bytesTotal) + '%', -sample.size * 0.6, sample.size * 0.6);
        }
      }
      , renderWave: function (sample) {
        this.radialClip(sample.size);
        if (sample.wave_img) {
          if (sample.playing) {
            ctx.drawImage(sample.wave_img, -120.0 * sample.audio.position / sample.audio.duration, -100.5);
          }
          else {
            ctx.globalAlpha = 0.5;
            ctx.drawImage(sample.wave_img, 0, -100.5);
          }
        }
        this.radialCross(sample.size);
      }
      , radialClip: function (radius) {
        ctx.globalAlpha = 1.0;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, tau, false);
        ctx.fill();
        ctx.closePath();
        ctx.beginPath();
        ctx.arc(0, 0, radius - tau, 0, tau, false);
        ctx.clip();
      }
      , radialCross: function (radius) {
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.lineWidth = 1;
        ctx.strokeStyle = "#aaa";
        ctx.beginPath();
        ctx.moveTo(0, radius);
        ctx.lineTo(0, -radius);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-radius, 0);
        ctx.lineTo(radius, 0);
        ctx.stroke();
        ctx.closePath();
        ctx.restore();
      }
      , render: function (samples) {
        var v1, v2, length = samples.length;
        for (var i = 0; i < length; i += 1) {
          v1 = samples[i];
          for (var j = i + 1; j < length; j += 1) {
            v2 = samples[j];
            var dx = v2.x - v1.x;
            var dy = v2.y - v1.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            var dz = (dist - (240 + v1.size + v2.size)) / dist;
            v1.vx += dx / dist * dz;
            v1.vy += dy / dist * dz;
            v2.vx -= dx / dist * dz;
            v2.vy -= dy / dist * dz;
          }
          if (!v1.fixed) {
            v1.x += v1.vx * 0.05;
            v1.y += v1.vy * 0.05;
            v1.vx *= 0.95;
            v1.vy *= 0.95;
          }
          ctx.save();
          ctx.clearRect(0, 0, ctx.width, ctx.height);
          ctx.translate(v1.x, v1.y);
          if (v2 === v1) {
            ctx.globalAlpha = 0.8;
          }
          else {
            ctx.globalAlpha = 0.0;
          }
          ctx.save();
          this.renderWave(v1);
          this.renderLoad(v1);
          ctx.restore();
          ctx.beginPath();
          ctx.lineWidth = Math.PI;
          ctx.strokeStyle = "#acacac";
          ctx.arc(0, 0, v1.size - Math.PI / 2, 0, tau, true);
          ctx.stroke();
          ctx.closePath();
          ctx.restore();
        }
      }
      , step: function () {
        ctx.save();
        ctx.clearRect(0, 0, cvs.width, cvs.height);
        ctx.translate(cvs.width * 0.5, cvs.height * 0.5);
        this.render(samples);
        ctx.restore();
      }
    };
  };

  function loadAudioSample(sample) {
    sample.audio = soundManager.createSound({
      id: "sound" + sample.sId + "_" + last_sample_id
      , url: sample.preview_url
      , autoLoad: true
      , multiShot: true
      , stream: true
      , useFastPolling: true
      , volume: 50
      , onload: function () {
        sample.loading = false;
        sample.loaded = true;
      }
      , whileplaying: function () {
        if ((sample.cue_end !== 0 && sample.cue_end < this.position) || (sample.cue_start !== 0 && this.position < sample.cue_start)) {
          this.setPosition(sample.cue_start);
        }
        if (sample.y > 0) {
          this.setVolume(0.5 * (sample.size * (1.0 - (sample.y / (cvs.height * 0.5)))));
        }
        this.setPan((sample.x / cvs.width) * 200);
      }
      , onfinish: function () {
        this.setPosition(sample.cue_start);
        this.play();
      }
    });
  }

  function findSample(mousex, mousey) {
    for (var i = (samples.length - 1); i >= 0; i -= 1) {
      var v = samples[i];
      var x = v.x - (mousex - (cvs.width * 0.5));
      var y = v.y - (mousey - (cvs.height * 0.5));
      var dist = Math.sqrt(x * x + y * y);
      if (dist < v.size) {
        return v;
      }
    }
    return null;
  }

  function removeSample(soundObj) {
    var pos = samples.indexOf(soundObj);
    if (pos === -1) {
      return;
    }
    samples.splice(pos, 1);
    soundObj.onremove();
    if (last_sample === soundObj) {
      last_sample = null;
    }
    else if (selected_sample === soundObj) {
      selected_sample = null;
    }
    else if (over_sample === soundObj) {
      over_sample = null;
    }
  }

  function toFront(soundObj) {
    var pos = samples.indexOf(soundObj);
    if (pos === -1) {
      return;
    }
    samples.splice(pos, 1);
    samples.push(soundObj);
  }

  function removeAll() {
    var keep = [];
    last_sample = null;
    selected_sample = null;
    for (var i = 0; i < samples.length; i += 1) {
      if (samples[i].fixed) {
        keep.push(samples[i]);
      }
      else {
        samples[i].onremove();
      }
    }
    samples = keep;
  }

  function createSample(sound, extra_info) {
    if (samples.length > polyphony) {
      return;
    }
    var soundObj = {
      name: sound.name
      , loading: true
      , loaded: false
      , audio: null
      , playing: false
      , sId: sound.id
      , size: 88
      , vx: 0
      , vy: 0
      , cue_start: 0
      , cue_end: 0
      , x: Math.random() * 10 - 2
      , y: Math.random() * 10 - 2
      , duration: parseFloat(sound.duration)
      , preview_url: sound.previews['preview-lq-mp3']
      , fixed: false
    };
    if (extra_info) {
      if (extra_info.id !== -1) {
        soundObj.id = extra_info.id;
        last_sample_id = soundObj.id;
      }
      else {
        soundObj.id = last_sample_id;
        last_sample_id += 1;
      }
      if (extra_info.wave_img) {
        soundObj.wave_img = extra_info.wave_img;
      }
      if (extra_info.audio !== null) {
        soundObj.audio = extra_info.audio;
      }
      soundObj.x = extra_info.x;
      soundObj.y = extra_info.y;
      soundObj.size = extra_info.size;
      soundObj.cue_start = extra_info.cue_start;
      soundObj.cue_end = extra_info.cue_end;
      soundObj.fixed = extra_info.fixed;
    }
    else {
      soundObj.id = last_sample_id;
      last_sample_id += 1;
      soundObj.wave_img = new Image();
      soundObj.wave_img.src = sound.images['waveform_l'];
    }
    soundObj.ondoubleclick = function () {
      soundObj.play();
    };
    soundObj.onselected = function () {};
    soundObj.ondeselected = function () {};
    soundObj.clone = function () {
      createSample(sound, sound.extra_info);
    };
    soundObj.play = function () {
      if (!soundObj.loaded) {
        return;
      }
      soundObj.playing = !soundObj.playing;
      if (soundObj.audio && soundObj.loaded) {
        if (soundObj.playing) {
          soundObj.audio.play();
        }
        else {
          soundObj.audio.pause();
        }
      }
    };
    soundObj.stop = function () {
      soundObj.playing = false;
      if (soundObj.audio && soundObj.loaded) {
        soundObj.audio.stop();
      }
    };
    soundObj.onaudiofinish = function () {
      soundObj.audio.setPosition(soundObj.cue_start);
      if (soundObj.cue_end === 0) {
        soundObj.audio.play();
      }
    };
    soundObj.cueStart = function () {
      if (!soundObj.loaded) {
        return;
      }
      soundObj.cue_start = soundObj.audio.position;
    };
    soundObj.cueEnd = function () {
      if (!soundObj.loaded) {
        return;
      }
      soundObj.cue_end = soundObj.audio.position;
    };
    soundObj.clearCue = function () {
      if (!soundObj.loaded) {
        return;
      }
      soundObj.cue_end = soundObj.cue_start = 0;
    };
    soundObj.restart = function () {
      if (!soundObj.loaded) {
        return;
      }
      soundObj.audio.setPosition(soundObj.cue_start);
    };
    soundObj.fix = function () {
      soundObj.fixed = !soundObj.fixed;
    };
    soundObj.onremove = function () {
      if (soundObj.audio) {
        soundObj.audio.stop();
        soundManager.destroySound(soundObj.audio);
      }
      soundObj.id = null;
    };
    soundObj.toConfigObject = function () {
      return {
        id: soundObj.id
        , sId: soundObj.sId
        , x: Math.floor(soundObj.x)
        , y: Math.floor(soundObj.y)
        , size: Math.floor(soundObj.size)
        , cue_start: Math.floor(soundObj.cue_start)
        , cue_end: Math.floor(soundObj.cue_end)
        , fixed: soundObj.fixed
      };
    };
    samples.push(soundObj);
    loadAudioSample(soundObj);
    window.document.getElementById("spinner").style.visibility = 'hidden';
    return soundObj;
  }
  var Input = function () {
    var _options = {
        element: window.document.body
        , preventDefault: false
        , ratio: false
        , forceTouch: false
        , type: 'object'
      }
      , _ratio = 1
      , _bound = false
      , _touch = false
      , _pxy = function (fn, context) {
        var tmp, args, proxy;
        if (typeof context === "string") {
          tmp = fn[context];
          context = fn;
          fn = tmp;
        }
        if (typeof fn !== 'function') {
          return undefined;
        }
        args = Array.prototype.slice.call(arguments, 2);
        proxy = function () {
          return fn.apply(context, args.concat(Array.prototype.slice.call(arguments)));
        };
        proxy.guid = fn.guid = fn.guid || proxy.guid;
        return proxy;
      };
    return {
      inputs: []
      , average: {}
      , init: function (userOptions) {
        this.freesound = window.freesound;
        this.freesound.setToken("mWAfqF9DGxGpXA3dOw4Hz2TlKbj0xqBQdvIU3Q70");
        if (typeof userOptions !== 'undefined') {
          this.options(userOptions);
        }
        if (typeof window.devicePixelRatio !== 'undefined' && _options.ratio) {
          _ratio = window.devicePixelRatio;
        }
        _touch = (_options.forceTouch || this.supportsTouch());
        this.bindAllInputs();
        return this;
      }
      , options: function (newOptions) {
        if (typeof newOptions === 'undefined') {
          return _options;
        }
        for (var option in _options) {
          if (_options.hasOwnProperty(option) && typeof newOptions[option] !== 'undefined') {
            _options[option] = newOptions[option];
          }
        }
      }
      , setCoordinates: function (e) {
        if (_options.preventDefault) {
          e.preventDefault();
        }
        var c = []
          , sum = (_options.type === 'object') ? {
            x: 0
            , y: 0
          } : [0, 0];
        if (_touch) {
          for (var i = 0; i < e.touches.length; i++) {
            c[i] = (_options.type === 'object') ? {
              x: e.touches[i].pageX * _ratio
              , y: e.touches[i].pageY * _ratio
            } : [e.touches[i].pageX * _ratio, e.touches[i].pageY * _ratio];
            if (_options.type === 'object') {
              sum.x += c[i].x;
              sum.y += c[i].y;
            }
            else {
              sum[0] += c[i][0];
              sum[1] += c[i][1];
            }
          }
        }
        else {
          c[0] = (_options.type === 'object') ? {
            x: e.pageX * _ratio
            , y: e.pageY * _ratio
          } : [e.pageX * _ratio, e.pageY * _ratio];
          sum = c[0];
        }
        this.inputs = c;
        this.average = (_options.type === 'object') ? {
          x: Math.ceil(sum.x / c.length)
          , y: Math.ceil(sum.y / c.length)
        } : [Math.ceil(sum[0] / c.length), Math.ceil(sum[1] / c.length)];
      }
      , bindAllInputs: function () {
        _bound = true;
        this.bindTapStart();
        this.bindTapMove();
        this.bindTapEnd();
        window.document.body.ondragstart = this.ondragstart;
        window.document.body.onmousewheel = this.onmousewheel;
        window.document.body.onkeypress = this.onkeypress;
      }
      , unbindAllInputs: function () {
        if (_bound) {
          this.unbindTapStart();
          this.unbindTapMove();
          this.unbindTapEnd();
        }
        _bound = false;
      }
      , ondragstart: function () {
        return false;
      }
      , bindTapStart: function () {
        var event = this.getEventType('start');
        _options.element.addEventListener(event, _pxy(this.tapStart, this), false);
      }
      , tapStart: function (e) {
        this.setCoordinates(e, 'start');
        this.ontapstart(this.average);
      }
      , ontapstart: function (average) {
        var sample = findSample(average.x, average.y);
        if (sample) {
          last_sample = sample;
          if (selected_sample === null) {
            selected_sample = sample;
            last_x = average.x;
            last_y = average.y;
            sample.onselected();
          }
          toFront(sample);
          var now = new Date().getTime();
          if (now - last_click < 200) {
            sample.ondoubleclick();
          }
          last_click = 0;
        }
        else {
          last_sample = null;
        }
      }
      , unbindTapStart: function () {
        var event = this.getEventType('start');
        _options.element.removeEventListener(event, _pxy(this.tapStart, this), false);
      }
      , bindTapMove: function () {
        var event = this.getEventType('move');
        _options.element.addEventListener(event, _pxy(this.tapMove, this), false);
      }
      , tapMove: function (e) {
        this.setCoordinates(e, 'move');
        this.ontapmove(this.average, this.inputs);
      }
      , ontapmove: function (average) {
        if (selected_sample === null) {
          over_sample = findSample(average.x, average.y);
          return;
        }
        selected_sample.x += average.x - last_x;
        selected_sample.y += average.y - last_y;
        last_x = average.x;
        last_y = average.y;
      }
      , unbindTapMove: function () {
        var event = this.getEventType('move');
        _options.element.removeEventListener(event, _pxy(this.tapMove, this), false);
      }
      , bindTapEnd: function () {
        var event = this.getEventType('end');
        _options.element.addEventListener(event, _pxy(this.tapEnd, this), false);
      }
      , tapEnd: function (e) {
        this.setCoordinates(e, 'end');
        this.ontapend(this.average, this.inputs);
      }
      , ontapend: function () {
        if (selected_sample) {
          selected_sample.vx = 0;
          selected_sample.vy = 0;
          selected_sample.ondeselected();
        }
        selected_sample = null;
        last_click = new Date().getTime();
      }
      , unbindTapEnd: function () {
        var event = this.getEventType('end');
        _options.element.removeEventListener(event, _pxy(this.tapEnd, this), false);
      }
      , onkeypress: function (e) {
        if (e.target.localName === "textarea" || e.target.localName === "input") {
          var code = (e.keyCode) ? e.keyCode : e.charCode; /*global freesound:false*/
          if (code === 13) {
            var freesound = window.freesound;
            var query = e.target.value;
            window.document.getElementById("spinner").style.visibility = 'visible';
            var fields = 'id,name,url,tags';
            var loop = 0;
            var page = 1;
            var page_size = 5;
            var sort = "score"
            var group = 1;
            var filter = 'duration:[0 TO 3]';
            freesound.textSearch(query, {
              page: 1
              , group_by_pack: group
              , page_size: 5
              , filter: filter
              , sort: sort
              , fields: fields
            }, function (sounds) {
              var msg = "";
              for (var i = 0; i <= sounds.results.length - 1; i++) {
                if (typeof sounds.getSound(i).id != "undefined") {
                  freesound.getSound(sounds.getSound(i).id, createSample, null);
                }
              }
            });
            e.target.value = "";
            return false;
          }
        }
        var target_sample = (last_sample ? last_sample : over_sample);
        if (target_sample) {
          switch (String.fromCharCode((e.keyCode) ? e.keyCode : e.charCode)) {
          case ' ':
            target_sample.play();
            break;
          case 'o':
            target_sample.restart();
            break;
          case 'f':
            target_sample.fix();
            break;
          case 'r':
            target_sample.clone();
            break;
          case 'k':
            target_sample.cueStart();
            break;
          case 'l':
            target_sample.cueEnd();
            break;
          case 'j':
            target_sample.clearCue();
            break;
          case 'd':
            removeSample(target_sample);
            break;
          case 'c':
            removeAll();
            break;
          default:
            return true;
          }
          return false;
        }
      }
      , inonfocus: function (e) {
        e.target.value = "";
      }
      , onmousewheel: function (e) {
        var target_sample = (last_sample ? last_sample : over_sample);
        if (!target_sample) {
          return;
        }
        if (!e) {
          e = window.event;
        }
        if (e.wheelDelta) {
          if (target_sample.loaded) {
            if (e.wheelDelta >= 120) {
              target_sample.audio.setPosition(target_sample.audio.position + 100);
            }
            if (e.wheelDelta <= -120) {
              target_sample.audio.setPosition(target_sample.audio.position - 100);
            }
          }
        }
      }
      , getEventType: function (type) {
        var prefix = _touch ? 'touch' : 'mouse';
        if (type === 'start' && !_touch) {
          type = 'down';
        }
        else if (type === 'end' && !_touch) {
          type = 'up';
        }
        return prefix + type;
      }
      , supportsTouch: function () {
        return (('ontouchstart' in window) || window.DocumentTouch && window.document instanceof window.DocumentTouch);
      }
      , destroy: function () {
        this.unbindAllInputs();
      }
    };
  };
  var freesound = {
    debug: true
    , BASE_URI: "http://www.freesound.org/api"
    , apiKey: '651798f3a7b0481596ab5a1e571f9db9'
    , _URI_SOUND: '/sounds/<sound_id>/'
    , _URI_SOUND_ANALYSIS: '/sounds/<sound_id>/analysis/'
    , _URI_SOUND_ANALYSIS_FILTER: '/sounds/<sound_id>/analysis/<filter>'
    , _URI_SIMILAR_SOUNDS: '/sounds/<sound_id>/similar/'
    , _URI_SEARCH: '/sounds/search/'
    , _URI_CONTENT_SEARCH: '/sounds/content_search/'
    , _URI_GEOTAG: '/sounds/geotag'
    , _URI_USER: '/people/<user_name>/'
    , _URI_USER_SOUNDS: '/people/<user_name>/sounds/'
    , _URI_USER_PACKS: '/people/<user_name>/packs/'
    , _URI_USER_BOOKMARKS: '/people/<username>/bookmark_categories'
    , _URI_BOOKMARK_CATEGORY_SOUNDS: '/people/<username>/bookmark_categories/<category_id>/sounds'
    , _URI_PACK: '/packs/<pack_id>/'
    , _URI_PACK_SOUNDS: '/packs/<pack_id>/sounds/'
    , _make_uri: function (uri, args) {
      if (args) {
        for (var a = 0; a < args.length; a += 1) {
          uri = uri.replace(/<[\w_]+>/, args[a]);
        }
      }
      return this.BASE_URI + uri;
    }
    , _make_request: function (uri, success, error, params, wrapper) {
      if (uri.indexOf('?') === -1) {
        uri = uri + "?";
      }
      uri = uri + "&api_key=" + this.apiKey;
      for (var p in params) {
        if (params.hasOwnProperty(p)) {
          uri = uri + "&" + p + "=" + params[p];
        }
      }
      var xhr;
      try {
        xhr = new XMLHttpRequest();
      }
      catch (e) {
        xhr = new ActiveXObject('Microsoft.XMLHTTP');
      }
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) { /*jshint -W061 */
          var data = eval("(" + xhr.responseText + ")");
          success(wrapper ? wrapper(data) : data);
        }
        else if (xhr.readyState === 4 && xhr.status !== 200) {
          error();
        }
      };
      xhr.open('GET', uri);
      xhr.send(null);
    }
    , _make_sound_object: function (snd) {
      snd.get_analysis = function (showAll, filter, success, error) {
        //var params = { all: showAll ? 1 : 0 };
        var base_uri = filter ? freesound._URI_SOUND_ANALYSIS_FILTER : freesound._URI_SOUND_ANALYSIS;
        freesound._make_request(freesound._make_uri(base_uri, [snd.id, filter ? filter : ""]), success, error);
      };
      snd.get_similar_sounds = function (success, error) {
        freesound._make_request(freesound._make_uri(freesound._URI_SIMILAR_SOUNDS, [snd.id]), success, error, {}, this._make_sound_collection_object);
      };
      return snd;
    }
    , _make_sound_collection_object: function (col) {
      var get_next_or_prev = function (which, success, error) {
        freesound._make_request(which, success, error, {}, this._make_sound_collection_object);
      };
      col.next_page = function (success, error) {
        get_next_or_prev(this.next, success, error);
      };
      col.previous_page = function (success, error) {
        get_next_or_prev(this.previous, success, error);
      };
      return col;
    }
    , _make_user_object: function (user) { // receives json object already "parsed" (via eval)
      user.get_sounds = function (success, error) {
        freesound._make_request(freesound._make_uri(freesound._URI_USER_SOUNDS, [user.username]), success, error, {}, this._make_sound_collection_object);
      };
      user.get_packs = function (success, error) {
        freesound._make_request(freesound._make_uri(freesound._URI_USER_PACKS, [user.username]), success, error, {}, this._make_pack_collection_object);
      };
      user.get_bookmark_categories = function (success, error) {
        freesound._make_request(freesound._make_uri(freesound._URI_USER_BOOKMARKS, [user.username]), success, error);
      };
      user.get_bookmark_category_sounds = function (ref, success, error) {
        freesound._make_request(ref, success, error);
      };
      return user;
    }
    , _make_pack_object: function (pack) { // receives json object already "parsed" (via eval)
      pack.get_sounds = function (success, error) {
        freesound._make_request(freesound._make_uri(freesound._URI_PACK_SOUNDS, [pack.id]), success, error, {}, this._make_sound_collection_object);
      };
      return pack;
    }
    , _make_pack_collection_object: function (col) {
      var get_next_or_prev = function (which, success, error) {
        freesound._make_request(which, success, error, {}, this._make_pack_collection_object);
      };
      col.next_page = function (success, error) {
        get_next_or_prev(this.next, success, error);
      };
      col.previous_page = function (success, error) {
        get_next_or_prev(this.previous, success, error);
      };
      return col;
    }
    , get_from_ref: function (ref, success, error) {
      this._make_request(ref, success, error, {});
    }
    , get_sound: function (soundId, success, error) {
      this._make_request(this._make_uri(this._URI_SOUND, [soundId]), success, error, {}, this._make_sound_object);
    }
    , get_user: function (username, success, error) {
      this._make_request(this._make_uri(this._URI_USER, [username]), success, error, {}, this._make_user_object);
    }
    , get_pack: function (packId, success, error) {
      this._make_request(this._make_uri(this._URI_PACK, [packId]), success, error, {}, this._make_pack_object);
    }
    , quick_search: function (query, success, error) {
      this.search(query, 0, null, null, success, error);
    }
    , search: function (query, page, filter, sort, num_results, fields, sounds_per_page, success, error) {
      var params = {
        q: (query ? query : " ")
      };
      if (page) {
        params.p = page;
      }
      if (filter) {
        params.f = filter;
      }
      if (sort) {
        params.s = sort;
      }
      if (num_results) {
        params.num_results = num_results;
      }
      if (sounds_per_page) {
        params.sounds_per_page = sounds_per_page;
      }
      if (fields) {
        params.fields = fields;
      }
      this._make_request(this._make_uri(this._URI_SEARCH), success, error, params, this._make_sound_collection_object);
    }
    , content_based_search: function (target, filter, max_results, fields, page, sounds_per_page, success, error) {
      var params = {};
      if (page) {
        params.p = page;
      }
      if (filter) {
        params.f = filter;
      }
      if (target) {
        params.t = target;
      }
      if (max_results) {
        params.max_results = max_results;
      }
      if (sounds_per_page) {
        params.sounds_per_page = sounds_per_page;
      }
      if (fields) {
        params.fields = fields;
      }
      this._make_request(this._make_uri(this._URI_CONTENT_SEARCH), success, error, params, this._make_sound_collection_object);
    }
  };
})(this);