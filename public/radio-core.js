/**
 * radio-core.js
 * Shared radio widget logic extracted from radio-surprise.html prototype.
 * Exposes window.RadioCore — call RadioCore.init(options) to wire up any page
 * that already has the radio HTML structure in the DOM.
 *
 * Required DOM ids (same as prototype):
 *   filmstrip, sprocketTop, sprocketBottom, caption, needle, knob,
 *   power, rewindBtn, audio, heroTitle, heroSub, hintText, tuneLabel
 *
 * Options object passed to init():
 *   photos        — array of {url, caption}  (required)
 *   audioSrc      — string URL               (optional)
 *   audioStart    — number seconds           (default 0)
 *   audioEnd      — number seconds           (default audio.duration)
 *   captionDefault— string                   (default 'turn the dial…')
 *   onPositionChange(pos, maxPos) — callback (optional)
 */

(function (global) {
  'use strict';

  // ── constants ──────────────────────────────────────────────────────────────
  var FRAME_W = 150;   // px — must match .frame CSS width
  var GAP     = 10;    // px — must match .filmstrip gap
  var PPD     = 2.73;  // pixels of scroll per degree of knob rotation

  // ── shared theme / font data (mirrors prototype) ──────────────────────────
  var RADIO_THEMES = [
    {id:'kawaii', name:'Kawaii Pink',
     bg:'linear-gradient(135deg,#FFD6E8,#B8E8FF,#FFF3B0)',
     body:'linear-gradient(160deg,#FFE1EE,#FFB8D6)',
     knob:'conic-gradient(from 0deg,#7FE0D6,#FFD166,#A78BFA,#FF5D8F,#7FE0D6)'},
    {id:'vintage', name:'Vintage Wood',
     bg:'linear-gradient(135deg,#c9a96e,#b08850,#8B6B3D)',
     body:'linear-gradient(175deg,#8B6B3D,#4A3510)',
     knob:'conic-gradient(from 0deg,#8B6B3D,#C9A227,#A0522D,#8B6B3D)'},
    {id:'neon',    name:'Neon Night',
     bg:'linear-gradient(135deg,#020208,#06021a,#020510)',
     body:'#080818',
     knob:'conic-gradient(from 0deg,#00f5ff,#b400ff,#ff2d78,#00ff9f,#00f5ff)'},
    {id:'cream',   name:'Retro Cream',
     bg:'linear-gradient(135deg,#FFF8EE,#F0EBE0,#EDE8DC)',
     body:'linear-gradient(170deg,#F5EDD8,#DDD0B3)',
     knob:'conic-gradient(from 0deg,#CFD8DC,#90A4AE,#78909C,#CFD8DC)'},
    {id:'velvet',  name:'Velvet Luxe',
     bg:'linear-gradient(135deg,#1a0a2e,#12071f,#0f0520)',
     body:'linear-gradient(160deg,#1e1040,#0a0515)',
     knob:'conic-gradient(from 0deg,#D4AF37,#C5982B,#9B59B6,#D4AF37)'},
    {id:'glass',   name:'Frosted Glass',
     bg:'linear-gradient(135deg,#b8c6ff,#ffd6e7,#d4f1f9)',
     body:'rgba(255,255,255,0.22)',
     knob:'conic-gradient(from 0deg,rgba(124,92,252,.75),rgba(255,111,163,.75),rgba(80,200,255,.75),rgba(124,92,252,.75))'}
  ];

  var FONT_PAIRS = [
    {id:'playful',  label:'Playful',  s:'Baloo 2',
     fd:"'Baloo 2',cursive",      fb:"'Quicksand',sans-serif"},
    {id:'romantic', label:'Romantic', s:'Pacifico',
     fd:"'Pacifico',cursive",      fb:"'Quicksand',sans-serif"},
    {id:'elegant',  label:'Elegant',  s:'Playfair Display',
     fd:"'Playfair Display',serif",fb:"'Nunito',sans-serif"},
    {id:'script',   label:'Script',   s:'Dancing Script',
     fd:"'Dancing Script',cursive",fb:"'Poppins',sans-serif"},
    {id:'modern',   label:'Modern',   s:'Poppins',
     fd:"'Poppins',sans-serif",    fb:"'Poppins',sans-serif"},
    {id:'dreamy',   label:'Dreamy',   s:'Satisfy',
     fd:"'Satisfy',cursive",       fb:"'Comfortaa',cursive"},
    {id:'retro',    label:'Retro',    s:'Lobster',
     fd:"'Lobster',cursive",       fb:"'Nunito',sans-serif"}
  ];

  // ── helper ─────────────────────────────────────────────────────────────────
  function fmtTime(s) {
    var m = Math.floor(s / 60), sc = Math.floor(s % 60);
    return m + ':' + (sc < 10 ? '0' : '') + sc;
  }

  // ── rewind sound (Web Audio API) ──────────────────────────────────────────
  function playRewindSound() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var dur = 0.75;
      var sz  = Math.floor(ctx.sampleRate * dur);
      var buf = ctx.createBuffer(1, sz, ctx.sampleRate);
      var dat = buf.getChannelData(0);
      for (var i = 0; i < sz; i++) dat[i] = (Math.random() * 2 - 1) * 0.2;

      var ns  = ctx.createBufferSource(); ns.buffer = buf;
      var bpf = ctx.createBiquadFilter(); bpf.type = 'bandpass';
      bpf.frequency.setValueAtTime(1200, ctx.currentTime);
      bpf.frequency.exponentialRampToValueAtTime(10000, ctx.currentTime + dur);
      bpf.Q.value = 1.2;
      var ng = ctx.createGain();
      ng.gain.setValueAtTime(0.6, ctx.currentTime);
      ng.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur);
      ns.connect(bpf); bpf.connect(ng); ng.connect(ctx.destination);
      ns.start(); ns.stop(ctx.currentTime + dur);

      var osc = ctx.createOscillator(); osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + dur);
      var og = ctx.createGain();
      og.gain.setValueAtTime(0.12, ctx.currentTime);
      og.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur);
      osc.connect(og); og.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + dur);
    } catch (e) {}
  }

  // ── main init ──────────────────────────────────────────────────────────────
  function init(opts) {
    opts = opts || {};

    // DOM refs
    var filmstrip   = document.getElementById('filmstrip');
    var screenEl    = document.querySelector('.screen');
    var captionEl   = document.getElementById('caption');
    var needle      = document.getElementById('needle');
    var knob        = document.getElementById('knob');
    var power       = document.getElementById('power');
    var rewindBtn   = document.getElementById('rewindBtn');
    var audio       = document.getElementById('audio');
    var sprocketTop = document.getElementById('sprocketTop');
    var sprocketBot = document.getElementById('sprocketBottom');

    // State
    var photos         = opts.photos || [];
    var captionDefault = opts.captionDefault || 'turn the dial to begin\u2026';
    var position   = 0;
    var maxPos     = 0;
    var totalW     = 0;
    var audioStart = opts.audioStart || 0;
    var audioEnd   = opts.audioEnd   || 0;
    var clipDur    = audioEnd - audioStart;
    var isPlaying  = false;
    var isRewinding= false;
    var rAF        = null;
    var dragging   = false;
    var lastAng    = 0;
    var cX = 0, cY = 0;

    // Set audio source if provided
    if (opts.audioSrc) {
      audio.src = opts.audioSrc;
      // If audioEnd not set, read from metadata
      if (audioEnd <= audioStart) {
        audio.addEventListener('loadedmetadata', function () {
          if (!isFinite(audio.duration)) return;
          audioEnd = audio.duration;
          clipDur  = audioEnd - audioStart;
        }, { once: true });
      }
    }

    // ── sprocket builder ────────────────────────────────────────────────────
    function buildSprockets(n) {
      var tot   = n * FRAME_W + Math.max(0, n - 1) * GAP;
      var holes = n * 5;
      var sp    = tot / holes;
      [sprocketTop, sprocketBot].forEach(function (row) {
        row.innerHTML = '';
        row.style.width = tot + 'px';
        for (var i = 0; i < holes; i++) {
          var d = document.createElement('span');
          d.style.left = (i * sp + sp / 2 - 3) + 'px';
          row.appendChild(d);
        }
      });
    }

    // ── filmstrip builder ───────────────────────────────────────────────────
    function buildFilmstrip() {
      var n = photos.length;
      totalW = n * FRAME_W + Math.max(0, n - 1) * GAP;
      maxPos = Math.max(0, totalW - FRAME_W);
      filmstrip.innerHTML = '';
      filmstrip.style.width = totalW + 'px';
      photos.forEach(function (p) {
        var el = document.createElement('div');
        el.className = 'frame' + (p.url ? '' : ' placeholder');
        el.style.width = FRAME_W + 'px';
        if (p.url) {
          var img = document.createElement('img');
          img.src = p.url; img.alt = p.caption || '';
          el.appendChild(img);
        } else {
          el.textContent = p.caption || '';
        }
        filmstrip.appendChild(el);
      });
      buildSprockets(n);
      position = 0;
      render();
    }

    // ── render (position → DOM) ─────────────────────────────────────────────
    function render() {
      var n  = photos.length;
      var sw = screenEl ? screenEl.clientWidth : 300;
      var off = (sw / 2) - (FRAME_W / 2) - position;
      filmstrip.style.transform   = 'translateX(' + off + 'px)';
      sprocketTop.style.transform = 'translateX(' + off + 'px)';
      sprocketBot.style.transform = 'translateX(' + off + 'px)';

      var idx = Math.max(0, Math.min(n - 1, Math.round(position / (FRAME_W + GAP))));
      captionEl.textContent = (photos[idx] && photos[idx].caption)
        ? photos[idx].caption : captionDefault;

      needle.style.left = 'calc(50% + ' + (42 * Math.sin(position * 0.035)) + 'px)';
      knob.style.transform = 'rotate(' + (position / PPD) + 'deg)';
      knob.setAttribute('aria-valuenow', maxPos > 0 ? Math.round(position / maxPos * 100) : 0);

      if (opts.onPositionChange) opts.onPositionChange(position, maxPos);
    }

    // ── audio sync loop ─────────────────────────────────────────────────────
    function syncLoop() {
      if (!isPlaying || isRewinding) return;
      var t = audio.currentTime;
      if (clipDur > 0 && t >= audioEnd) {
        audio.pause(); isPlaying = false;
        power.setAttribute('aria-pressed', 'false');
        position = maxPos; render(); return;
      }
      if (clipDur > 0) {
        position = Math.min(maxPos, Math.max(0, (t - audioStart) / clipDur * maxPos));
      }
      render();
      rAF = requestAnimationFrame(syncLoop);
    }

    // ── drag helpers ────────────────────────────────────────────────────────
    function getAngle(e) {
      var cx = e.touches ? e.touches[0].clientX : e.clientX;
      var cy = e.touches ? e.touches[0].clientY : e.clientY;
      return Math.atan2(cy - cY, cx - cX) * 180 / Math.PI;
    }

    function startDrag(e) {
      var r = knob.getBoundingClientRect();
      cX = r.left + r.width / 2;
      cY = r.top  + r.height / 2;
      lastAng = getAngle(e);
      dragging = true;
    }

    function doMove(e) {
      if (!dragging || isRewinding) return;
      e.preventDefault();
      var a = getAngle(e), d = a - lastAng;
      if (d >  180) d -= 360;
      if (d < -180) d += 360;
      lastAng = a;
      position = Math.max(0, Math.min(maxPos, position + d * PPD));
      if (audio.src && clipDur > 0) {
        audio.currentTime = audioStart + (position / maxPos) * clipDur;
      }
      render();
    }

    knob.addEventListener('mousedown', startDrag);
    knob.addEventListener('touchstart', startDrag, { passive: true });
    window.addEventListener('mousemove',  doMove);
    window.addEventListener('touchmove',  doMove, { passive: false });
    window.addEventListener('mouseup',  function () { dragging = false; });
    window.addEventListener('touchend', function () { dragging = false; });

    knob.addEventListener('keydown', function (e) {
      var step = PPD * 15, moved = false;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp')   { position = Math.min(maxPos, position + step); moved = true; }
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowDown')  { position = Math.max(0,      position - step); moved = true; }
      if (moved) {
        if (audio.src && clipDur > 0) audio.currentTime = audioStart + (position / maxPos) * clipDur;
        render(); e.preventDefault();
      }
    });

    window.addEventListener('resize', render);

    // ── power button ────────────────────────────────────────────────────────
    power.addEventListener('click', function () {
      var on = power.getAttribute('aria-pressed') === 'true';
      if (on) {
        audio.pause(); isPlaying = false;
        power.setAttribute('aria-pressed', 'false');
        if (rAF) { cancelAnimationFrame(rAF); rAF = null; }
      } else {
        if (!audio.src) {
          alert('No song attached to this radio.');
          return;
        }
        var seekTo = clipDur > 0
          ? audioStart + (position / maxPos) * clipDur
          : audioStart;
        audio.currentTime = Math.max(audioStart, Math.min(audioEnd || audio.duration || 0, seekTo));
        audio.play().catch(function () {});
        isPlaying = true;
        power.setAttribute('aria-pressed', 'true');
        rAF = requestAnimationFrame(syncLoop);
      }
    });

    // ── rewind button ────────────────────────────────────────────────────────
    rewindBtn.addEventListener('click', function () {
      if (isRewinding) return;
      if (rAF) { cancelAnimationFrame(rAF); rAF = null; }
      if (isPlaying) {
        audio.pause(); isPlaying = false;
        power.setAttribute('aria-pressed', 'false');
      }
      if (position === 0) { if (audio.src) audio.currentTime = audioStart; return; }

      isRewinding = true;
      playRewindSound();
      filmstrip.classList.add('rewinding');

      var fromPos = position;
      var t0      = Date.now();
      var rwDur   = Math.max(400, Math.min(1100, fromPos * 0.55 + 350));

      (function animRw() {
        var p = Math.min(1, (Date.now() - t0) / rwDur);
        var e = p * p * (3 - 2 * p);         // smooth-step easing
        position = fromPos * (1 - e);
        render();
        if (p < 1) {
          requestAnimationFrame(animRw);
        } else {
          position = 0;
          if (audio.src) audio.currentTime = audioStart;
          filmstrip.classList.remove('rewinding');
          isRewinding = false;
          render();
        }
      }());
    });

    // ── public API returned to caller ────────────────────────────────────────
    var api = {
      build: buildFilmstrip,
      render: render,
      setPhotos: function (arr) { photos = arr; buildFilmstrip(); },
      setAudioTrim: function (start, end) {
        audioStart = start; audioEnd = end; clipDur = end - start;
        if (!isPlaying) audio.currentTime = start;
      },
      getPosition: function () { return position; },
      getMaxPos:   function () { return maxPos;   },
      fmtTime: fmtTime
    };

    buildFilmstrip();
    return api;
  }

  // ── apply theme to document.body ───────────────────────────────────────────
  function applyTheme(themeId) {
    document.body.setAttribute('data-radio', themeId || 'kawaii');
  }

  // ── apply font pair to :root ───────────────────────────────────────────────
  function applyFont(fontId) {
    var fp = FONT_PAIRS.find(function (f) { return f.id === fontId; }) || FONT_PAIRS[0];
    document.documentElement.style.setProperty('--fd', fp.fd);
    document.documentElement.style.setProperty('--fb', fp.fb);
  }

  // ── public namespace ───────────────────────────────────────────────────────
  global.RadioCore = {
    init:         init,
    applyTheme:   applyTheme,
    applyFont:    applyFont,
    fmtTime:      fmtTime,
    playRewindSound: playRewindSound,
    RADIO_THEMES: RADIO_THEMES,
    FONT_PAIRS:   FONT_PAIRS
  };

}(window));
