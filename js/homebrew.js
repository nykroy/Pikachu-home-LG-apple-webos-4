/* homebrew.js — listado REAL de apps instaladas vía el servicio exec del Homebrew Channel.
   Fuente: luna://org.webosbrew.hbchannel.service/exec → luna-send listLaunchPoints (root).
   Aportación de Hearth (rudra-avatar/Hearth). Sin esto, una web app no puede enumerar apps
   (listLaunchPoints está denegado para apps web). */
(function (global) {
  'use strict';

  var SERVICE = 'luna://org.webosbrew.hbchannel.service';
  var HIDDEN = ['com.pikachu.apple', 'google.assistant.promo'];
  var ICON_BATCH = 4;
  var SAFE_PATH = /^\/[A-Za-z0-9._\/+@-]+$/;
  var ICON_CACHE_KEY = 'pikachu-icon-cache-v1';

  function hayPuente() {
    return !!(global.webOS && global.webOS.service && typeof global.webOS.service.request === 'function');
  }

  /* Ejecuta un comando como root. cb(ok, stdoutString, error). */
  function exec(command, cb) {
    if (!hayPuente()) { if (cb) { cb(false, '', 'sin puente webOS'); } return; }
    var hecho = false;
    var timer = global.setTimeout(function () {
      if (hecho) { return; } hecho = true;
      if (cb) { cb(false, '', 'timeout exec'); }
    }, 20000);
    global.webOS.service.request(SERVICE, {
      method: 'exec',
      parameters: { command: command },
      onSuccess: function (r) {
        if (hecho) { return; } hecho = true;
        global.clearTimeout(timer);
        var out = (r && (r.stdoutString || r.stdout)) || '';
        if (cb) { cb(true, out, ''); }
      },
      onFailure: function (e) {
        if (hecho) { return; } hecho = true;
        global.clearTimeout(timer);
        if (cb) { cb(false, '', (e && e.errorText) ? e.errorText : 'exec falló'); }
      }
    });
  }

  function normalizarTipo(lp) {
    var t = String((lp && (lp.launchPointType || lp.type)) || 'app').toLowerCase();
    if (t.indexOf('input') >= 0 || t.indexOf('external') >= 0 || t.indexOf('hdmi') >= 0 || t === 'entrada') { return 'entrada'; }
    if (t.indexOf('store') >= 0 || t.indexOf('tienda') >= 0) { return 'tienda'; }
    return 'app';
  }

  /* cb(ok, [apps], error). apps: {id, nombre, tipo, fuente, iconPath}. */
  function listar(cb) {
    exec("luna-send -n 1 luna://com.webos.applicationManager/listLaunchPoints '{}'", function (ok, out, err) {
      if (!ok || !out) { if (cb) { cb(false, [], err || 'sin salida del listado'); } return; }
      var parsed = null, points, apps = [], i, lp, id, title;
      try { parsed = JSON.parse(out); } catch (e) { parsed = null; }
      points = (parsed && parsed.launchPoints) || [];
      for (i = 0; i < points.length; i++) {
        lp = points[i];
        id = (typeof lp.id === 'string') ? lp.id : '';
        title = (typeof lp.title === 'string') ? lp.title : '';
        if (!id || !title || HIDDEN.indexOf(id) >= 0) { continue; }
        apps.push({
          id: id,
          nombre: title,
          tipo: normalizarTipo(lp),
          fuente: 'homebrew',
          iconPath: (typeof lp.largeIcon === 'string' && lp.largeIcon) ? lp.largeIcon : ((typeof lp.icon === 'string') ? lp.icon : '')
        });
      }
      if (cb) { cb(apps.length > 0, apps, apps.length ? '' : 'sin launchPoints'); }
    });
  }

  /* cb(ok, [entradas], error). entradas: {id, nombre, tipo:'entrada', fuente:'eim'}.
     getAllInputStatus (EIM) es público — se llama directo, sin exec. */
  function listarEntradas(cb) {
    if (!hayPuente()) { if (cb) { cb(false, [], 'sin puente webOS'); } return; }
    global.webOS.service.request('luna://com.webos.service.eim', {
      method: 'getAllInputStatus',
      parameters: {},
      onSuccess: function (r) {
        var devices = (r && r.devices) || [];
        var entradas = [], i, d;
        for (i = 0; i < devices.length; i++) {
          d = devices[i];
          if (!d || !d.appId) { continue; }
          entradas.push({ id: d.appId, nombre: d.label || d.appId, tipo: 'entrada', fuente: 'eim' });
        }
        if (cb) { cb(entradas.length > 0, entradas, entradas.length ? '' : 'sin entradas'); }
      },
      onFailure: function (e) {
        if (cb) { cb(false, [], (e && e.errorText) || 'error EIM'); }
      }
    });
  }

  /* ----- iconos reales (base64, por lotes, con caché localStorage) ----- */
  function leerIconos(jobs, cb) {
    var script = '', i;
    for (i = 0; i < jobs.length; i++) {
      script += "printf '%d ' " + i + "; base64 '" + jobs[i].path + "' 2>/dev/null | tr -d '\\n'; echo";
      if (i < jobs.length - 1) { script += '; '; }
    }
    exec(script, function (ok, out) {
      var got = {}, lineas, j, m;
      if (!ok || !out) { if (cb) { cb(got); } return; }
      lineas = out.split('\n');
      for (j = 0; j < lineas.length; j++) {
        m = /^(\d+) ([A-Za-z0-9+\/=]+)$/.exec(lineas[j]);
        if (m && jobs[Number(m[1])]) { got[Number(m[1])] = 'data:image/png;base64,' + m[2]; }
      }
      if (cb) { cb(got); }
    });
  }

  /* cb({appId: dataURI}). No bloquea: lo que no se lee cae al glyph. */
  function cargarIconos(apps, cb) {
    var cache = {};
    try { cache = JSON.parse(global.localStorage.getItem(ICON_CACHE_KEY) || '{}'); } catch (e) { cache = {}; }
    var resultado = {}, pendientes = [], i, p;
    for (i = 0; i < apps.length; i++) {
      p = apps[i].iconPath;
      if (!p || !SAFE_PATH.test(p)) { continue; }
      if (cache[p]) { resultado[apps[i].id] = cache[p]; }
      else { pendientes.push({ id: apps[i].id, path: p }); }
    }
    if (!pendientes.length) { if (cb) { cb(resultado); } return; }

    var idx = 0;
    function siguienteLote() {
      if (idx >= pendientes.length) {
        try { global.localStorage.setItem(ICON_CACHE_KEY, JSON.stringify(cache)); } catch (e) {}
        if (cb) { cb(resultado); }
        return;
      }
      var lote = pendientes.slice(idx, idx + ICON_BATCH);
      idx += ICON_BATCH;
      leerIconos(lote, function (got) {
        var k;
        for (k = 0; k < lote.length; k++) {
          if (got[k]) { resultado[lote[k].id] = got[k]; cache[lote[k].path] = got[k]; }
        }
        siguienteLote();
      });
    }
    siguienteLote();
  }

  global.Homebrew = {
    hayPuente: hayPuente,
    exec: exec,
    listar: listar,
    listarEntradas: listarEntradas,
    cargarIconos: cargarIconos
  };
}(typeof window !== 'undefined' ? window : globalThis));
